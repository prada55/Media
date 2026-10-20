// test/helpers/fake_transaction_repository.dart
//
// Dépôt en mémoire pour les tests de widgets.

import 'dart:async';

import 'package:yako/core/error/result.dart';
import 'package:yako/features/transactions/domain/entities/transaction.dart';
import 'package:yako/features/transactions/domain/entities/transaction_draft.dart';
import 'package:yako/features/transactions/domain/repositories/transaction_repository.dart';
import 'package:yako/features/transactions/domain/value_objects/transaction_filter.dart';
import 'package:yako/features/transactions/domain/value_objects/transaction_totals.dart';

class FakeTransactionRepository implements TransactionRepository {
  FakeTransactionRepository([List<Transaction>? initial])
    : items = [...?initial];

  final List<Transaction> items;
  final StreamController<void> _changes = StreamController.broadcast();
  int _seq = 0;

  void _notify() => _changes.add(null);

  @override
  Future<Result<Transaction>> create(TransactionDraft draft) async {
    final now = DateTime(2026, 10, 20, 9, _seq);
    final t = Transaction(
      id: 'fake-${_seq++}',
      type: draft.type,
      amount: draft.amount,
      category: draft.category,
      transcriptFr: draft.transcriptFr,
      audioPath: draft.audioPath,
      createdAt: now,
      updatedAt: now,
    );
    items.insert(0, t);
    _notify();
    return Success(t);
  }

  @override
  Future<Result<List<Transaction>>> getAll({
    TransactionFilter filter = const TransactionFilter(),
    int limit = 50,
    int offset = 0,
  }) async => Success(_filter(filter).skip(offset).take(limit).toList());

  @override
  Future<Result<Transaction?>> getById(String id) async =>
      Success(items.where((t) => t.id == id).firstOrNull);

  @override
  Future<Result<Transaction>> update(Transaction transaction) async {
    final i = items.indexWhere((t) => t.id == transaction.id);
    items[i] = transaction;
    _notify();
    return Success(transaction);
  }

  @override
  Future<Result<void>> delete(String id) async {
    items.removeWhere((t) => t.id == id);
    _notify();
    return const Success(null);
  }

  @override
  Future<Result<TransactionTotals>> computeTotals(
    TransactionFilter filter,
  ) async => Success(TransactionTotals.of(_filter(filter)));

  @override
  Stream<Result<List<Transaction>>> watchRecent({int limit = 50}) async* {
    yield Success(List.of(items));
    await for (final _ in _changes.stream) {
      yield Success(List.of(items));
    }
  }

  @override
  Future<Result<List<Transaction>>> search(
    String query, {
    TransactionFilter filter = const TransactionFilter(),
    int limit = 50,
  }) async => Success(
    _filter(filter)
        .where((t) => t.transcriptFr.toLowerCase().contains(query))
        .take(limit)
        .toList(),
  );

  Iterable<Transaction> _filter(TransactionFilter filter) =>
      items.where((t) => filter.type == null || t.type == filter.type);
}
