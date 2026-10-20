// lib/data/local/tables/sync_queue_table.dart
//
// File d'attente des payloads anonymisés consentis (chiffrés au repos).

import 'package:drift/drift.dart';

/// `sync_queue` table.
@DataClassName('SyncQueueRow')
class SyncQueue extends Table {
  TextColumn get id => text()();

  /// Payload agrégé chiffré AES-GCM (base64).
  TextColumn get payloadEncrypted => text()();

  DateTimeColumn get createdAt => dateTime()();

  IntColumn get retryCount => integer().withDefault(const Constant(0))();

  @override
  Set<Column<Object>> get primaryKey => {id};
}
