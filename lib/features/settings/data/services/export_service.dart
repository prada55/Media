// lib/features/settings/data/services/export_service.dart
//
// Export CSV chiffré « yako_export_AAAAMMJJ.yako » :
//   "YAKO1" (5 o) | sel (32 o) | 0x01 | nonce (12 o) | chiffré | tag (16 o)
// Clé = PBKDF2-HMAC-SHA256(mot de passe, sel, 100 000 itérations, 32 o),
// chiffrement AES-256-GCM. Le CSV n'existe qu'en mémoire ; seul le fichier
// chiffré touche le disque. Script de déchiffrement : docs/monetization.md.

import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:intl/intl.dart';
import 'package:path/path.dart' as p;
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/core/platform/app_directories.dart';
import 'package:yako/core/security/encryption_service.dart';
import 'package:yako/features/transactions/domain/entities/transaction.dart';
import 'package:yako/features/transactions/domain/repositories/transaction_repository.dart';

/// Builds, encrypts and decrypts transaction exports.
class ExportService {
  ExportService({
    required this._transactions,
    required this._encryption,
    this._directories = const AppDirectories(),
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now;

  static const List<int> magic = [0x59, 0x41, 0x4B, 0x4F, 0x31]; // YAKO1
  static const int saltLength = 32;
  static const int minPasswordLength = 8;
  static const String extension = '.yako';

  final TransactionRepository _transactions;
  final EncryptionService _encryption;
  final AppDirectories _directories;
  final DateTime Function() _now;

  /// Exports every transaction to an encrypted file; returns its path.
  Future<Result<File>> exportToFile(String password) async {
    final check = validatePassword(password);
    if (check != null) return FailureResult(check);
    final all = <Transaction>[];
    var offset = 0;
    while (true) {
      final page = await _transactions.getAll(limit: 500, offset: offset);
      if (page case FailureResult(:final failure)) {
        return FailureResult(failure);
      }
      final items = page.getOrNull()!;
      all.addAll(items);
      if (items.length < 500) break;
      offset += 500;
    }
    final sealed = await encrypt(buildCsv(all), password);
    final bytes = sealed.getOrNull();
    if (bytes == null) return FailureResult(sealed.getFailureOrNull()!);
    try {
      final dir = await _directories.temporary();
      final name =
          'yako_export_${DateFormat('yyyyMMdd').format(_now())}'
          '$extension';
      final file = File(p.join(dir.path, name));
      await file.writeAsBytes(bytes, flush: true);
      return Success(file);
    } on Object catch (e, st) {
      return FailureResult(
        DatabaseFailure(
          technicalMessage: 'Export write failed',
          userMessageFr: 'Impossible de créer le fichier d’export.',
          cause: e,
          stackTrace: st,
        ),
      );
    }
  }

  /// `null` when [password] is acceptable.
  static ValidationFailure? validatePassword(String password) =>
      password.length < minPasswordLength
      ? const ValidationFailure(
          technicalMessage: 'Export password too short',
          userMessageFr: 'Le mot de passe doit avoir au moins 8 caractères.',
        )
      : null;

  /// RFC 4180 CSV, with spreadsheet formula injection neutralized.
  static String buildCsv(List<Transaction> transactions) {
    final buffer = StringBuffer(
      'date,type,categorie,montant_fcfa,'
      'transcription_fr,transcription_locale\r\n',
    );
    final date = DateFormat('yyyy-MM-dd HH:mm');
    for (final t in transactions) {
      buffer
        ..writeAll([
          date.format(t.createdAt),
          t.type.code,
          _cell(t.category.labelFr),
          t.amount,
          _cell(t.transcriptFr),
          _cell(t.transcriptLocal ?? ''),
        ], ',')
        ..write('\r\n');
    }
    return buffer.toString();
  }

  static String _cell(String value) {
    var v = value;
    if (v.isNotEmpty && '=+-@\t\r'.contains(v[0])) v = "'$v";
    if (v.contains(RegExp('[",\r\n]'))) v = '"${v.replaceAll('"', '""')}"';
    return v;
  }

  /// Encrypts [csv] with a key derived from [password].
  Future<Result<Uint8List>> encrypt(String csv, String password) async {
    final salt = _encryption.generateSalt().getOrNull();
    if (salt == null) {
      return const FailureResult(
        EncryptionFailure(technicalMessage: 'Salt generation failed'),
      );
    }
    final key = await _encryption.deriveKeyFromPassword(password, salt);
    if (key case FailureResult(:final failure)) return FailureResult(failure);
    final sealed = await _encryption.encryptBytes(
      Uint8List.fromList(utf8.encode(csv)),
      key.getOrNull()!,
    );
    return sealed.map(
      (body) =>
          (BytesBuilder(copy: false)
                ..add(magic)
                ..add(base64Decode(salt))
                ..add(body))
              .takeBytes(),
    );
  }

  /// Decrypts an export (used by tests; mirrors the Python script).
  Future<Result<String>> decrypt(Uint8List file, String password) async {
    final header = magic.length + saltLength;
    if (file.length <= header || !_startsWith(file, magic)) {
      return const FailureResult(
        EncryptionFailure(technicalMessage: 'Not a Yako export'),
      );
    }
    final salt = base64Encode(file.sublist(magic.length, header));
    final key = await _encryption.deriveKeyFromPassword(password, salt);
    if (key case FailureResult(:final failure)) return FailureResult(failure);
    final clear = await _encryption.decryptBytes(
      Uint8List.sublistView(file, header),
      key.getOrNull()!,
    );
    return clear.map(utf8.decode);
  }

  static bool _startsWith(Uint8List data, List<int> prefix) {
    for (var i = 0; i < prefix.length; i++) {
      if (data[i] != prefix[i]) return false;
    }
    return true;
  }
}
