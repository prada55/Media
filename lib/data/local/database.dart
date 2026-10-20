// lib/data/local/database.dart
//
// Base locale Yako (Drift). Elle est ouverte exclusivement via
// `openEncryptedExecutor` (SQLCipher, clé 256 bits) : c'est la SEULE source
// de vérité de l'application.

import 'package:drift/drift.dart';
import 'package:yako/data/local/tables/audit_log_table.dart';
import 'package:yako/data/local/tables/consent_table.dart';
import 'package:yako/data/local/tables/sync_queue_table.dart';
import 'package:yako/data/local/tables/transactions_table.dart';
import 'package:yako/data/local/tables/translations_cache_table.dart';
import 'package:yako/data/local/tables/users_table.dart';

part 'database.g.dart';

/// Main application database.
@DriftDatabase(
  tables: [
    Users,
    Transactions,
    TranslationsCache,
    Consent,
    SyncQueue,
    AuditLog,
  ],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase(super.e);

  @override
  int get schemaVersion => 1;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        // createAll() crée aussi les index déclarés via @TableIndex.
        onCreate: (m) => m.createAll(),
        onUpgrade: (m, from, to) async {
          // Aucune migration en v1 : les étapes vN → vN+1 sont ajoutées
          // dans lib/data/local/migrations/ au fil des versions.
        },
        beforeOpen: (details) async {
          await customStatement('PRAGMA foreign_keys = ON');
        },
      );
}
