// lib/features/auth/presentation/screens/onboarding_screen.dart
//
// Premier écran : logo, slogan, choix de langue, bouton « Commencer ».

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/constants/app_strings.dart';
import 'package:yako/core/presentation/l10n.dart';
import 'package:yako/features/auth/presentation/providers/registration_providers.dart';
import 'package:yako/features/auth/presentation/screens/phone_input_screen.dart';
import 'package:yako/features/auth/presentation/widgets/language_selector.dart';

/// Welcome screen.
class OnboardingScreen extends ConsumerWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final draft = ref.watch(registrationDraftProvider);
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const Spacer(),
              Icon(Icons.mic, size: 96, color: theme.colorScheme.primary),
              const SizedBox(height: 16),
              Text(AppStrings.appName, style: theme.textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text(
                context.tr('onboarding.slogan'),
                style: theme.textTheme.titleLarge,
                textAlign: TextAlign.center,
              ),
              const Spacer(),
              LanguageSelector(
                selected: draft.language,
                onChanged: ref
                    .read(registrationDraftProvider.notifier)
                    .setLanguage,
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  key: const ValueKey('onboarding-start'),
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => const PhoneInputScreen(),
                    ),
                  ),
                  child: const Tr('onboarding.start'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
