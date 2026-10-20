// lib/features/transactions/presentation/widgets/totals_header.dart
//
// En-tête des totaux du jour : ventes, dépenses, solde.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/presentation/l10n.dart';
import 'package:yako/core/theme/app_colors.dart';
import 'package:yako/features/transactions/domain/entities/transaction.dart';
import 'package:yako/features/transactions/domain/value_objects/transaction_filter.dart';
import 'package:yako/features/transactions/presentation/providers/transaction_providers.dart';

/// Today's totals.
class TotalsHeader extends ConsumerWidget {
  const TotalsHeader({super.key});

  static const TransactionFilter today = TransactionFilter(
    period: TransactionPeriod.today,
  );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final totals = ref.watch(transactionTotalsProvider(today)).value;
    final balance = totals?.balance ?? 0;
    return Card(
      margin: const EdgeInsets.all(12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Tr('totals.today', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            Row(
              children: [
                _Cell(
                  label: context.tr('totals.sales'),
                  value: totals?.totalSales ?? 0,
                  color: AppColors.sale,
                  icon: Icons.arrow_downward,
                ),
                _Cell(
                  label: context.tr('totals.expenses'),
                  value: totals?.totalExpenses ?? 0,
                  color: AppColors.expense,
                  icon: Icons.arrow_upward,
                ),
                _Cell(
                  key: const ValueKey('totals-balance'),
                  label: context.tr('totals.balance'),
                  value: balance,
                  color: balance >= 0 ? AppColors.sale : AppColors.expense,
                  icon: Icons.account_balance_wallet,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell({
    required this.label,
    required this.value,
    required this.color,
    required this.icon,
    super.key,
  });

  final String label;
  final int value;
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Icon(icon, color: color, size: 28),
          Text(label),
          FittedBox(
            child: Text(
              Transaction.formatFcfa(value),
              style: TextStyle(
                color: color,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
