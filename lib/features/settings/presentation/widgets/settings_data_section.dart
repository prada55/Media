// lib/features/settings/presentation/widgets/settings_data_section.dart
//
// Mes données : export chiffré, score, suppression complète.

import 'package:flutter/material.dart';
import 'package:yako/core/presentation/l10n.dart';
import 'package:yako/features/auth/presentation/screens/delete_account_screen.dart';
import 'package:yako/features/settings/presentation/screens/credit_score_screen.dart';
import 'package:yako/features/settings/presentation/screens/export_screen.dart';
import 'package:yako/features/settings/presentation/widgets/settings_section.dart';

/// Data settings.
class SettingsDataSection extends StatelessWidget {
  const SettingsDataSection({super.key});

  @override
  Widget build(BuildContext context) {
    void open(Widget screen) =>
        Navigator.of(context)
            .push(MaterialPageRoute<void>(builder: (_) => screen));
    return SettingsSection(
      titleKey: 'settings.data',
      children: [
        ListTile(
          key: const ValueKey('settings-export'),
          leading: const Icon(Icons.lock_outline),
          title: const Tr('settings.export'),
          onTap: () => open(const ExportScreen()),
        ),
        ListTile(
          key: const ValueKey('settings-score'),
          leading: const Icon(Icons.speed),
          title: const Tr('settings.score'),
          onTap: () => open(const CreditScoreScreen()),
        ),
        ListTile(
          key: const ValueKey('settings-delete'),
          leading: Icon(
            Icons.delete_forever,
            color: Theme.of(context).colorScheme.error,
          ),
          title: Text(
            context.tr('settings.delete'),
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
          onTap: () => open(const DeleteAccountScreen()),
        ),
      ],
    );
  }
}
