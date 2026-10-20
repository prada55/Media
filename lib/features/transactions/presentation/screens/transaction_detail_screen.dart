// lib/features/transactions/presentation/screens/transaction_detail_screen.dart
//
// Détail d'une opération : écouter l'enregistrement, modifier, supprimer
// (double confirmation).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/presentation/failure_snackbar.dart';
import 'package:yako/core/presentation/l10n.dart';
import 'package:yako/core/theme/app_colors.dart';
import 'package:yako/features/transactions/domain/entities/transaction.dart';
import 'package:yako/features/transactions/presentation/providers/transaction_actions.dart';
import 'package:yako/features/transactions/presentation/providers/transaction_providers.dart';
import 'package:yako/features/transactions/presentation/screens/transaction_edit_screen.dart';
import 'package:yako/features/translation/presentation/widgets/transcript_translation_view.dart';

/// Transaction detail.
class TransactionDetailScreen extends ConsumerWidget {
  const TransactionDetailScreen({required this.transactionId, super.key});

  final String transactionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(transactionByIdProvider(transactionId));
    return Scaffold(
      appBar: AppBar(title: const Tr('detail.title')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => const Center(child: Tr('detail.error')),
        data: (t) => t == null
            ? const Center(child: Tr('detail.missing'))
            : _Body(transaction: t),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({required this.transaction});

  final Transaction transaction;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = transaction;
    final color = t.type == TransactionType.sale
        ? AppColors.sale
        : AppColors.expense;
    final actions = ref.read(transactionActionsProvider);
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Text(t.type.labelFr, style: Theme.of(context).textTheme.titleLarge),
        Text(
          t.formattedAmount,
          key: const ValueKey('detail-amount'),
          style: TextStyle(
            fontSize: 36,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        const SizedBox(height: 8),
        Text(t.category.labelFr, style: const TextStyle(fontSize: 18)),
        Text(t.formattedDate),
        if (t.transcriptFr.isNotEmpty) ...[
          const SizedBox(height: 16),
          TranscriptTranslationView(
            transcriptFr: t.transcriptFr,
            transcriptLocal: t.transcriptLocal,
          ),
        ],
        const SizedBox(height: 32),
        if (t.audioPath != null)
          FilledButton.icon(
            key: const ValueKey('detail-play'),
            onPressed: () async {
              final result = await actions.play(t);
              final failure = result.getFailureOrNull();
              if (failure != null && context.mounted) {
                showFailure(context, failure);
              }
            },
            icon: const Icon(Icons.play_arrow),
            label: const Tr('detail.listen'),
          ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          key: const ValueKey('detail-edit'),
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => TransactionEditScreen(transaction: t),
            ),
          ),
          icon: const Icon(Icons.edit),
          label: const Tr('common.edit'),
        ),
        const SizedBox(height: 12),
        TextButton.icon(
          key: const ValueKey('detail-delete'),
          style: TextButton.styleFrom(
            foregroundColor: Theme.of(context).colorScheme.error,
          ),
          onPressed: () => _delete(context, ref),
          icon: const Icon(Icons.delete_outline),
          label: const Tr('common.delete'),
        ),
      ],
    );
  }

  Future<void> _delete(BuildContext context, WidgetRef ref) async {
    for (final question in const [
      'Supprimer cette opération ?',
      'Vraiment ? Elle ne pourra pas être récupérée.',
    ]) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          content: Text(question, style: const TextStyle(fontSize: 18)),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Tr('common.no'),
            ),
            FilledButton(
              key: const ValueKey('confirm-delete'),
              onPressed: () => Navigator.of(context).pop(true),
              child: const Tr('common.yes'),
            ),
          ],
        ),
      );
      if (ok != true || !context.mounted) return;
    }
    final result = await ref
        .read(transactionActionsProvider)
        .delete(transaction.id);
    if (!context.mounted) return;
    final failure = result.getFailureOrNull();
    if (failure != null) {
      showFailure(context, failure);
    } else {
      Navigator.of(context).pop();
    }
  }
}
