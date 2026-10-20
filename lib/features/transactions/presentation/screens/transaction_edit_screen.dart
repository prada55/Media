// lib/features/transactions/presentation/screens/transaction_edit_screen.dart
//
// Modification d'une opération existante.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/presentation/failure_snackbar.dart';
import 'package:yako/core/presentation/l10n.dart';
import 'package:yako/features/transactions/domain/entities/transaction.dart';
import 'package:yako/features/transactions/presentation/providers/transaction_actions.dart';
import 'package:yako/features/transactions/presentation/widgets/transaction_form.dart';

/// Edit form.
class TransactionEditScreen extends ConsumerWidget {
  const TransactionEditScreen({required this.transaction, super.key});

  final Transaction transaction;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Tr('common.edit')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TransactionForm(
              initial: transaction,
              onSubmit: (values) async {
                final result = await ref
                    .read(transactionActionsProvider)
                    .update(
                      transaction,
                      type: values.type,
                      amount: values.amount,
                      category: values.category,
                      transcript: values.transcript,
                    );
                if (!context.mounted) return;
                final failure = result.getFailureOrNull();
                if (failure != null) {
                  showFailure(context, failure);
                } else {
                  Navigator.of(context).pop();
                }
              },
            ),
          ],
        ),
      ),
    );
  }
}
