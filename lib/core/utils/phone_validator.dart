// lib/core/utils/phone_validator.dart
//
// Numéros ivoiriens (plan à 10 chiffres depuis 2021) : « +225 » suivi de
// 10 chiffres, ou 10 chiffres seuls, préfixe 01 (Moov), 05 (MTN),
// 07 (Orange) ou 27 (fixe).

import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';

/// Validates and normalizes Ivorian phone numbers.
abstract final class PhoneValidator {
  static const Set<String> allowedPrefixes = {'01', '05', '07', '27'};

  static final RegExp _separators = RegExp(r'[\s.\-()]');
  static final RegExp _tenDigits = RegExp(r'^\d{10}$');

  /// Returns the 10-digit national number, or a [ValidationFailure].
  static Result<String> normalize(String input) {
    var digits = input.replaceAll(_separators, '');
    if (digits.startsWith('+225')) {
      digits = digits.substring(4);
    } else if (digits.startsWith('00225')) {
      digits = digits.substring(5);
    }
    if (!_tenDigits.hasMatch(digits)) {
      return const FailureResult(
        ValidationFailure(
          technicalMessage: 'Phone must have 10 digits',
          userMessageFr: 'Le numéro doit avoir 10 chiffres.',
        ),
      );
    }
    if (!allowedPrefixes.contains(digits.substring(0, 2))) {
      return const FailureResult(
        ValidationFailure(
          technicalMessage: 'Unknown phone prefix',
          userMessageFr: 'Le numéro doit commencer par 01, 05, 07 ou 27.',
        ),
      );
    }
    return Success(digits);
  }

  /// Masked form for display, e.g. `01••••••45`.
  static String mask(String nationalNumber) {
    if (nationalNumber.length < 4) return '••••';
    final start = nationalNumber.substring(0, 2);
    final end = nationalNumber.substring(nationalNumber.length - 2);
    return '$start${'•' * (nationalNumber.length - 4)}$end';
  }
}
