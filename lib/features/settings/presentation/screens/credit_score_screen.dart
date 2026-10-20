// lib/features/settings/presentation/screens/credit_score_screen.dart
//
// Mon score : calcul local + aperçu exact du payload partageable.

import 'package:flutter/material.dart';
import 'package:yako/core/presentation/l10n.dart';
import 'package:yako/features/settings/presentation/widgets/score_preview_card.dart';

/// Credit score screen.
class CreditScoreScreen extends StatelessWidget {
  const CreditScoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Tr('score.title')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: const [ScorePreviewCard()],
      ),
    );
  }
}
