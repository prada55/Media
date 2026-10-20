// lib/features/monetization/domain/entities/aggregated_credit_payload.dart
//
// SEULES données susceptibles de quitter l'appareil (après consentement
// explicite et révocable). Contrat : docs/monetization.md.
//
// JAMAIS : nom, téléphone (même haché), montant exact, transcription,
// audio, date précise, localisation, identifiant d'appareil.

import 'package:flutter/foundation.dart' show immutable;

/// Bucketed transaction count (no exact volume).
enum TxCountBucket {
  b0to9('0-9'),
  b10to49('10-49'),
  b50to199('50-199'),
  b200plus('200+');

  TxCountBucket(this.label);

  final String label;

  static TxCountBucket of(int count) => switch (count) {
    < 10 => b0to9,
    < 50 => b10to49,
    < 200 => b50to199,
    _ => b200plus,
  };
}

/// Coarse business category.
enum BusinessCategory {
  goods('goods'),
  drinks('drinks'),
  food('food'),
  other('other');

  BusinessCategory(this.code);

  final String code;
}

/// Whitelisted, anonymized payload.
@immutable
final class AggregatedCreditPayload {
  const AggregatedCreditPayload({
    required this.score,
    required this.businessCategory,
    required this.monthsActive,
    required this.regularityPct,
    required this.txCountBucket,
  });

  /// Exhaustive list of fields allowed to leave the device.
  static const Set<String> allowedFields = {
    'score',
    'business_category',
    'months_active',
    'regularity_pct',
    'tx_count_bucket',
  };

  final int score;
  final BusinessCategory businessCategory;
  final int monthsActive;
  final int regularityPct;
  final TxCountBucket txCountBucket;

  /// Serialized payload. Asserts the whitelist at runtime too.
  Map<String, Object> toJson() {
    final json = <String, Object>{
      'score': score.clamp(0, 100),
      'business_category': businessCategory.code,
      'months_active': monthsActive.clamp(0, 600),
      'regularity_pct': regularityPct.clamp(0, 100),
      'tx_count_bucket': txCountBucket.label,
    };
    if (!allowedFields.containsAll(json.keys) ||
        json.length != allowedFields.length) {
      throw StateError('Payload whitelist violation');
    }
    return json;
  }

  @override
  bool operator ==(Object other) =>
      other is AggregatedCreditPayload &&
      other.score == score &&
      other.businessCategory == businessCategory &&
      other.monthsActive == monthsActive &&
      other.regularityPct == regularityPct &&
      other.txCountBucket == txCountBucket;

  @override
  int get hashCode => Object.hash(
    score,
    businessCategory,
    monthsActive,
    regularityPct,
    txCountBucket,
  );
}
