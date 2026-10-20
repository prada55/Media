// lib/features/settings/presentation/widgets/score_preview_card.dart
//
// Aperçu du score local ET du payload exact qui serait partagé en cas de
// consentement — transparence totale, champ par champ.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/presentation/l10n.dart';
import 'package:yako/features/monetization/presentation/providers/monetization_providers.dart';

/// Credit score preview.
class ScorePreviewCard extends ConsumerWidget {
  const ScorePreviewCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final score = ref.watch(creditScoreProvider);
    final payload = ref.watch(aggregatedPayloadProvider).value;
    return Card(
      key: const ValueKey('score-preview'),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: score.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, _) => const Tr('common.data_unavailable'),
          data: (s) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Text(
                  '${s.score} / 100',
                  key: const ValueKey('score-value'),
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
              ),
              const SizedBox(height: 16),
              Tr(
                'score.shared_title',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              if (payload != null)
                for (final MapEntry(:key, :value) in payload.toJson().entries)
                  ListTile(
                    dense: true,
                    title: Text(key),
                    trailing: Text('$value'),
                  ),
              const SizedBox(height: 8),
              Text(
                context.tr('score.not_shared'),
                style: const TextStyle(fontStyle: FontStyle.italic),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
