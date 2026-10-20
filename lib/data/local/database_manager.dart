// lib/data/local/database_manager.dart
//
// Cycle de vie de la base chiffrée : ouverture paresseuse avec la clé
// SQLCipher du trousseau (créée au premier lancement), fermeture avant
// effacement du compte.

import 'package:drift/drift.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/core/platform/app_directories.dart';
import 'package:yako/core/security/encryption_service.dart';
import 'package:yako/data/local/database.dart';
import 'package:yako/data/local/database_opener.dart';

/// Builds the executor for a database file and a base64 key.
typedef ExecutorFactory = QueryExecutor Function(String path, String keyBase64);

/// Opens and closes the single [AppDatabase] instance.
class DatabaseManager {
  DatabaseManager({
    required this._encryption,
    this._directories = const AppDirectories(),
    ExecutorFactory? executorFactory,
  }) : _executorFactory =
           executorFactory ??
           ((path, key) => openEncryptedExecutor(path: path, keyBase64: key));

  final EncryptionService _encryption;
  final AppDirectories _directories;
  final ExecutorFactory _executorFactory;
  Future<Result<AppDatabase>>? _opening;

  /// Returns the open database, creating key and file on first launch.
  Future<Result<AppDatabase>> open() => _opening ??= _open();

  Future<Result<AppDatabase>> _open() async {
    try {
      final key = await _getOrCreateKey();
      if (key case FailureResult(:final failure)) {
        _opening = null;
        return FailureResult(failure);
      }
      final dir = await _directories.documents();
      final db = AppDatabase(
        _executorFactory(databasePath(dir), key.getOrNull()!),
      );
      // Forces opening (and key verification) now rather than later.
      await db.customSelect('SELECT 1').get();
      return Success(db);
    } on Object catch (e, st) {
      _opening = null;
      return FailureResult(
        DatabaseFailure(
          technicalMessage: 'Unable to open encrypted database',
          cause: e,
          stackTrace: st,
        ),
      );
    }
  }

  Future<Result<String>> _getOrCreateKey() async {
    final existing = await _encryption.getDbKey();
    return switch (existing) {
      FailureResult(:final failure) => FailureResult(failure),
      Success(value: final String key) => Success(key),
      Success() => await _createKey(),
    };
  }

  Future<Result<String>> _createKey() async {
    final generated = _encryption.generateKey();
    if (generated case Success(:final value)) {
      final stored = await _encryption.storeDbKey(value);
      return stored.map((_) => value);
    }
    return generated;
  }

  /// Closes the database; the next [open] reopens (or recreates) it.
  Future<void> close() async {
    final pending = _opening;
    _opening = null;
    if (pending == null) return;
    final result = await pending;
    await result.getOrNull()?.close();
  }
}
