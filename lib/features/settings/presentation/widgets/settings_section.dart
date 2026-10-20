// lib/features/settings/presentation/widgets/settings_section.dart
//
// En-tête de section des réglages.

import 'package:flutter/material.dart';
import 'package:yako/core/presentation/l10n.dart';

/// Section title + children.
class SettingsSection extends StatelessWidget {
  const SettingsSection({
    required this.titleKey,
    required this.children,
    super.key,
  });

  final String titleKey;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
          child: Tr(
            titleKey,
            style: Theme.of(context).textTheme.titleLarge
                ?.copyWith(color: Theme.of(context).colorScheme.primary),
          ),
        ),
        ...children,
      ],
    );
  }
}
