// lib/features/monetization/data/services/credit_score_api_mock.dart
//
// API B2B simulée : aucun réseau. Journalise uniquement le mot « MOCK » et
// le nom de l'opération (jamais le contenu du payload).

import 'dart:developer' as developer;

import 'package:yako/core/error/result.dart';
import 'package:yako/features/monetization/domain/entities/aggregated_credit_payload.dart';
import 'package:yako/features/monetization/domain/entities/promotion.dart';
import 'package:yako/features/monetization/domain/services/credit_score_api.dart';

/// Offline mock of the partner API.
class CreditScoreApiMock implements CreditScoreApi {
  CreditScoreApiMock({DateTime Function()? now}) : _now = now ?? DateTime.now;

  final DateTime Function() _now;

  /// Operations received, for tests and the debug screen.
  final List<String> log = [];

  void _log(String operation) {
    log.add(operation);
    developer.log('MOCK $operation', name: 'yako.monetization');
  }

  @override
  Future<Result<void>> submitScore(AggregatedCreditPayload payload) async {
    // Serializing enforces the whitelist even in mock mode.
    payload.toJson();
    _log('submitScore');
    return const Success(null);
  }

  @override
  Future<Result<List<Promotion>>> fetchPromotions({
    required String businessCategory,
  }) async {
    _log('fetchPromotions');
    return Success([
      Promotion(
        id: 'mock-1',
        title: 'Promotion fournisseur (exemple)',
        body: 'Contenu de démonstration — aucune offre réelle.',
        validUntil: _now().add(const Duration(days: 7)),
      ),
    ]);
  }
}
