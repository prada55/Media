// lib/data/local/tables/transactions_table.dart
//
// Ventes et dépenses. Le montant et les transcriptions sont chiffrés
// applicativement (AES-256-GCM) AVANT insertion : les colonnes contiennent
// donc du texte base64 opaque, jamais l'entier FCFA ni le texte en clair.

import 'package:drift/drift.dart';

/// `transactions` table.
@DataClassName('TransactionRow')
@TableIndex.sql(
  'CREATE INDEX IF NOT EXISTS idx_transactions_created_at '
  'ON transactions (created_at DESC)',
)
@TableIndex(name: 'idx_transactions_type', columns: {#type})
class Transactions extends Table {
  TextColumn get id => text()();

  /// 'sale' | 'expense'.
  TextColumn get type => text()();

  /// Montant FCFA chiffré (AES-GCM, base64). Jamais d'entier en clair.
  TextColumn get amount => text()();

  TextColumn get category => text()();

  /// Transcription française chiffrée (base64).
  TextColumn get transcriptFr => text()();

  /// Transcription en langue locale chiffrée (base64), optionnelle.
  TextColumn get transcriptLocal => text().nullable()();

  /// Chemin relatif du fichier audio chiffré (.enc), optionnel.
  TextColumn get audioPath => text().nullable()();

  DateTimeColumn get createdAt => dateTime()();

  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}
