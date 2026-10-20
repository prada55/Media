// lib/data/local/tables/consent_table.dart
//
// Consentements utilisateur (tous OFF par défaut, révocables en 1 tap).

import 'package:drift/drift.dart';

/// `consent` table.
@DataClassName('ConsentRow')
class Consent extends Table {
  /// credit_score_sharing | promotions | diagnostics.
  TextColumn get key => text()();

  BoolColumn get value => boolean().withDefault(const Constant(false))();

  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {key};
}
