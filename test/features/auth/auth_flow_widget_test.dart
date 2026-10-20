// test/features/auth/auth_flow_widget_test.dart
//
// Parcours UI : onboarding → numéro → PIN + confirmation → offre
// biométrique « Plus tard » → accueil → verrouillage → déverrouillage.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yako/features/auth/domain/services/session_manager.dart';
import 'package:yako/features/auth/presentation/providers/auth_providers.dart';
import 'package:yako/features/auth/presentation/screens/auth_gate.dart';
import 'package:yako/features/transactions/presentation/providers/transaction_providers.dart';
import 'package:yako/features/transactions/presentation/screens/home_screen.dart';

import '../../helpers/auth_harness.dart';
import '../../helpers/fake_transaction_repository.dart';
import '../../helpers/l10n.dart';

Future<void> _settle(WidgetTester tester) async {
  // PBKDF2 runs in an isolate and SQLite does real I/O: let them finish.
  for (var i = 0; i < 10; i++) {
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 100)),
    );
    await tester.pump(const Duration(milliseconds: 200));
  }
}

Future<void> _typePin(WidgetTester tester, String pin) async {
  for (final digit in pin.split('')) {
    await tester.tap(find.byKey(ValueKey('pin-key-$digit')));
    await tester.pump();
  }
  await tester.pump(const Duration(milliseconds: 200));
}

void main() {
  setUpAll(loadTestL10n);

  testWidgets('registration, biometric offer, lock and unlock', (tester) async {
    final harness = (await tester.runAsync(AuthHarness.create))!;
    addTearDown(() => tester.runAsync(harness.dispose));
    final session = SessionManager();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(harness.repository),
          sessionManagerProvider.overrideWithValue(session),
          transactionRepositoryProvider.overrideWithValue(
            FakeTransactionRepository(),
          ),
        ],
        child: const MaterialApp(home: AuthGate()),
      ),
    );
    await _settle(tester);

    expect(find.text('Commencer'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('lang-dyu')));
    await tester.tap(find.byKey(const ValueKey('onboarding-start')));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const ValueKey('phone-field')), '0900');
    await tester.pump();
    final continueButton = find.byKey(const ValueKey('phone-continue'));
    expect(tester.widget<FilledButton>(continueButton).onPressed, isNull);

    await tester.enterText(
      find.byKey(const ValueKey('phone-field')),
      kTestPhone,
    );
    await tester.pump();
    await tester.tap(continueButton);
    await tester.pumpAndSettle();

    await _typePin(tester, '123456');
    expect(find.textContaining('trop simple'), findsOneWidget);
    await tester.pump(const Duration(seconds: 5));

    await _typePin(tester, kTestPin);
    expect(find.text('Tapez encore le même code'), findsOneWidget);
    await _typePin(tester, kTestPin);
    await _settle(tester);
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('biometric-later')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('biometric-later')));
    await tester.pumpAndSettle();
    expect(find.byType(HomeScreen), findsOneWidget);
    expect(session.isActive, isTrue);

    session.lock();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('Yako est verrouillé'), findsOneWidget);

    await _typePin(tester, kTestPin);
    await _settle(tester);
    await tester.pumpAndSettle();
    expect(find.byType(HomeScreen), findsOneWidget);

    // Unmount the screens so their providers are disposed.
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 2));
    // The database was opened inside the fake-async zone: close it there.
    await harness.databaseManager.close();
  });
}
