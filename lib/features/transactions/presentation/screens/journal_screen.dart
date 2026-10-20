// lib/features/transactions/presentation/screens/journal_screen.dart
//
// Journal : recherche par mot-clé + filtres période / type.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/features/transactions/domain/entities/transaction.dart';
import 'package:yako/features/transactions/domain/value_objects/transaction_filter.dart';
import 'package:yako/features/transactions/presentation/providers/transaction_providers.dart';
import 'package:yako/features/transactions/presentation/screens/transaction_detail_screen.dart';
import 'package:yako/features/transactions/presentation/widgets/transaction_card.dart';

/// Filterable transactions journal.
class JournalScreen extends ConsumerWidget {
  const JournalScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filter = ref.watch(transactionFilterProvider);
    final filterCtrl = ref.read(transactionFilterProvider.notifier);
    final results = ref.watch(filteredTransactionsProvider);
    final totals = ref.watch(transactionTotalsProvider(filter)).value;
    return Scaffold(
      appBar: AppBar(title: const Text('Journal')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              key: const ValueKey('journal-search'),
              onChanged: ref.read(searchQueryProvider.notifier).set,
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                hintText: 'Chercher (riz, 5000, transport…)',
                border: OutlineInputBorder(),
              ),
            ),
          ),
          _Chips(
            children: [
              for (final period in TransactionPeriod.values)
                ChoiceChip(
                  label: Text(period.labelFr),
                  selected: filter.period == period,
                  onSelected: (_) => filterCtrl.setPeriod(period),
                ),
            ],
          ),
          _Chips(
            children: [
              ChoiceChip(
                label: const Text('Tout'),
                selected: filter.type == null,
                onSelected: (_) => filterCtrl.setType(null),
              ),
              for (final type in TransactionType.values)
                ChoiceChip(
                  key: ValueKey('journal-type-${type.code}'),
                  label: Text(type.labelFr),
                  selected: filter.type == type,
                  onSelected: (_) => filterCtrl.setType(type),
                ),
            ],
          ),
          if (totals != null)
            Padding(
              padding: const EdgeInsets.all(8),
              child: Text(
                'Solde : ${Transaction.formatFcfa(totals.balance)}',
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
          Expanded(
            child: results.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, _) =>
                  const Center(child: Text('Recherche impossible.')),
              data: (list) => list.isEmpty
                  ? const Center(child: Text('Aucun résultat.'))
                  : ListView.builder(
                      itemCount: list.length,
                      itemBuilder: (context, i) => TransactionCard(
                        transaction: list[i],
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => TransactionDetailScreen(
                              transactionId: list[i].id,
                            ),
                          ),
                        ),
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Chips extends StatelessWidget {
  const _Chips({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Row(
        children: [
          for (final chip in children)
            Padding(padding: const EdgeInsets.only(right: 8), child: chip),
        ],
      ),
    );
  }
}
