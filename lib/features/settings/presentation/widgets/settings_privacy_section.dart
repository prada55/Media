// lib/features/settings/presentation/widgets/settings_privacy_section.dart
//
// Confidentialité : trois consentements indépendants, OFF par défaut,
// révocables en un geste (« Tout désactiver »).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/presentation/l10n.dart';
import 'package:yako/features/consent/domain/entities/consent_state.dart';
import 'package:yako/features/consent/presentation/providers/consent_providers.dart';
import 'package:yako/features/settings/presentation/widgets/consent_switch.dart';
import 'package:yako/features/settings/presentation/widgets/settings_section.dart';

/// Consent settings.
class SettingsPrivacySection extends ConsumerWidget {
  const SettingsPrivacySection({super.key});

  static const List<(ConsentKey, String)> _items = [
    (ConsentKey.creditScoreSharing, 'consent.credit_score'),
    (ConsentKey.promotions, 'consent.promotions'),
    (ConsentKey.diagnostics, 'consent.diagnostics'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final consent =
        ref.watch(consentStateProvider).value ?? const ConsentState();
    final actions = ref.read(consentActionsProvider);
    return SettingsSection(
      titleKey: 'settings.privacy',
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: Tr('settings.privacy_intro'),
        ),
        for (final (key, label) in _items)
          ConsentSwitch(
            key: ValueKey('consent-${key.code}'),
            titleKey: label,
            hintKey: '${label}_hint',
            value: consent.valueOf(key),
            onChanged: (value) => actions.set(key, value: value),
          ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: OutlinedButton.icon(
            key: const ValueKey('consent-revoke-all'),
            onPressed: consent.anyGranted
                ? () async {
                    final message = context.tr('consent.revoked');
                    final messenger = ScaffoldMessenger.of(context);
                    await actions.revokeAll();
                    messenger.showSnackBar(SnackBar(content: Text(message)));
                  }
                : null,
            icon: const Icon(Icons.block),
            label: const Tr('consent.revoke_all'),
          ),
        ),
      ],
    );
  }
}
