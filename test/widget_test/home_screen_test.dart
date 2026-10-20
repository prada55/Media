// test/widget_test/home_screen_test.dart

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yako/features/auth/domain/entities/user.dart';
import 'package:yako/features/auth/presentation/providers/auth_providers.dart';
import 'package:yako/features/transactions/domain/entities/transaction.dart';
import 'package:yako/features/transactions/domain/entities/transaction_draft.dart';
import 'package:yako/features/transactions/presentation/providers/transaction_providers.dart';
import 'package:yako/features/transactions/presentation/screens/home_screen.dart';
import 'package:yako/features/transactions/presentation/screens/record_screen.dart';
import 'package:yako/features/transactions/presentation/widgets/transaction_card.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';

import '../helpers/fake_transaction_repository.dart';
import '../helpers/mocks.dart';

final _user = User(
  id: 'u1',
  phoneHash: 'h',
  language: LanguageCode.fr,
  biometricEnabled: false,
  createdAt: DateTime(2026),
);

Transaction _tx(String id, TransactionType type, int amount) => Transaction(
  id: id,
  type: type,
  amount: amount,
  category: type == TransactionType.sale
      ? TransactionCategory.saleDrinks
      : TransactionCategory.expenseStock,
  transcriptFr: 'note $id',
  createdAt: DateTime.now(),
  updatedAt: DateTime.now(),
);

Widget _app(FakeTransactionRepository repo) => ProviderScope(
  overrides: [
    transactionRepositoryProvider.overrideWithValue(repo),
    currentUserProvider.overrideWith((ref) => Stream.value(_user)),
    voiceServiceProvider.overrideWithValue(MockVoiceService()),
  ],
  child: const MaterialApp(home: HomeScreen()),
);

void main() {
  testWidgets('empty state with the micro button', (tester) async {
    await tester.pumpWidget(_app(FakeTransactionRepository()));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('home-empty')), findsOneWidget);
    expect(find.byKey(const ValueKey('micro-fab')), findsOneWidget);
    expect(find.text('0 FCFA'), findsNWidgets(3));
  });

  testWidgets('feed and totals', (tester) async {
    final repo = FakeTransactionRepository([
      _tx('a', TransactionType.sale, 25000),
      _tx('b', TransactionType.expense, 5000),
    ]);
    await tester.pumpWidget(_app(repo));
    await tester.pumpAndSettle();

    expect(find.byType(TransactionCard), findsNWidgets(2));
    expect(find.text('+ 25 000 FCFA'), findsOneWidget);
    expect(find.text('− 5 000 FCFA'), findsOneWidget);
    final balance = find.descendant(
      of: find.byKey(const ValueKey('totals-balance')),
      matching: find.text('20 000 FCFA'),
    );
    expect(balance, findsOneWidget);
  });

  testWidgets('feed updates when a transaction is added', (tester) async {
    final repo = FakeTransactionRepository();
    await tester.pumpWidget(_app(repo));
    await tester.pumpAndSettle();
    await repo.create(
      const TransactionDraft(
        type: TransactionType.sale,
        amount: 1000,
        category: TransactionCategory.saleFood,
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(TransactionCard), findsOneWidget);
  });

  testWidgets('tapping the micro opens the record screen', (tester) async {
    await tester.pumpWidget(_app(FakeTransactionRepository()));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('micro-fab')));
    await tester.pumpAndSettle();
    expect(find.byType(RecordScreen), findsOneWidget);
    expect(find.byKey(const ValueKey('record-instructions')), findsOneWidget);
  });
}
