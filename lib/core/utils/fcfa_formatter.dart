// lib/core/utils/fcfa_formatter.dart
//
// Saisie de montants FCFA : chiffres seuls, groupés par milliers avec une
// espace (« 25 000 »).

import 'package:flutter/services.dart';

/// Groups digits by thousands while typing.
class FcfaInputFormatter extends TextInputFormatter {
  const FcfaInputFormatter();

  static const int maxDigits = 10;

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    var digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    if (digits.length > maxDigits) digits = digits.substring(0, maxDigits);
    digits = digits.replaceFirst(RegExp('^0+(?=.)'), '');
    final formatted = group(digits);
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }

  /// `25000` → `25 000`.
  static String group(String digits) {
    final buffer = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(' ');
      buffer.write(digits[i]);
    }
    return buffer.toString();
  }

  /// Parses a formatted amount, `null` when empty or zero.
  static int? parse(String text) {
    final value = int.tryParse(text.replaceAll(RegExp(r'\D'), ''));
    return value == null || value <= 0 ? null : value;
  }
}
