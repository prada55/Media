// lib/data/local/database_opener.dart
//
// Ouverture de la base chiffrée SQLCipher. La clé (32 octets) est fournie
// par EncryptionService et n'est jamais journalisée.

import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';
import 'package:path/path.dart' as p;
import 'package:sqlite3/common.dart';

/// File name of the encrypted database inside the documents directory.
const String kDatabaseFileName = 'yako.sqlite';

/// Returns the database file path inside [documentsDir].
String databasePath(Directory documentsDir) =>
    p.join(documentsDir.path, kDatabaseFileName);

/// Opens the database at [path] with SQLCipher using the base64 32-byte
/// [keyBase64]. Drift runs it in a background isolate.
///
/// A missing SQLCipher build or a wrong key throws on first query; the
/// repositories map that to a `DatabaseFailure`.
QueryExecutor openEncryptedExecutor({
  required String path,
  required String keyBase64,
}) {
  final keyHex = _toHex(base64Decode(keyBase64));
  return driftDatabase(
    name: 'yako',
    native: DriftNativeOptions(
      databasePath: () async => path,
      setup: (db) => applySqlCipherKey(db, keyHex),
    ),
  );
}

/// Applies the raw 256-bit key to [db] and verifies it immediately.
void applySqlCipherKey(CommonDatabase db, String keyHex) {
  final cipher = db.select('PRAGMA cipher_version');
  if (cipher.isEmpty) {
    throw StateError('SQLCipher is not available in this build');
  }
  db
    ..execute("PRAGMA key = \"x'$keyHex'\"")
    ..select('SELECT count(*) FROM sqlite_master');
}

String _toHex(List<int> bytes) =>
    bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
