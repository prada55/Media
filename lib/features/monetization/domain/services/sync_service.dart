// lib/features/monetization/domain/services/sync_service.dart
//
// Envoi des données agrégées UNIQUEMENT si : consentement correspondant
// accordé + monétisation activée + drapeau `sync` + connectivité.

import 'package:yako/core/error/result.dart';
import 'package:yako/features/monetization/domain/entities/promotion.dart';

/// What a sync attempt did.
enum SyncOutcome {
  /// Conditions non remplies : rien n'a été fait.
  skipped,

  /// Payload mis en file (hors ligne ou en attente de nouvel essai).
  queued,

  /// Payload remis à l'API.
  sent,
}

/// Consent-gated synchronization.
abstract interface class SyncService {
  Future<Result<SyncOutcome>> syncIfConsented();

  /// Promotions already fetched (never fetched without consent).
  Future<List<Promotion>> getCachedPromotions();
}
