// lib/data/local/migrations/migration_v1_v2.dart
//
// v1 → v2 : ajout de la table auth_attempts et de son index phone_hash.

import 'package:drift/drift.dart';
import 'package:yako/data/local/database.dart';

/// Applies the v1 → v2 schema changes.
Future<void> migrateV1ToV2(Migrator m, AppDatabase db) async {
  await m.createTable(db.authAttempts);
  await m.createIndex(
    Index(
      'idx_auth_attempts_phone_hash',
      'CREATE INDEX IF NOT EXISTS idx_auth_attempts_phone_hash '
          'ON auth_attempts (phone_hash)',
    ),
  );
}
