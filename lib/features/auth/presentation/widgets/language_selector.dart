// lib/features/auth/presentation/widgets/language_selector.dart
//
// Choix de langue par gros boutons (FR / Dioula / Baoulé).

import 'package:flutter/material.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';

/// Language picker.
class LanguageSelector extends StatelessWidget {
  const LanguageSelector({
    required this.selected,
    required this.onChanged,
    super.key,
  });

  final LanguageCode selected;
  final ValueChanged<LanguageCode> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      alignment: WrapAlignment.center,
      children: [
        for (final language in LanguageCode.values)
          ChoiceChip(
            key: ValueKey('lang-${language.code}'),
            label: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              child: Text(
                language.nativeName,
                style: const TextStyle(fontSize: 18),
              ),
            ),
            selected: language == selected,
            onSelected: (_) => onChanged(language),
          ),
      ],
    );
  }
}
