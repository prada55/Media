// lib/features/auth/presentation/widgets/pin_keypad.dart
//
// Pavé numérique géant (cibles de 72 dp) adapté aux utilisateurs peu
// alphabétisés : chiffres seuls, effacement par icône.

import 'package:flutter/material.dart';

/// Large numeric keypad.
class PinKeypad extends StatelessWidget {
  const PinKeypad({
    required this.onDigit,
    required this.onBackspace,
    this.enabled = true,
    super.key,
  });

  final ValueChanged<String> onDigit;
  final VoidCallback onBackspace;
  final bool enabled;

  static const List<List<String>> _rows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', '<'],
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final row in _rows)
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [for (final key in row) _buildKey(context, key)],
          ),
      ],
    );
  }

  Widget _buildKey(BuildContext context, String key) {
    if (key.isEmpty) return const SizedBox(width: 88, height: 80);
    final isBack = key == '<';
    return Padding(
      padding: const EdgeInsets.all(4),
      child: SizedBox(
        width: 80,
        height: 72,
        child: TextButton(
          key: ValueKey('pin-key-$key'),
          onPressed: !enabled
              ? null
              : isBack
              ? onBackspace
              : () => onDigit(key),
          child: isBack
              ? const Icon(
                  Icons.backspace_outlined,
                  size: 28,
                  semanticLabel: 'Effacer',
                )
              : Text(key, style: const TextStyle(fontSize: 30)),
        ),
      ),
    );
  }
}
