// lib/features/monetization/domain/entities/credit_score.dart
//
// Score de crédit alternatif, calculé LOCALEMENT sur les 90 derniers jours.
// Les montants exacts ne quittent jamais ce calcul.

import 'package:yako/features/transactions/domain/entities/transaction.dart';

/// Local credit score and its explainable components.
final class CreditScore {
  const CreditScore({
    required this.score,
    required this.regularityPct,
    required this.expenseRatioScore,
    required this.frequencyScore,
    required this.monthsActive,
    required this.txCount90d,
    required this.dominantCategory,
    required this.computedAt,
  });

  /// 0..100.
  final int score;

  /// Jours actifs / jours observés (90 max), en %.
  final int regularityPct;

  /// 0..1 : 1 = peu de dépenses par rapport aux ventes.
  final double expenseRatioScore;

  /// 0..1 : fréquence d'enregistrement.
  final double frequencyScore;

  /// Mois depuis la première opération.
  final int monthsActive;

  final int txCount90d;

  /// Catégorie de vente la plus fréquente (null si aucune vente).
  final TransactionCategory? dominantCategory;

  final DateTime computedAt;
}
