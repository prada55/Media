// lib/demo/demo_transaction_repository.dart
//
// DÉMO WEB UNIQUEMENT : opérations en mémoire, préremplies avec des
// exemples fictifs.

import 'dart:async';

import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/features/transactions/domain/entities/transaction.dart';
import 'package:yako/features/transactions/domain/entities/transaction_draft.dart';
import 'package:yako/features/transactions/domain/repositories/transaction_repository.dart';
import 'package:yako/features/transactions/domain/value_objects/transaction_filter.dart';
import 'package:yako/features/transactions/domain/value_objects/transaction_totals.dart';

/// In-memory [TransactionRepository] seeded with fictitious data.
class DemoTransactionRepository implements TransactionRepository {
  DemoTransactionRepository() {
    final now = DateTime.now();
    Transaction seed(
      int minutesAgo,
      TransactionType type,
      int amount,
      TransactionCategory category,
      String note,
    ) {
      final at = now.subtract(Duration(minutes: minutesAgo));
      return Transaction(
        id: 'demo-${_seq++}',
        type: type,
        amount: amount,
        category: category,
        transcriptFr: note,
        createdAt: at,
        updatedAt: at,
      );
    }

    _items.addAll([
      seed(
        20,
        TransactionType.sale,
        25000,
        TransactionCategory.saleGoods,
        'Trois sacs de riz',
      ),
      seed(
        75,
        TransactionType.expense,
        3500,
        TransactionCategory.expenseTransport,
        'Taxi pour le marché',
      ),
      seed(
        140,
        TransactionType.sale,
        12000,
        TransactionCategory.saleDrinks,
        'Deux casiers de boisson',
      ),
      seed(
        1500,
        TransactionType.sale,
        4500,
        TransactionCategory.saleFood,
        'Attiéké et poisson',
      ),
      seed(
        3000,
        TransactionType.expense,
        15000,
        TransactionCategory.expenseStock,
        'Stock de tomates',
      ),
    ]);
  }

  final List<Transaction> _items = [];
  final StreamController<void> _changes = StreamController.broadcast();
  int _seq = 0;

  Iterable<Transaction> _filter(TransactionFilter filter) {
    final from = filter.period.startFrom(DateTime.now());
    return _items.where(
      (t) =>
          (filter.type == null || t.type == filter.type) &&
          (from == null || !t.createdAt.isBefore(from)),
    );
  }

  List<Transaction> _sorted(Iterable<Transaction> items) =>
      items.toList()..sort((a, b) => b.createdAt.compareTo(a.createdAt));

  @override
  Future<Result<Transaction>> create(TransactionDraft draft) async {
    if (draft.amount <= 0) {
      return const FailureResult(
        ValidationFailure(
          technicalMessage: 'Amount out of range',
          userMessageFr: 'Le montant doit être supérieur à 0.',
        ),
      );
    }
    final now = DateTime.now();
    final t = Transaction(
      id: 'demo-${_seq++}',
      type: draft.type,
      amount: draft.amount,
      category: draft.category,
      transcriptFr: draft.transcriptFr,
      transcriptLocal: draft.transcriptLocal,
      createdAt: now,
      updatedAt: now,
    );
    _items.add(t);
    _changes.add(null);
    return Success(t);
  }

  @override
  Future<Result<List<Transaction>>> getAll({
    TransactionFilter filter = const TransactionFilter(),
    int limit = 50,
    int offset = 0,
  }) async =>
      Success(_sorted(_filter(filter)).skip(offset).take(limit).toList());

  @override
  Future<Result<Transaction?>> getById(String id) async =>
      Success(_items.where((t) => t.id == id).firstOrNull);

  @override
  Future<Result<Transaction>> update(Transaction transaction) async {
    final i = _items.indexWhere((t) => t.id == transaction.id);
    final updated = transaction.copyWith(updatedAt: DateTime.now());
    _items[i] = updated;
    _changes.add(null);
    return Success(updated);
  }

  @override
  Future<Result<void>> delete(String id) async {
    _items.removeWhere((t) => t.id == id);
    _changes.add(null);
    return const Success(null);
  }

  @override
  Future<Result<TransactionTotals>> computeTotals(
    TransactionFilter filter,
  ) async => Success(TransactionTotals.of(_filter(filter)));

  @override
  Stream<Result<List<Transaction>>> watchRecent({int limit = 50}) async* {
    yield Success(_sorted(_items).take(limit).toList());
    await for (final _ in _changes.stream) {
      yield Success(_sorted(_items).take(limit).toList());
    }
  }

  @override
  Future<Result<List<Transaction>>> search(
    String query, {
    TransactionFilter filter = const TransactionFilter(),
    int limit = 50,
  }) async {
    final needle = query.trim().toLowerCase();
    return Success(
      _sorted(_filter(filter))
          .where(
            (t) =>
                needle.isEmpty ||
                t.transcriptFr.toLowerCase().contains(needle) ||
                t.category.labelFr.toLowerCase().contains(needle) ||
                t.amount.toString().contains(needle.replaceAll(' ', '')),
          )
          .take(limit)
          .toList(),
    );
  }
}
