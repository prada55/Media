// lib/features/auth/presentation/widgets/pin_entry.dart
//
// Saisie d'un PIN à 6 chiffres (points + pavé). Le tampon de saisie est un
// état d'interface local ; le PIN complet est remis à [onCompleted] puis
// effacé.

import 'package:flutter/material.dart';
import 'package:yako/features/auth/presentation/widgets/pin_dots.dart';
import 'package:yako/features/auth/presentation/widgets/pin_keypad.dart';

/// 6-digit PIN input.
class PinEntry extends StatefulWidget {
  const PinEntry({
    required this.onCompleted,
    this.enabled = true,
    this.length = 6,
    super.key,
  });

  final ValueChanged<String> onCompleted;
  final bool enabled;
  final int length;

  @override
  State<PinEntry> createState() => _PinEntryState();
}

class _PinEntryState extends State<PinEntry> {
  String _buffer = '';

  void _onDigit(String digit) {
    if (_buffer.length >= widget.length) return;
    setState(() => _buffer += digit);
    if (_buffer.length == widget.length) {
      final pin = _buffer;
      Future<void>.delayed(const Duration(milliseconds: 150), () {
        if (!mounted) return;
        setState(() => _buffer = '');
        widget.onCompleted(pin);
      });
    }
  }

  void _onBackspace() {
    if (_buffer.isEmpty) return;
    setState(() => _buffer = _buffer.substring(0, _buffer.length - 1));
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        PinDots(pin: _buffer, length: widget.length),
        const SizedBox(height: 24),
        PinKeypad(
          enabled: widget.enabled,
          onDigit: _onDigit,
          onBackspace: _onBackspace,
        ),
      ],
    );
  }
}
