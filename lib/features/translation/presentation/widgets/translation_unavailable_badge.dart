// lib/features/translation/presentation/widgets/translation_unavailable_badge.dart
//
// Badge « Non traduit » : le texte français reste affiché.

import 'package:flutter/material.dart';
import 'package:yako/core/presentation/l10n.dart';

/// "Not translated" badge.
class TranslationUnavailableBadge extends StatelessWidget {
  const TranslationUnavailableBadge({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      key: const ValueKey('not-translated-badge'),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: scheme.tertiaryContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.translate, size: 16, color: scheme.onTertiaryContainer),
          const SizedBox(width: 4),
          Text(
            context.tr('translation.not_translated'),
            style: TextStyle(color: scheme.onTertiaryContainer),
          ),
        ],
      ),
    );
  }
}
