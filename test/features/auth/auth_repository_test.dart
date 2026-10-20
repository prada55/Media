// test/features/auth/auth_repository_test.dart

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/core/security/encryption_service_impl.dart';
import 'package:yako/core/security/key_vault.dart';
import 'package:yako/features/auth/domain/entities/auth_session.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';

import '../../helpers/auth_harness.dart';

void main() {
  late AuthHarness h;

  setUp(() async => h = await AuthHarness.create());
  tearDown(() => h.dispose());

  Future<AuthSession> register() async {
    final result = await h.repository.register(
      phone: '+225 01 00 00 00 00',
      pin: kTestPin,
      language: LanguageCode.dyu,
    );
    return result.getOrNull()!;
  }

  Future<Result<AuthSession>> badLogin() =>
      h.repository.login(phone: kTestPhone, pin: '777123');

  group('register', () {
    test('invalid phone number → ValidationFailure', () async {
      for (final phone in ['123', '0900000000', '+2250100']) {
        final result = await h.repository.register(
          phone: phone,
          pin: kTestPin,
          language: LanguageCode.fr,
        );
        expect(
          result.getFailureOrNull(),
          isA<ValidationFailure>(),
          reason: phone,
        );
      }
    });

    test('trivial PIN or PIN from the phone → ValidationFailure', () async {
      for (final pin in ['000000', '123456', '111111', '654321', '100000']) {
        final result = await h.repository.register(
          phone: kTestPhone,
          pin: pin,
          language: LanguageCode.fr,
        );
        expect(
          result.getFailureOrNull(),
          isA<ValidationFailure>(),
          reason: pin,
        );
      }
    });

    test('OK: only hashes stored, data key wrapped', () async {
      final session = await register();
      expect(session.user.language, LanguageCode.dyu);
      expect(base64Decode(session.dataKey), hasLength(32));

      final db = (await h.databaseManager.open()).getOrNull()!;
      final row = await db.select(db.users).getSingle();
      expect(row.phoneHash, isNot(contains('0100000000')));
      expect(row.pinHash, isNot(kTestPin));
      expect(h.storageValues[KeyVault.wrappedDataKey], isNotNull);
      expect(h.storageValues[KeyVault.wrappedDataKey], isNot(session.dataKey));
      expect(h.storageValues[kDbKeyStorageKey], isNotNull);
      expect(h.storageValues[KeyVault.biometricDataKey], isNull);
    });

    test('second registration is refused', () async {
      await register();
      final again = await h.repository.register(
        phone: '0700000001',
        pin: '814726',
        language: LanguageCode.fr,
      );
      expect(again.getFailureOrNull(), isA<ValidationFailure>());
    });
  });

  group('login and lockout', () {
    test('right credentials return the same data key', () async {
      final session = await register();
      final login = await h.repository.login(phone: kTestPhone, pin: kTestPin);
      expect(login.getOrNull()!.dataKey, session.dataKey);
    });

    test('wrong PIN → AuthenticationFailure with attempts left', () async {
      await register();
      final failure = (await badLogin()).getFailureOrNull();
      expect(failure, isA<AuthenticationFailure>());
      expect((failure! as AuthenticationFailure).remainingAttempts, 4);
    });

    test('wrong phone with right PIN fails too', () async {
      await register();
      final result = await h.repository.login(
        phone: '0700000000',
        pin: kTestPin,
      );
      expect(result.getFailureOrNull(), isA<AuthenticationFailure>());
    });

    test('5 failures → 30 s lockout, even with the right PIN', () async {
      await register();
      for (var i = 0; i < 4; i++) {
        expect(
          (await badLogin()).getFailureOrNull(),
          isA<AuthenticationFailure>(),
        );
      }
      final fifth = (await badLogin()).getFailureOrNull();
      expect(fifth, isA<LockedOutFailure>());
      expect(
        (fifth! as LockedOutFailure).remaining,
        const Duration(seconds: 30),
      );

      final right = await h.repository.login(phone: kTestPhone, pin: kTestPin);
      expect(right.getFailureOrNull(), isA<LockedOutFailure>());
      final remaining = await h.repository.getLockoutRemaining();
      expect(remaining.getOrNull(), const Duration(seconds: 30));
    });

    test('lockout grows 30 s → 1 min → 5 min', () async {
      await register();
      for (var i = 0; i < 5; i++) {
        await badLogin();
      }
      h.now = h.now.add(const Duration(seconds: 31));
      final sixth = (await badLogin()).getFailureOrNull()! as LockedOutFailure;
      expect(sixth.remaining, const Duration(minutes: 1));
      h.now = h.now.add(const Duration(minutes: 2));
      final seventh =
          (await badLogin()).getFailureOrNull()! as LockedOutFailure;
      expect(seventh.remaining, const Duration(minutes: 5));
    });

    test('expired lockout → login OK and counter reset', () async {
      await register();
      for (var i = 0; i < 5; i++) {
        await badLogin();
      }
      h.now = h.now.add(const Duration(seconds: 31));
      expect((await h.repository.getLockoutRemaining()).getOrNull(), isNull);
      final login = await h.repository.login(phone: kTestPhone, pin: kTestPin);
      expect(login.isSuccess, isTrue);
      final next =
          (await badLogin()).getFailureOrNull()! as AuthenticationFailure;
      expect(next.remainingAttempts, 4);
    });

    test('unlockWithPin uses the same rules', () async {
      final session = await register();
      expect((await h.repository.unlockWithPin('777123')).isFailure, isTrue);
      final ok = await h.repository.unlockWithPin(kTestPin);
      expect(ok.getOrNull()!.dataKey, session.dataKey);
    });
  });

  group('changePin', () {
    test('wrong current PIN → failure and counted', () async {
      await register();
      final result = await h.repository.changePin(
        currentPin: '777123',
        newPin: '582941',
      );
      expect(result.getFailureOrNull(), isA<AuthenticationFailure>());
    });

    test('trivial new PIN → ValidationFailure', () async {
      await register();
      final result = await h.repository.changePin(
        currentPin: kTestPin,
        newPin: '123456',
      );
      expect(result.getFailureOrNull(), isA<ValidationFailure>());
    });

    test('OK: old PIN refused, new PIN gives the same data key', () async {
      final session = await register();
      final changed = await h.repository.changePin(
        currentPin: kTestPin,
        newPin: '582941',
      );
      expect(changed.isSuccess, isTrue);
      expect((await h.repository.unlockWithPin(kTestPin)).isFailure, isTrue);
      final login = await h.repository.unlockWithPin('582941');
      expect(login.getOrNull()!.dataKey, session.dataKey);
    });
  });

  group('biometrics', () {
    test('enable → biometric login returns the data key', () async {
      final session = await register();
      final enabled = await h.repository.enableBiometrics(session, reason: 'r');
      expect(enabled.getOrNull()!.biometricEnabled, isTrue);
      final login = await h.repository.loginWithBiometrics(reason: 'r');
      expect(login.getOrNull()!.dataKey, session.dataKey);
    });

    test('not recognized → BiometricFailure', () async {
      final session = await register();
      await h.repository.enableBiometrics(session, reason: 'r');
      when(() => h.biometrics.authenticate(reason: any(named: 'reason')))
          .thenAnswer((_) async => false);
      final login = await h.repository.loginWithBiometrics(reason: 'r');
      expect(login.getFailureOrNull(), isA<BiometricFailure>());
    });

    test('disable removes the biometric key', () async {
      final session = await register();
      await h.repository.enableBiometrics(session, reason: 'r');
      final disabled = await h.repository.disableBiometrics();
      expect(disabled.getOrNull()!.biometricEnabled, isFalse);
      expect(h.storageValues[KeyVault.biometricDataKey], isNull);
      expect(
        (await h.repository.loginWithBiometrics(reason: 'r')).isFailure,
        isTrue,
      );
    });
  });

  group('deleteAccount', () {
    test('wrong PIN → failure, nothing deleted', () async {
      await register();
      final result = await h.repository.deleteAccount(pin: '777123');
      expect(result.isFailure, isTrue);
      expect(h.databaseFile.existsSync(), isTrue);
      expect((await h.repository.hasRegisteredUser()).getOrNull(), isTrue);
    });

    test('OK: DB files wiped, keychain emptied, fresh state', () async {
      final session = await register();
      await h.repository.enableBiometrics(session, reason: 'r');
      expect(h.databaseFile.existsSync(), isTrue);

      final result = await h.repository.deleteAccount(pin: kTestPin);

      expect(result.isSuccess, isTrue);
      expect(h.databaseFile.existsSync(), isFalse);
      expect(h.storageValues, isEmpty);
      // Reopening creates a brand new empty database with a new key.
      expect((await h.repository.hasRegisteredUser()).getOrNull(), isFalse);
      expect(h.storageValues[kDbKeyStorageKey], isNotNull);
    });
  });

  test('logout keeps the account', () async {
    await register();
    expect((await h.repository.logout()).isSuccess, isTrue);
    expect((await h.repository.getCurrentUser()).getOrNull(), isNotNull);
  });

  test('setLanguage persists', () async {
    await register();
    await h.repository.setLanguage(LanguageCode.bci);
    final user = (await h.repository.getCurrentUser()).getOrNull()!;
    expect(user.language, LanguageCode.bci);
  });

  test('audit log contains event types only', () async {
    await register();
    await badLogin();
    final db = (await h.databaseManager.open()).getOrNull()!;
    final events = await db.select(db.auditLog).get();
    expect(
      events.map((e) => e.eventType),
      containsAll(<String>['register', 'login_failure']),
    );
    for (final e in events) {
      expect(e.eventType, isNot(contains(kTestPhone)));
      expect(e.eventType, isNot(contains(kTestPin)));
    }
  });
}
