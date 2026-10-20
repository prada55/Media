// lib/features/transactions/domain/value_objects/transaction_totals.dart
//
// Totaux calculés en mémoire après déchiffrement.

import 'package:yako/features/transactions/domain/entities/transaction.dart';

/// Sales / expenses / balance in FCFA.
final class TransactionTotals {
  const TransactionTotals({
    this.totalSales = 0,
    this.totalExpenses = 0,
    this.count = 0,
  });

  factory TransactionTotals.of(Iterable<Transaction> transactions) {
    var sales = 0;
    var expenses = 0;
    var count = 0;
    for (final t in transactions) {
      count++;
      if (t.type == TransactionType.sale) {
        sales += t.amount;
      } else {
        expenses += t.amount;
      }
    }
    return TransactionTotals(
      totalSales: sales,
      totalExpenses: expenses,
      count: count,
    );
  }

  final int totalSales;
  final int totalExpenses;
  final int count;

  int get balance => totalSales - totalExpenses;
}
