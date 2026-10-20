// test/data/local/database_test.dart

import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yako/data/local/database.dart';
import 'package:yako/data/local/database_opener.dart';

String _hex(List<int> bytes) =>
    bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();

void main() {
  test('schema v1 creates every table and index', () async {
    final db = AppDatabase(NativeDatabase.memory());
    addTearDown(db.close);

    final rows = await db
        .customSelect(
          'SELECT name FROM sqlite_master '
          "WHERE type IN ('table', 'index') AND name NOT LIKE 'sqlite_%'",
        )
        .get();
    final names = rows.map((r) => r.read<String>('name')).toSet();

    expect(
      names,
      containsAll(<String>[
        'users',
        'transactions',
        'translations_cache',
        'consent',
        'sync_queue',
        'audit_log',
        'idx_transactions_created_at',
        'idx_transactions_type',
        'idx_translations_cache_source_hash',
      ]),
    );
    expect(db.schemaVersion, 1);
  });

  test('SQLCipher file contains no readable data', () async {
    final dir = await Directory.systemTemp.createTemp('yako_db_');
    addTearDown(() => dir.delete(recursive: true));
    final file = File(databasePath(dir));
    final random = Random.secure();
    final keyHex = _hex(List.generate(32, (_) => random.nextInt(256)));

    final db = AppDatabase(
      NativeDatabase(file, setup: (raw) => applySqlCipherKey(raw, keyHex)),
    );
    await db.into(db.auditLog).insert(
          AuditLogCompanion.insert(
            id: 'a1',
            eventType: 'PLAINTEXT_MARKER_123',
            createdAt: DateTime(2026),
          ),
        );
    await db.close();

    final bytes = file.readAsBytesSync();
    final asText = latin1.decode(bytes);
    expect(asText, isNot(contains('SQLite format 3')));
    expect(asText, isNot(contains('PLAINTEXT_MARKER_123')));

    // Wrong key cannot read the database.
    final wrongKey = _hex(List.filled(32, 7));
    final wrong = AppDatabase(
      NativeDatabase(file, setup: (raw) => applySqlCipherKey(raw, wrongKey)),
    );
    await expectLater(wrong.select(wrong.auditLog).get(), throwsA(anything));
    await wrong.close();

    // Right key reads it back.
    final again = AppDatabase(
      NativeDatabase(file, setup: (raw) => applySqlCipherKey(raw, keyHex)),
    );
    final rows = await again.select(again.auditLog).get();
    expect(rows.single.eventType, 'PLAINTEXT_MARKER_123');
    await again.close();
  });
}
