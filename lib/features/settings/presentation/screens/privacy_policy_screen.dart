// lib/features/settings/presentation/screens/privacy_policy_screen.dart
//
// Politique de confidentialité courte, consultable hors ligne. La version
// longue (FR + EN) est publiée en ligne (docs/privacy-policy.md). Les
// versions dioula et baoulé attendent un traducteur natif : elles ne sont
// PAS inventées.

import 'package:flutter/material.dart';
import 'package:yako/core/presentation/l10n.dart';

/// Short in-app privacy policy.
class PrivacyPolicyScreen extends StatelessWidget {
  const PrivacyPolicyScreen({super.key});

  static const List<(String, String)> _sections = [
    (
      'Vos données restent sur votre téléphone',
      'Ventes, dépenses, montants, enregistrements vocaux et transcriptions '
          'sont stockés uniquement sur cet appareil, chiffrés (AES-256). '
          'Yako n’a pas de serveur qui les reçoit.',
    ),
    (
      'Votre numéro et votre code',
      'Votre numéro n’est jamais stocké en clair : seule une empreinte '
          'secrète est gardée. Votre code secret n’est jamais enregistré.',
    ),
    (
      'Ce qui peut sortir, seulement avec votre accord',
      'Si vous activez « Partager mon score », seuls 5 éléments anonymes '
          'peuvent être envoyés : score (0-100), type d’activité, ancienneté '
          'en mois, régularité (%), et une tranche du nombre d’opérations. '
          'Jamais votre nom, numéro, montants ou enregistrements. '
          'Tout est désactivé par défaut et se coupe en un geste.',
    ),
    (
      'Vos droits',
      'Vous pouvez exporter vos données (fichier chiffré) et tout supprimer '
          'à tout moment depuis Réglages. Loi ivoirienne n°2013-450. '
          'Contact : dpo@yako.ci',
    ),
    (
      'Dioula / Baoulé',
      'Version en langue locale en préparation avec un traducteur natif.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Tr('settings.privacy_policy')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          for (final (title, body) in _sections) ...[
            Text(title, style: theme.textTheme.titleMedium),
            const SizedBox(height: 4),
            Text(body, style: const TextStyle(fontSize: 16)),
            const SizedBox(height: 20),
          ],
          Text('Mise à jour : 20/10/2026', style: theme.textTheme.bodySmall),
        ],
      ),
    );
  }
}
