// lib/features/settings/presentation/widgets/consent_switch.dart
//
// Interrupteur de consentement avec explication et info-bulle.

import 'package:flutter/material.dart';
import 'package:yako/core/presentation/l10n.dart';

/// One consent toggle.
class ConsentSwitch extends StatelessWidget {
  const ConsentSwitch({
    required this.titleKey,
    required this.hintKey,
    required this.value,
    required this.onChanged,
    super.key,
  });

  final String titleKey;
  final String hintKey;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final hint = context.tr(hintKey);
    return SwitchListTile(
      value: value,
      onChanged: onChanged,
      title: Row(
        children: [
          Expanded(child: Text(context.tr(titleKey))),
          Tooltip(
            message: hint,
            triggerMode: TooltipTriggerMode.tap,
            child: const Icon(Icons.info_outline, size: 20),
          ),
        ],
      ),
      subtitle: Text(hint),
    );
  }
}
