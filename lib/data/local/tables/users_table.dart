// lib/data/local/tables/users_table.dart
//
// Utilisateur local unique. Le téléphone et le PIN ne sont jamais stockés
// en clair : seulement leurs empreintes salées.

import 'package:drift/drift.dart';

/// `users` table.
@DataClassName('UserRow')
class Users extends Table {
  TextColumn get id => text()();

  /// Empreinte salée du numéro de téléphone (hex).
  TextColumn get phoneHash => text()();

  /// Empreinte PBKDF2 du PIN (base64).
  TextColumn get pinHash => text()();

  /// Sel aléatoire 32 octets (base64) propre à l'utilisateur.
  TextColumn get pinSalt => text()();

  BoolColumn get biometricEnabled =>
      boolean().withDefault(const Constant(false))();

  /// fr | dyu | bci.
  TextColumn get language => text().withDefault(const Constant('fr'))();

  DateTimeColumn get createdAt => dateTime()();

  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}
