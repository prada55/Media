// lib/features/settings/presentation/widgets/settings_profile_section.dart
//
// Profil : langue, numéro masqué, biométrie, changement de code.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/presentation/failure_snackbar.dart';
import 'package:yako/core/presentation/l10n.dart';
import 'package:yako/features/auth/presentation/providers/auth_providers.dart';
import 'package:yako/features/auth/presentation/screens/biometric_prompt_screen.dart';
import 'package:yako/features/auth/presentation/widgets/language_selector.dart';
import 'package:yako/features/settings/presentation/providers/settings_providers.dart';
import 'package:yako/features/settings/presentation/screens/change_pin_screen.dart';
import 'package:yako/features/settings/presentation/widgets/settings_section.dart';
import 'package:yako/features/translation/presentation/providers/translation_providers.dart';

/// Profile settings.
class SettingsProfileSection extends ConsumerWidget {
  const SettingsProfileSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider).value;
    final phone = ref.watch(maskedPhoneProvider).value;
    return SettingsSection(
      titleKey: 'settings.profile',
      children: [
        const ListTile(title: Tr('settings.language')),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: LanguageSelector(
            selected: ref.watch(currentLanguageProvider),
            onChanged: ref.read(currentLanguageProvider.notifier).select,
          ),
        ),
        ListTile(
          leading: const Icon(Icons.phone),
          title: const Tr('settings.phone'),
          trailing: Text(
            phone ?? '••••',
            key: const ValueKey('settings-phone'),
            style: const TextStyle(fontSize: 18, letterSpacing: 1),
          ),
        ),
        SwitchListTile(
          key: const ValueKey('settings-biometrics'),
          secondary: const Icon(Icons.fingerprint),
          title: const Tr('settings.biometrics'),
          value: user?.biometricEnabled ?? false,
          onChanged: (on) async {
            final controller = ref.read(authStateProvider.notifier);
            final result = on
                ? await controller.enableBiometrics(
                    reason: BiometricPromptScreen.reason,
                  )
                : await controller.disableBiometrics();
            final failure = result.getFailureOrNull();
            if (failure != null && context.mounted) {
              showFailure(context, failure);
            }
          },
        ),
        ListTile(
          leading: const Icon(Icons.pin),
          title: const Tr('settings.change_pin'),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => const ChangePinScreen()),
          ),
        ),
      ],
    );
  }
}
