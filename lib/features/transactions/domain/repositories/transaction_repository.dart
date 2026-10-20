// lib/features/transactions/domain/repositories/transaction_repository.dart
//
// Contrat d'accès aux transactions. Le chiffrement applicatif est un
// détail de l'implémentation : le domaine ne voit que des valeurs claires.

import 'package:yako/core/error/result.dart';
import 'package:yako/features/transactions/domain/entities/transaction.dart';
import 'package:yako/features/transactions/domain/entities/transaction_draft.dart';
import 'package:yako/features/transactions/domain/value_objects/transaction_filter.dart';
import 'package:yako/features/transactions/domain/value_objects/transaction_totals.dart';

/// Transactions repository.
abstract interface class TransactionRepository {
  Future<Result<Transaction>> create(TransactionDraft draft);

  /// Newest first. [limit]/[offset] paginate.
  Future<Result<List<Transaction>>> getAll({
    TransactionFilter filter = const TransactionFilter(),
    int limit = 50,
    int offset = 0,
  });

  Future<Result<Transaction?>> getById(String id);

  Future<Result<Transaction>> update(Transaction transaction);

  /// Deletes the row and its encrypted audio file.
  Future<Result<void>> delete(String id);

  Future<Result<TransactionTotals>> computeTotals(TransactionFilter filter);

  /// Emits the [limit] newest transactions on every change.
  Stream<Result<List<Transaction>>> watchRecent({int limit = 50});

  /// Keyword search on decrypted transcripts, category and amount.
  Future<Result<List<Transaction>>> search(
    String query, {
    TransactionFilter filter = const TransactionFilter(),
    int limit = 50,
  });
}
