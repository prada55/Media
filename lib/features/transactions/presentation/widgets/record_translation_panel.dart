// lib/features/transactions/presentation/widgets/record_translation_panel.dart
//
// Après la transcription : bouton « Traduire » vers le dioula ou le baoulé.
// En l'absence de traduction fiable, badge « Non traduit ».

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/presentation/l10n.dart';
import 'package:yako/features/transactions/presentation/providers/record_controller.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';
import 'package:yako/features/translation/presentation/widgets/translation_toggle.dart';
import 'package:yako/features/translation/presentation/widgets/translation_unavailable_badge.dart';

/// Translation controls of the record screen.
class RecordTranslationPanel extends ConsumerStatefulWidget {
  const RecordTranslationPanel({super.key});

  @override
  ConsumerState<RecordTranslationPanel> createState() =>
      _RecordTranslationPanelState();
}

class _RecordTranslationPanelState
    extends ConsumerState<RecordTranslationPanel> {
  LanguageCode _target = LanguageCode.dyu;

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(recordControllerProvider);
    if (state.transcript.trim().isEmpty) return const SizedBox.shrink();
    final translation = state.translation;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('« ${state.transcript} »'),
            const SizedBox(height: 8),
            TranslationToggle(
              languages: const [LanguageCode.dyu, LanguageCode.bci],
              selected: _target,
              onChanged: (l) => setState(() => _target = l),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              key: const ValueKey('record-translate'),
              onPressed: () => ref
                  .read(recordControllerProvider.notifier)
                  .translate(_target),
              icon: const Icon(Icons.translate),
              label: Text(context.tr('translation.translate')),
            ),
            if (translation != null && translation.language == _target)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: translation.text == null
                    ? const TranslationUnavailableBadge()
                    : Text(
                        translation.text!,
                        key: const ValueKey('record-translation'),
                        style: const TextStyle(fontSize: 18),
                      ),
              ),
          ],
        ),
      ),
    );
  }
}
