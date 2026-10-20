// lib/features/consent/domain/entities/consent_state.dart
//
// Trois consentements indépendants, TOUS désactivés par défaut et
// révocables en un geste.

import 'package:flutter/foundation.dart' show immutable;

/// Consent keys stored in the `consent` table.
enum ConsentKey {
  /// Partage du score de crédit anonymisé avec des institutions financières.
  creditScoreSharing('credit_score_sharing'),

  /// Promotions de fournisseurs dans l'application.
  promotions('promotions'),

  /// Diagnostics techniques anonymes.
  diagnostics('diagnostics');

  ConsentKey(this.code);

  final String code;
}

/// Current consents.
@immutable
final class ConsentState {
  const ConsentState({
    this.creditScoreSharing = false,
    this.promotions = false,
    this.diagnostics = false,
  });

  final bool creditScoreSharing;
  final bool promotions;
  final bool diagnostics;

  bool get anyGranted => creditScoreSharing || promotions || diagnostics;

  bool valueOf(ConsentKey key) => switch (key) {
    ConsentKey.creditScoreSharing => creditScoreSharing,
    ConsentKey.promotions => promotions,
    ConsentKey.diagnostics => diagnostics,
  };

  @override
  bool operator ==(Object other) =>
      other is ConsentState &&
      other.creditScoreSharing == creditScoreSharing &&
      other.promotions == promotions &&
      other.diagnostics == diagnostics;

  @override
  int get hashCode => Object.hash(creditScoreSharing, promotions, diagnostics);
}
