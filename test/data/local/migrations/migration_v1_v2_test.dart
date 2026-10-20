// test/data/local/migrations/migration_v1_v2_test.dart

import 'package:drift/drift.dart';
import 'package:drift_dev/api/migrations_native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yako/data/local/database.dart';

import 'generated/schema.dart';
import 'generated/schema_v1.dart' as v1;

void main() {
  late SchemaVerifier verifier;

  setUpAll(() {
    verifier = SchemaVerifier(GeneratedHelper());
  });

  test('v1 → v2 matches the expected v2 schema', () async {
    final schema = await verifier.schemaAt(1);
    final db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, 2);
    await db.close();
  });

  test('v1 data survives the migration and auth_attempts is usable', () async {
    final schema = await verifier.schemaAt(1);
    final old = v1.DatabaseAtV1(schema.newConnection());
    await old.customStatement(
      'INSERT INTO users (id, phone_hash, pin_hash, pin_salt, '
      'biometric_enabled, language, created_at, updated_at) '
      "VALUES ('u1', 'hash', 'pin', 'salt', 0, 'fr', 0, 0)",
    );
    await old.close();

    final db = AppDatabase(schema.newConnection());
    final users = await db.select(db.users).get();
    expect(users.single.id, 'u1');

    await db
        .into(db.authAttempts)
        .insert(
          AuthAttemptsCompanion.insert(
            id: 'a1',
            phoneHash: 'hash',
            updatedAt: DateTime(2026),
            attemptCount: const Value(3),
          ),
        );
    final attempts = await db.select(db.authAttempts).get();
    expect(attempts.single.attemptCount, 3);
    await db.close();
  });
}
