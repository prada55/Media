// lib/features/transactions/presentation/screens/home_screen.dart
//
// Accueil : totaux du jour en tête, fil des opérations (les plus récentes
// d'abord), gros micro central en bas, tirer pour rafraîchir.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/constants/app_strings.dart';
import 'package:yako/features/auth/presentation/providers/auth_providers.dart';
import 'package:yako/features/transactions/domain/entities/transaction.dart';
import 'package:yako/features/transactions/presentation/providers/transaction_providers.dart';
import 'package:yako/features/transactions/presentation/screens/home_menu.dart';
import 'package:yako/features/transactions/presentation/screens/journal_screen.dart';
import 'package:yako/features/transactions/presentation/screens/record_screen.dart';
import 'package:yako/features/transactions/presentation/screens/transaction_detail_screen.dart';
import 'package:yako/features/transactions/presentation/widgets/micro_fab.dart';
import 'package:yako/features/transactions/presentation/widgets/totals_header.dart';
import 'package:yako/features/transactions/presentation/widgets/transaction_card.dart';

/// Home screen.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recent = ref.watch(recentTransactionsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text(AppStrings.appName),
        actions: [
          IconButton(
            key: const ValueKey('home-journal'),
            tooltip: 'Journal',
            icon: const Icon(Icons.list_alt),
            onPressed: () => _push(context, const JournalScreen()),
          ),
          IconButton(
            key: const ValueKey('home-lock'),
            tooltip: 'Verrouiller',
            icon: const Icon(Icons.lock_outline),
            onPressed: ref.read(authStateProvider.notifier).lock,
          ),
          const HomeMenu(),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(recentTransactionsProvider),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            const SliverToBoxAdapter(child: TotalsHeader()),
            ...recent.when(
              loading: () => const [
                SliverFillRemaining(
                  child: Center(child: CircularProgressIndicator()),
                ),
              ],
              error: (_, _) => const [
                SliverFillRemaining(
                  child: Center(child: Text('Données indisponibles.')),
                ),
              ],
              data: (list) => list.isEmpty
                  ? const [SliverFillRemaining(child: _EmptyFeed())]
                  : [_feed(context, list)],
            ),
            const SliverToBoxAdapter(
              child: SizedBox(height: MicroFab.size + 32),
            ),
          ],
        ),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: MicroFab(
        onTap: () => _push(context, const RecordScreen()),
        onLongPressStart: () => _push(context, const RecordScreen()),
      ),
    );
  }

  Widget _feed(BuildContext context, List<Transaction> list) =>
      SliverList.builder(
        itemCount: list.length,
        itemBuilder: (context, i) => TransactionCard(
          transaction: list[i],
          onTap: () => _push(
            context,
            TransactionDetailScreen(transactionId: list[i].id),
          ),
        ),
      );

  static void _push(BuildContext context, Widget screen) {
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));
  }
}

class _EmptyFeed extends StatelessWidget {
  const _EmptyFeed();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.mic_none, size: 64),
          SizedBox(height: 12),
          Text(
            'Aucune opération pour le moment.\n'
            'Appuyez sur le micro pour commencer.',
            key: ValueKey('home-empty'),
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 18),
          ),
        ],
      ),
    );
  }
}
