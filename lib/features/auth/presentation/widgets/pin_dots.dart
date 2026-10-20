// lib/features/auth/presentation/widgets/pin_dots.dart
//
// Six points : plein = chiffre saisi. Le dernier chiffre tapé reste
// visible 500 ms pour rassurer l'utilisateur, puis il est masqué.

import 'dart:async';

import 'package:flutter/material.dart';

/// Visual PIN progress indicator.
class PinDots extends StatefulWidget {
  const PinDots({required this.pin, this.length = 6, super.key});

  final String pin;
  final int length;

  @override
  State<PinDots> createState() => _PinDotsState();
}

class _PinDotsState extends State<PinDots> {
  bool _revealLast = false;
  Timer? _timer;

  @override
  void didUpdateWidget(PinDots oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.pin.length > oldWidget.pin.length) {
      _timer?.cancel();
      // Pure UI state: briefly show the last typed digit.
      setState(() => _revealLast = true);
      _timer = Timer(const Duration(milliseconds: 500), () {
        if (mounted) setState(() => _revealLast = false);
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      label: '${widget.pin.length} chiffres sur ${widget.length}',
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(widget.length, (i) {
          final filled = i < widget.pin.length;
          final isLast = i == widget.pin.length - 1;
          return Container(
            key: ValueKey('pin-dot-$i'),
            margin: const EdgeInsets.symmetric(horizontal: 8),
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: filled && !(isLast && _revealLast)
                  ? scheme.primary
                  : Colors.transparent,
              border: Border.all(color: scheme.primary, width: 2),
            ),
            child: filled && isLast && _revealLast
                ? Text(
                    widget.pin[i],
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: scheme.primary,
                    ),
                  )
                : null,
          );
        }),
      ),
    );
  }
}
