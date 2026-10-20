// lib/data/local/tables/audit_log_table.dart
//
// Journal d'audit local. Uniquement des types d'événements, JAMAIS de PII.

import 'package:drift/drift.dart';

/// `audit_log` table.
@DataClassName('AuditLogRow')
class AuditLog extends Table {
  TextColumn get id => text()();

  /// Ex. : login_success, login_failure, consent_changed, account_deleted.
  TextColumn get eventType => text()();

  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}
