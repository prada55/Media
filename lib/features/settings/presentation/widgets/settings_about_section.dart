// lib/features/settings/presentation/widgets/settings_about_section.dart
//
// À propos : version, politique de confidentialité, mentions légales,
// signalement (adresse copiée : aucun appel réseau depuis l'app).

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/config/app_config_provider.dart';
import 'package:yako/core/constants/app_strings.dart';
import 'package:yako/core/presentation/l10n.dart';
import 'package:yako/features/settings/presentation/screens/privacy_policy_screen.dart';
import 'package:yako/features/settings/presentation/widgets/settings_section.dart';

/// About settings.
class SettingsAboutSection extends ConsumerWidget {
  const SettingsAboutSection({super.key});

  static const String supportEmail = 'support@yako.ci';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final version = ref.watch(appConfigProvider).appVersion;
    return SettingsSection(
      titleKey: 'settings.about',
      children: [
        ListTile(
          leading: const Icon(Icons.info_outline),
          title: const Tr('settings.version'),
          trailing: Text(version, key: const ValueKey('settings-version')),
        ),
        ListTile(
          leading: const Icon(Icons.privacy_tip_outlined),
          title: const Tr('settings.privacy_policy'),
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => const PrivacyPolicyScreen(),
            ),
          ),
        ),
        ListTile(
          leading: const Icon(Icons.gavel),
          title: const Tr('settings.legal'),
          onTap: () => showLicensePage(
            context: context,
            applicationName: AppStrings.appName,
            applicationVersion: version,
            applicationLegalese:
                'Yako — données stockées uniquement sur cet appareil '
                '(loi ivoirienne n°2013-450).',
          ),
        ),
        ListTile(
          leading: const Icon(Icons.bug_report_outlined),
          title: const Tr('settings.report'),
          onTap: () async {
            final message = context.tr('settings.report_body');
            final messenger = ScaffoldMessenger.of(context);
            await Clipboard.setData(const ClipboardData(text: supportEmail));
            messenger.showSnackBar(SnackBar(content: Text(message)));
          },
        ),
      ],
    );
  }
}
