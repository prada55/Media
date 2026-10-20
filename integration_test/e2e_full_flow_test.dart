// integration_test/e2e_full_flow_test.dart
//
// Parcours complet : onboarding → inscription → biométrie refusée →
// accueil vide → création d'une opération → verrouillage automatique →
// déverrouillage → consentement → export CSV chiffré → suppression du
// compte → base effacée.
//
// Lancer : flutter test integration_test/e2e_full_flow_test.dart -d <device>

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:yako/core/security/encryption_service_impl.dart';
import 'package:yako/features/settings/data/services/export_service.dart';
import 'package:yako/features/transactions/presentation/screens/home_screen.dart';
import 'package:yako/features/transactions/presentation/widgets/transaction_card.dart';

import '../test/helpers/auth_harness.dart';
import '../test/helpers/fake_transaction_repository.dart';
import 'support/e2e_app.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('full offline journey', (tester) async {
    final app = (await tester.runAsync(E2eApp.create))!;
    addTearDown(() => tester.runAsync(app.dispose));
    final h = app.harness;

    await tester.pumpWidget(app.widget);
    await settleIo(tester);

    // 1. Onboarding + inscription.
    await tester.tap(find.byKey(const ValueKey('onboarding-start')));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('phone-field')),
      kTestPhone,
    );
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('phone-continue')));
    await tester.pumpAndSettle();
    await typePin(tester, kTestPin);
    await typePin(tester, kTestPin);
    await settleIo(tester);
    await tester.pumpAndSettle();

    // 2. Biométrie refusée.
    await tester.tap(find.byKey(const ValueKey('biometric-later')));
    await tester.pumpAndSettle();

    // 3. Accueil vide.
    expect(find.byType(HomeScreen), findsOneWidget);
    await settleIo(tester, rounds: 3);
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('home-empty')), findsOneWidget);

    // 4. Création d'une opération (saisie manuelle).
    await tester.tap(find.byKey(const ValueKey('micro-fab')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('type-manually')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey('form-amount')), '25000');
    await tester.enterText(
      find.byKey(const ValueKey('form-transcript')),
      'trois sacs de riz',
    );
    await tester.pump();
    await tester.ensureVisible(find.byKey(const ValueKey('form-save')));
    await tester.tap(find.byKey(const ValueKey('form-save')));
    await settleIo(tester);
    await tester.pumpAndSettle();
    expect(find.byType(TransactionCard), findsOneWidget);
    expect(find.text('+ 25 000 FCFA'), findsOneWidget);

    // 5. Verrouillage automatique après 2 min d'inactivité.
    await tester.pump(const Duration(minutes: 2, seconds: 1));
    await tester.pumpAndSettle();
    expect(find.text('Yako est verrouillé'), findsOneWidget);
    expect(app.session.dataKey, isNull);

    // 6. Déverrouillage.
    await typePin(tester, kTestPin);
    await settleIo(tester);
    await tester.pumpAndSettle();
    expect(find.byType(HomeScreen), findsOneWidget);

    // 7. Consentement.
    await tester.tap(find.byKey(const ValueKey('home-menu')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Réglages'));
    await settleIo(tester, rounds: 3);
    await tester.pumpAndSettle();
    final promotions = find.descendant(
      of: find.byKey(const ValueKey('consent-promotions')),
      matching: find.byType(Switch),
    );
    await tester.ensureVisible(promotions);
    await tester.pumpAndSettle();
    await tester.tap(promotions);
    await settleIo(tester, rounds: 3);
    await tester.pumpAndSettle();
    // The switch reflects the Drift `consent` table stream: ON is persisted.
    expect(tester.widget<Switch>(promotions).value, isTrue);
    final credit = find.descendant(
      of: find.byKey(const ValueKey('consent-credit_score_sharing')),
      matching: find.byType(Switch),
    );
    expect(tester.widget<Switch>(credit).value, isFalse);

    // 8. Export CSV chiffré.
    await tester.ensureVisible(find.byKey(const ValueKey('settings-export')));
    await tester.tap(find.byKey(const ValueKey('settings-export')));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('export-password')),
      'motdepasse-e2e',
    );
    await tester.enterText(
      find.byKey(const ValueKey('export-confirm')),
      'motdepasse-e2e',
    );
    await tester.tap(find.byKey(const ValueKey('export-action')));
    await settleIo(tester, rounds: 20);
    await tester.pumpAndSettle();
    expect(app.shared, hasLength(1));
    final csv = (await tester.runAsync(
      () => ExportService(
        transactions: FakeTransactionRepository(),
        encryption: h.encryption,
      ).decrypt(app.shared.single.readAsBytesSync(), 'motdepasse-e2e'),
    ))!;
    expect(csv.getOrNull(), contains('25000'));
    expect(csv.getOrNull(), contains('trois sacs de riz'));

    // 9. Suppression du compte.
    final oldDbKey = h.storageValues[kDbKeyStorageKey];
    expect(oldDbKey, isNotNull);
    await tester.ensureVisible(find.byKey(const ValueKey('settings-delete')));
    await tester.tap(find.byKey(const ValueKey('settings-delete')));
    await tester.pumpAndSettle();
    await typePin(tester, kTestPin);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('confirm-Continuer')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('confirm-Supprimer')));
    await settleUntil(tester, find.byKey(const ValueKey('onboarding-start')));
    await tester.pumpAndSettle();

    // 10. Base effacée, retour à l'accueil d'inscription.
    expect(find.byKey(const ValueKey('onboarding-start')), findsOneWidget);
    // The old database was overwritten and deleted with its key; the app
    // immediately reopened a brand-new EMPTY database under a NEW key.
    expect(h.storageValues[kDbKeyStorageKey], isNot(oldDbKey));
    expect(h.storageValues.keys, isNot(contains('yako.data_key.pin')));
    expect(h.storageValues.keys, isNot(contains('yako.phone_hint')));
    expect(app.session.current.user, isNull);
    final registered = h.repository.hasRegisteredUser();
    await settleIo(tester, rounds: 3);
    expect((await registered).getOrNull(), isFalse);

    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 2));
    await h.databaseManager.close();
  });
}
