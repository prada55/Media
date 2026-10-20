// test/features/settings/settings_screen_test.dart

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/features/auth/domain/entities/user.dart';
import 'package:yako/features/auth/presentation/providers/auth_providers.dart';
import 'package:yako/features/consent/domain/entities/consent_state.dart';
import 'package:yako/features/consent/domain/repositories/consent_repository.dart';
import 'package:yako/features/consent/presentation/providers/consent_providers.dart';
import 'package:yako/features/settings/presentation/providers/settings_providers.dart';
import 'package:yako/features/settings/presentation/screens/settings_screen.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';

import '../../helpers/l10n.dart';

class _FakeConsents implements ConsentRepository {
  ConsentState state = const ConsentState();
  final _changes = StreamController<ConsentState>.broadcast();

  Future<Result<ConsentState>> _emit(ConsentState next) async {
    state = next;
    _changes.add(next);
    return Success(next);
  }

  @override
  Future<Result<ConsentState>> getConsentState() async => Success(state);

  @override
  Future<Result<ConsentState>> setCreditScoreSharing({required bool value}) =>
      _emit(
        ConsentState(
          creditScoreSharing: value,
          promotions: state.promotions,
          diagnostics: state.diagnostics,
        ),
      );

  @override
  Future<Result<ConsentState>> setPromotions({required bool value}) => _emit(
    ConsentState(
      creditScoreSharing: state.creditScoreSharing,
      promotions: value,
      diagnostics: state.diagnostics,
    ),
  );

  @override
  Future<Result<ConsentState>> setDiagnostics({required bool value}) => _emit(
    ConsentState(
      creditScoreSharing: state.creditScoreSharing,
      promotions: state.promotions,
      diagnostics: value,
    ),
  );

  @override
  Future<Result<ConsentState>> revokeAll() => _emit(const ConsentState());

  @override
  Stream<ConsentState> watch() async* {
    yield state;
    yield* _changes.stream;
  }
}

final _user = User(
  id: 'u1',
  phoneHash: 'h',
  language: LanguageCode.fr,
  biometricEnabled: false,
  createdAt: DateTime(2026),
);

void main() {
  setUpAll(loadTestL10n);

  Future<_FakeConsents> pump(WidgetTester tester) async {
    final consents = _FakeConsents();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          consentRepositoryProvider.overrideWithValue(consents),
          currentUserProvider.overrideWith((ref) => Stream.value(_user)),
          maskedPhoneProvider.overrideWith((ref) async => '01••••••45'),
        ],
        child: const MaterialApp(home: SettingsScreen()),
      ),
    );
    await tester.pumpAndSettle();
    return consents;
  }

  testWidgets('profile shows the masked phone number', (tester) async {
    await pump(tester);
    expect(find.text('Profil'), findsOneWidget);
    expect(find.text('01••••••45'), findsOneWidget);
  });

  testWidgets('three consents, all OFF by default', (tester) async {
    await pump(tester);
    for (final key in ConsentKey.values) {
      final tile = tester.widget<SwitchListTile>(
        find.descendant(
          of: find.byKey(ValueKey('consent-${key.code}')),
          matching: find.byType(SwitchListTile),
        ),
      );
      expect(tile.value, isFalse, reason: key.code);
    }
  });

  testWidgets('one tap grants, « Tout désactiver » revokes', (tester) async {
    final consents = await pump(tester);
    final promotions = find.descendant(
      of: find.byKey(const ValueKey('consent-promotions')),
      matching: find.byType(Switch),
    );
    await tester.ensureVisible(promotions);
    await tester.pumpAndSettle();
    await tester.tap(promotions);
    await tester.pumpAndSettle();
    expect(consents.state.promotions, isTrue);
    expect(consents.state.creditScoreSharing, isFalse);

    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('consent-revoke-all')),
      200,
    );
    await tester.tap(find.byKey(const ValueKey('consent-revoke-all')));
    await tester.pumpAndSettle();
    expect(consents.state.anyGranted, isFalse);
  });

  testWidgets('data and about sections are present in order', (tester) async {
    await pump(tester);
    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('settings-version')),
      300,
    );
    expect(find.text('Mes données'), findsOneWidget);
    expect(find.text('À propos'), findsOneWidget);
    expect(find.text('1.0.0'), findsOneWidget);
    final dataY = tester.getTopLeft(find.text('Mes données')).dy;
    final aboutY = tester.getTopLeft(find.text('À propos')).dy;
    expect(dataY, lessThan(aboutY));
  });
}
