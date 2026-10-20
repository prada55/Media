// lib/features/translation/data/datasources/translation_cache_datasource.dart
//
// Cache Drift des traductions calculées. Clé : SHA-256 du texte source
// normalisé (jamais le texte lui-même). Le texte traduit peut provenir
// d'une transcription : il est chiffré avec la clé de données de session.

import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';
import 'package:yako/core/security/data_key_reader.dart';
import 'package:yako/core/security/encryption_service.dart';
import 'package:yako/data/local/database.dart';
import 'package:yako/data/local/database_manager.dart';
import 'package:yako/features/translation/data/datasources/text_normalizer.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';

/// Encrypted translation cache.
class TranslationCacheDatasource {
  TranslationCacheDatasource({
    required this._db,
    required this._encryption,
    required this._dataKey,
    DateTime Function()? now,
    this._uuid = const Uuid(),
  }) : _now = now ?? DateTime.now;

  final DatabaseManager _db;
  final EncryptionService _encryption;
  final DataKeyReader _dataKey;
  final DateTime Function() _now;
  final Uuid _uuid;

  static String hashOf(String text) =>
      sha256.convert(utf8.encode(normalizePhrase(text))).toString();

  /// Cached translation, `null` on miss or when the session is locked.
  Future<String?> get(
    String text, {
    required LanguageCode from,
    required LanguageCode to,
  }) async {
    final key = _dataKey();
    final db = (await _db.open()).getOrNull();
    if (key == null || db == null) return null;
    final row = await _query(db, hashOf(text), from, to).getSingleOrNull();
    if (row == null) return null;
    return (await _encryption.decryptAesGcm(
      row.translatedText,
      key,
    )).getOrNull();
  }

  /// Stores (or replaces) a translation. Silently skipped when locked.
  Future<void> put(
    String text,
    String translated, {
    required LanguageCode from,
    required LanguageCode to,
  }) async {
    final key = _dataKey();
    final db = (await _db.open()).getOrNull();
    if (key == null || db == null) return;
    final sealed = (await _encryption.encryptAesGcm(
      translated,
      key,
    )).getOrNull();
    if (sealed == null) return;
    final hash = hashOf(text);
    final existing = await _query(db, hash, from, to).getSingleOrNull();
    await db
        .into(db.translationsCache)
        .insertOnConflictUpdate(
          TranslationCacheRow(
            id: existing?.id ?? _uuid.v4(),
            sourceTextHash: hash,
            sourceLang: from.code,
            targetLang: to.code,
            translatedText: sealed,
            updatedAt: _now(),
          ),
        );
  }

  SimpleSelectStatement<$TranslationsCacheTable, TranslationCacheRow> _query(
    AppDatabase db,
    String hash,
    LanguageCode from,
    LanguageCode to,
  ) => db.select(db.translationsCache)
    ..where(
      (t) =>
          t.sourceTextHash.equals(hash) &
          t.sourceLang.equals(from.code) &
          t.targetLang.equals(to.code),
    )
    ..limit(1);
}
