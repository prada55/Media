// lib/features/auth/presentation/widgets/lockout_banner.dart
//
// Bandeau de verrouillage avec compte à rebours (mm:ss).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/features/auth/presentation/providers/auth_providers.dart';

/// Shows the remaining lockout time, or nothing.
class LockoutBanner extends ConsumerWidget {
  const LockoutBanner({super.key});

  static String format(Duration d) {
    final minutes = d.inMinutes.toString().padLeft(2, '0');
    final seconds = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final remaining = ref.watch(lockoutRemainingProvider).value;
    if (remaining == null) return const SizedBox.shrink();
    final scheme = Theme.of(context).colorScheme;
    return Container(
      key: const ValueKey('lockout-banner'),
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      color: scheme.errorContainer,
      child: Row(
        children: [
          Icon(Icons.lock_clock, color: scheme.onErrorContainer, size: 32),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'Trop d’essais. Réessayez dans ${format(remaining)}',
              style: TextStyle(color: scheme.onErrorContainer, fontSize: 18),
            ),
          ),
        ],
      ),
    );
  }
}
