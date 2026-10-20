// lib/features/transactions/presentation/providers/transaction_actions.dart
//
// Actions sur une transaction existante (détail / édition) : les écrans
// n'appellent jamais directement le dépôt.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/features/transactions/domain/entities/transaction.dart';
import 'package:yako/features/transactions/presentation/providers/transaction_providers.dart';

final transactionActionsProvider = Provider<TransactionActions>(
  TransactionActions.new,
);

/// Update / delete / playback use cases.
class TransactionActions {
  TransactionActions(this._ref);

  final Ref _ref;

  Future<Result<Transaction>> update(
    Transaction original, {
    required TransactionType type,
    required int amount,
    required TransactionCategory category,
    required String transcript,
  }) => _ref
      .read(transactionRepositoryProvider)
      .update(
        original.copyWith(
          type: type,
          amount: amount,
          category: category,
          transcriptFr: transcript.trim(),
        ),
      );

  Future<Result<void>> delete(String id) async {
    await _ref.read(audioPlayerServiceProvider).stop();
    return await _ref.read(transactionRepositoryProvider).delete(id);
  }

  Future<Result<void>> play(Transaction transaction) async {
    final audio = transaction.audioPath;
    if (audio == null) return const Success(null);
    return await _ref.read(audioPlayerServiceProvider).play(audio);
  }

  Future<void> stopPlayback() => _ref.read(audioPlayerServiceProvider).stop();
}
