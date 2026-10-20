// lib/features/monetization/domain/services/credit_score_api.dart
//
// API B2B (abstraite). Implémentations : mock (par défaut) et HTTP
// (préparée, non branchée tant que monetization_enabled = false).

import 'package:yako/core/error/result.dart';
import 'package:yako/features/monetization/domain/entities/aggregated_credit_payload.dart';
import 'package:yako/features/monetization/domain/entities/promotion.dart';

/// Partner API.
abstract interface class CreditScoreApi {
  Future<Result<void>> submitScore(AggregatedCreditPayload payload);

  Future<Result<List<Promotion>>> fetchPromotions({
    required String businessCategory,
  });
}
