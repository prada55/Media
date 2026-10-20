// lib/features/transactions/presentation/widgets/micro_fab.dart
//
// Gros bouton micro (120 dp). Appui long = enregistrer, relâcher = arrêter.

import 'package:flutter/material.dart';

/// Large microphone button.
class MicroFab extends StatelessWidget {
  const MicroFab({
    this.onTap,
    this.onLongPressStart,
    this.onLongPressEnd,
    this.recording = false,
    super.key,
  });

  static const double size = 120;

  final VoidCallback? onTap;
  final VoidCallback? onLongPressStart;
  final VoidCallback? onLongPressEnd;
  final bool recording;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final color = recording ? scheme.error : scheme.primary;
    return Semantics(
      button: true,
      label: recording ? 'Relâchez pour arrêter' : 'Restez appuyé pour parler',
      child: GestureDetector(
        key: const ValueKey('micro-fab'),
        onTap: onTap,
        onLongPressStart: (_) => onLongPressStart?.call(),
        onLongPressEnd: (_) => onLongPressEnd?.call(),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          width: recording ? size * 1.1 : size,
          height: recording ? size * 1.1 : size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: color,
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: 0.4),
                blurRadius: recording ? 32 : 12,
                spreadRadius: recording ? 8 : 2,
              ),
            ],
          ),
          child: Icon(
            recording ? Icons.stop : Icons.mic,
            size: 56,
            color: scheme.onPrimary,
          ),
        ),
      ),
    );
  }
}
