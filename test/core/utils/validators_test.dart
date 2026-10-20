// test/core/utils/validators_test.dart

import 'package:flutter_test/flutter_test.dart';
import 'package:yako/core/utils/phone_validator.dart';
import 'package:yako/core/utils/pin_validator.dart';
import 'package:yako/features/auth/domain/services/lockout_policy.dart';

void main() {
  group('PhoneValidator', () {
    test('accepts +225 and 10-digit formats', () {
      expect(
        PhoneValidator.normalize('+225 07 12 34 56 78').getOrNull(),
        '0712345678',
      );
      expect(PhoneValidator.normalize('0512345678').getOrNull(), '0512345678');
      expect(
        PhoneValidator.normalize('00225 27-12-34-56-78').getOrNull(),
        '2712345678',
      );
    });

    test('rejects wrong length or prefix', () {
      expect(PhoneValidator.normalize('071234567').isFailure, isTrue);
      expect(PhoneValidator.normalize('0912345678').isFailure, isTrue);
      expect(PhoneValidator.normalize('+33612345678').isFailure, isTrue);
      expect(PhoneValidator.normalize('07abc45678').isFailure, isTrue);
    });

    test('mask keeps 2 first and 2 last digits', () {
      expect(PhoneValidator.mask('0100000045'), '01••••••45');
    });
  });

  group('PinValidator', () {
    test('accepts a strong PIN', () {
      expect(PinValidator.validate('814725').isSuccess, isTrue);
    });

    test('rejects trivial and malformed PINs', () {
      for (final pin in [
        '000000',
        '123456',
        '111111',
        '999999',
        '654321',
        '12345',
        'abcdef',
      ]) {
        expect(PinValidator.validate(pin).isFailure, isTrue, reason: pin);
      }
    });

    test('rejects a PIN contained in the phone number', () {
      expect(
        PinValidator.validate('345678', nationalPhone: '0712345678').isFailure,
        isTrue,
      );
    });
  });

  group('LockoutPolicy', () {
    test('schedule', () {
      expect(LockoutPolicy.lockDurationFor(4), isNull);
      expect(LockoutPolicy.lockDurationFor(5), const Duration(seconds: 30));
      expect(LockoutPolicy.lockDurationFor(6), const Duration(minutes: 1));
      expect(LockoutPolicy.lockDurationFor(7), const Duration(minutes: 5));
      expect(LockoutPolicy.lockDurationFor(8), const Duration(minutes: 15));
      expect(LockoutPolicy.lockDurationFor(9), const Duration(minutes: 30));
      expect(LockoutPolicy.lockDurationFor(20), const Duration(minutes: 30));
      expect(LockoutPolicy.remainingBeforeLock(3), 2);
      expect(LockoutPolicy.remainingBeforeLock(9), 0);
    });
  });
}
