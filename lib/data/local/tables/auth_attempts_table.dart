// lib/data/local/tables/auth_attempts_table.dart
//
// Compteur d'échecs de connexion (verrouillage progressif). Ajoutée en v2.

import 'package:drift/drift.dart';

/// `auth_attempts` table (schema v2).
@DataClassName('AuthAttemptRow')
@TableIndex(name: 'idx_auth_attempts_phone_hash', columns: {#phoneHash})
class AuthAttempts extends Table {
  TextColumn get id => text()();

  TextColumn get phoneHash => text()();

  IntColumn get attemptCount => integer().withDefault(const Constant(0))();

  DateTimeColumn get lockedUntil => dateTime().nullable()();

  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}
