// lib/core/utils/pin_validator.dart
//
// Règles du code PIN : exactement 6 chiffres, refus des codes triviaux
// (chiffres identiques, suites croissantes/décroissantes) et des codes
// contenus dans le numéro de téléphone.

import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';

/// Validates 6-digit PINs.
abstract final class PinValidator {
  static const int length = 6;

  static final RegExp _sixDigits = RegExp(r'^\d{6}$');

  /// Returns the PIN when acceptable, otherwise a [ValidationFailure].
  /// [nationalPhone] is the 10-digit number, when known.
  static Result<String> validate(String pin, {String? nationalPhone}) {
    if (!_sixDigits.hasMatch(pin)) {
      return _fail('PIN must be 6 digits', 'Le code doit avoir 6 chiffres.');
    }
    if (_isTrivial(pin)) {
      return _fail(
        'PIN too simple',
        'Code trop simple. Évitez 000000, 123456, 111111…',
      );
    }
    if (nationalPhone != null && nationalPhone.contains(pin)) {
      return _fail(
        'PIN is part of the phone number',
        'Le code ne doit pas être votre numéro de téléphone.',
      );
    }
    return Success(pin);
  }

  static bool _isTrivial(String pin) {
    final digits = pin.codeUnits.map((c) => c - 48).toList();
    final allSame = digits.every((d) => d == digits.first);
    var ascending = true;
    var descending = true;
    for (var i = 1; i < digits.length; i++) {
      if (digits[i] != digits[i - 1] + 1) ascending = false;
      if (digits[i] != digits[i - 1] - 1) descending = false;
    }
    return allSame || ascending || descending;
  }

  static Result<String> _fail(String technical, String user) => FailureResult(
    ValidationFailure(technicalMessage: technical, userMessageFr: user),
  );
}
