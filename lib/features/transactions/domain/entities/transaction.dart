// lib/features/transactions/domain/entities/transaction.dart
//
// Une vente ou une dépense, en clair EN MÉMOIRE uniquement (la base ne
// contient que des valeurs chiffrées pour le montant et les transcriptions).

import 'package:intl/intl.dart';

/// Vente ou dépense.
enum TransactionType {
  sale('sale', 'Vente'),
  expense('expense', 'Dépense');

  TransactionType(this.code, this.labelFr);

  final String code;
  final String labelFr;

  static TransactionType fromCode(String code) =>
      code == expense.code ? expense : sale;
}

/// Catégories proposées sous forme de puces.
enum TransactionCategory {
  saleGoods('sale_goods', 'Vente marchandise', TransactionType.sale),
  saleDrinks('sale_drinks', 'Vente boisson', TransactionType.sale),
  saleFood('sale_food', 'Vente alimentaire', TransactionType.sale),
  expenseStock('expense_stock', 'Dépense stock', TransactionType.expense),
  expenseTransport(
    'expense_transport',
    'Dépense transport',
    TransactionType.expense,
  ),
  other('other', 'Autre', null);

  TransactionCategory(this.code, this.labelFr, this.impliedType);

  final String code;
  final String labelFr;

  /// Type déduit de la catégorie (`null` pour « Autre »).
  final TransactionType? impliedType;

  static TransactionCategory fromCode(String code) =>
      TransactionCategory.values.firstWhere(
        (c) => c.code == code,
        orElse: () => TransactionCategory.other,
      );
}

/// Decrypted transaction.
final class Transaction {
  const Transaction({
    required this.id,
    required this.type,
    required this.amount,
    required this.category,
    required this.transcriptFr,
    required this.createdAt,
    required this.updatedAt,
    this.transcriptLocal,
    this.audioPath,
  });

  final String id;
  final TransactionType type;

  /// Montant en francs CFA (entier, pas de centimes).
  final int amount;
  final TransactionCategory category;
  final String transcriptFr;
  final String? transcriptLocal;

  /// Chemin relatif du fichier audio chiffré, si enregistré.
  final String? audioPath;
  final DateTime createdAt;
  final DateTime updatedAt;

  static final NumberFormat _amountFormat = NumberFormat.decimalPattern('fr');
  static final DateFormat _dateFormat = DateFormat('dd/MM/yyyy HH:mm');

  /// Ex. « 25 000 FCFA ».
  String get formattedAmount => formatFcfa(amount);

  /// Ex. « 20/10/2026 09:15 ».
  String get formattedDate => _dateFormat.format(createdAt);

  /// Signed amount: positive for sales, negative for expenses.
  int get signedAmount => type == TransactionType.sale ? amount : -amount;

  static String formatFcfa(int amount) =>
      '${_amountFormat.format(amount).replaceAll(' ', ' ')} FCFA';

  Transaction copyWith({
    TransactionType? type,
    int? amount,
    TransactionCategory? category,
    String? transcriptFr,
    String? transcriptLocal,
    String? audioPath,
    DateTime? updatedAt,
  }) => Transaction(
    id: id,
    type: type ?? this.type,
    amount: amount ?? this.amount,
    category: category ?? this.category,
    transcriptFr: transcriptFr ?? this.transcriptFr,
    transcriptLocal: transcriptLocal ?? this.transcriptLocal,
    audioPath: audioPath ?? this.audioPath,
    createdAt: createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
  );

  @override
  String toString() => 'Transaction($id)';
}
