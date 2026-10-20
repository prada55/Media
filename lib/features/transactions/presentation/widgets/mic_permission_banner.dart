// lib/features/transactions/presentation/widgets/mic_permission_banner.dart
//
// Micro refusé : explication + bouton « Ouvrir les réglages ».

import 'package:flutter/material.dart';
import 'package:yako/core/presentation/l10n.dart';

/// Shown when the microphone permission is denied.
class MicPermissionBanner extends StatelessWidget {
  const MicPermissionBanner({required this.onOpenSettings, super.key});

  final VoidCallback onOpenSettings;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      key: const ValueKey('mic-permission-banner'),
      color: scheme.errorContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Icon(Icons.mic_off, size: 40, color: scheme.onErrorContainer),
            const SizedBox(height: 8),
            Text(
              'Yako a besoin du micro pour écouter vos ventes. '
              'Votre voix reste sur ce téléphone.',
              textAlign: TextAlign.center,
              style: TextStyle(color: scheme.onErrorContainer, fontSize: 16),
            ),
            const SizedBox(height: 8),
            FilledButton(
              key: const ValueKey('open-settings'),
              onPressed: onOpenSettings,
              child: const Tr('mic.open_settings'),
            ),
          ],
        ),
      ),
    );
  }
}
