// lib/features/translation/presentation/widgets/transcript_translation_view.dart
//
// Détail d'une opération : bascule Français / langue locale. Affiche la
// traduction enregistrée, sinon tente une traduction hors ligne ; à défaut,
// le français reste affiché avec le badge « Non traduit ».

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';
import 'package:yako/features/translation/presentation/providers/translation_providers.dart';
import 'package:yako/features/translation/presentation/widgets/translation_toggle.dart';
import 'package:yako/features/translation/presentation/widgets/translation_unavailable_badge.dart';

/// French / local language view of a transcript.
class TranscriptTranslationView extends ConsumerStatefulWidget {
  const TranscriptTranslationView({
    required this.transcriptFr,
    this.transcriptLocal,
    super.key,
  });

  final String transcriptFr;
  final String? transcriptLocal;

  @override
  ConsumerState<TranscriptTranslationView> createState() =>
      _TranscriptTranslationViewState();
}

class _TranscriptTranslationViewState
    extends ConsumerState<TranscriptTranslationView> {
  LanguageCode _shown = LanguageCode.fr;

  @override
  Widget build(BuildContext context) {
    final userLanguage = ref.watch(currentLanguageProvider);
    final local = userLanguage == LanguageCode.fr
        ? LanguageCode.dyu
        : userLanguage;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TranslationToggle(
          languages: [LanguageCode.fr, local],
          selected: _shown == LanguageCode.fr ? LanguageCode.fr : local,
          // Pure UI state: which language is displayed.
          onChanged: (language) => setState(() => _shown = language),
        ),
        const SizedBox(height: 12),
        if (_shown == LanguageCode.fr)
          _quote(widget.transcriptFr)
        else
          _local(local),
      ],
    );
  }

  Widget _local(LanguageCode language) {
    final stored = widget.transcriptLocal;
    if (stored != null && stored.isNotEmpty) return _quote(stored);
    final request = (
      text: widget.transcriptFr,
      from: LanguageCode.fr,
      to: language,
    );
    final result = ref.watch(translationProvider(request));
    return result.when(
      loading: () => const LinearProgressIndicator(),
      error: (_, _) => _untranslated(),
      data: (r) => r.fold((t) => _quote(t.text), (_) => _untranslated()),
    );
  }

  Widget _untranslated() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const TranslationUnavailableBadge(),
      const SizedBox(height: 8),
      _quote(widget.transcriptFr),
    ],
  );

  Widget _quote(String text) =>
      Text('« $text »', style: const TextStyle(fontSize: 18));
}
