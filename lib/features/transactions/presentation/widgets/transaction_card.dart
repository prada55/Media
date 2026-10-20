// lib/features/transactions/presentation/widgets/transaction_card.dart
//
// Carte d'une transaction : icône, montant coloré, catégorie, extrait.

import 'package:flutter/material.dart';
import 'package:yako/core/theme/app_colors.dart';
import 'package:yako/features/transactions/domain/entities/transaction.dart';

/// One transaction in a list.
class TransactionCard extends StatelessWidget {
  const TransactionCard({required this.transaction, this.onTap, super.key});

  final Transaction transaction;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isSale = transaction.type == TransactionType.sale;
    final color = isSale ? AppColors.sale : AppColors.expense;
    final transcript = transaction.transcriptFr;
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: ListTile(
        key: ValueKey('tx-${transaction.id}'),
        onTap: onTap,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: CircleAvatar(
          backgroundColor: color.withValues(alpha: 0.15),
          child: Icon(
            isSale ? Icons.arrow_downward : Icons.arrow_upward,
            color: color,
            semanticLabel: transaction.type.labelFr,
          ),
        ),
        title: Text(
          '${isSale ? '+' : '−'} ${transaction.formattedAmount}',
          style: TextStyle(
            color: color,
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(transaction.category.labelFr),
            if (transcript.isNotEmpty)
              Text(
                transcript,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontStyle: FontStyle.italic),
              ),
            Text(
              transaction.formattedDate,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
        trailing: transaction.audioPath == null
            ? null
            : const Icon(Icons.graphic_eq, semanticLabel: 'Audio'),
      ),
    );
  }
}
