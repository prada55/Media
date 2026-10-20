// lib/features/auth/presentation/screens/biometric_prompt_screen.dart
//
// Proposé une fois après l'inscription : activer l'empreinte / le visage,
// ou « Plus tard ».

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/presentation/failure_snackbar.dart';
import 'package:yako/core/presentation/l10n.dart';
import 'package:yako/features/auth/presentation/providers/auth_providers.dart';

/// Biometric opt-in offer.
class BiometricPromptScreen extends ConsumerWidget {
  const BiometricPromptScreen({super.key});

  static const String reason = 'Confirmez pour ouvrir Yako sans code.';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              Icon(
                Icons.fingerprint,
                size: 120,
                color: theme.colorScheme.primary,
              ),
              const SizedBox(height: 24),
              Text(
                'Ouvrir Yako avec votre empreinte ou votre visage ?',
                style: theme.textTheme.titleLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              const Text(
                'Votre empreinte reste dans le téléphone. '
                'Yako ne la voit jamais.',
                textAlign: TextAlign.center,
              ),
              const Spacer(),
              FilledButton(
                key: const ValueKey('biometric-enable'),
                onPressed: () => _enable(context, ref),
                child: const Tr('biometric.enable'),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                key: const ValueKey('biometric-later'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(64, 56),
                ),
                onPressed: ref
                    .read(authStateProvider.notifier)
                    .dismissBiometricOffer,
                child: const Tr('biometric.later'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _enable(BuildContext context, WidgetRef ref) async {
    final controller = ref.read(authStateProvider.notifier);
    final result = await controller.enableBiometrics(reason: reason);
    final failure = result.getFailureOrNull();
    if (failure != null && context.mounted) showFailure(context, failure);
    controller.dismissBiometricOffer();
  }
}
