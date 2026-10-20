// lib/features/monetization/domain/entities/promotion.dart
//
// Promotion fournisseur (contenu générique, jamais ciblé sur des PII).

/// Supplier promotion.
final class Promotion {
  const Promotion({
    required this.id,
    required this.title,
    required this.body,
    required this.validUntil,
  });

  final String id;
  final String title;
  final String body;
  final DateTime validUntil;
}
