// lib/features/monetization/data/services/credit_score_api_http.dart
//
// Client HTTP B2B PRÉPARÉ MAIS NON BRANCHÉ : il n'est enregistré nulle part
// dans l'injection de dépendances, l'app ne déclare pas la permission
// INTERNET, et chaque appel échoue tant que `monetizationEnabled` est faux.
//
// Épinglage : le SecurityContext ne fait confiance à AUCUNE racine système,
// seulement aux certificats épinglés fournis (PEM) — une AC compromise ou
// un proxy d'interception ne peuvent donc pas établir la connexion TLS.

import 'dart:convert';
import 'dart:io';

import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/features/monetization/domain/entities/aggregated_credit_payload.dart';
import 'package:yako/features/monetization/domain/entities/promotion.dart';
import 'package:yako/features/monetization/domain/services/credit_score_api.dart';

/// Pinned HTTPS implementation (dormant).
class CreditScoreApiHttp implements CreditScoreApi {
  CreditScoreApiHttp({
    required this.baseUrl,
    required this.pinnedCertificatesPem,
    required this.monetizationEnabled,
    this.timeout = const Duration(seconds: 15),
  });

  final String baseUrl;

  /// PEM of the pinned certificate(s) (leaf or issuing CA).
  final List<String> pinnedCertificatesPem;
  final bool monetizationEnabled;
  final Duration timeout;

  HttpClient _pinnedClient() {
    // Default SecurityContext() trusts NO system root: pinned certs only.
    final context = SecurityContext();
    for (final pem in pinnedCertificatesPem) {
      context.setTrustedCertificatesBytes(utf8.encode(pem));
    }
    return HttpClient(context: context)
      ..connectionTimeout = timeout
      ..badCertificateCallback = (_, _, _) => false;
  }

  Result<T>? _guard<T>() {
    if (!monetizationEnabled) {
      return const FailureResult(
        FeatureNotAvailableFailure(technicalMessage: 'Monetization disabled'),
      );
    }
    if (pinnedCertificatesPem.isEmpty || !baseUrl.startsWith('https://')) {
      return const FailureResult(
        FeatureNotAvailableFailure(technicalMessage: 'Pinning not configured'),
      );
    }
    return null;
  }

  @override
  Future<Result<void>> submitScore(AggregatedCreditPayload payload) async {
    final blocked = _guard<void>();
    if (blocked != null) return blocked;
    final client = _pinnedClient();
    try {
      final request = await client.postUrl(Uri.parse('$baseUrl/v1/scores'));
      request.headers.contentType = ContentType.json;
      request.write(jsonEncode(payload.toJson()));
      final response = await request.close().timeout(timeout);
      await response.drain<void>();
      return response.statusCode >= 200 && response.statusCode < 300
          ? const Success(null)
          : FailureResult(_networkFailure('HTTP ${response.statusCode}'));
    } on Object catch (e, st) {
      return FailureResult(_networkFailure('Request failed', e, st));
    } finally {
      client.close(force: true);
    }
  }

  @override
  Future<Result<List<Promotion>>> fetchPromotions({
    required String businessCategory,
  }) async {
    final blocked = _guard<List<Promotion>>();
    if (blocked != null) return blocked;
    final client = _pinnedClient();
    try {
      final uri = Uri.parse('$baseUrl/v1/promotions')
          .replace(queryParameters: {'category': businessCategory});
      final response = await (await client.getUrl(uri))
          .close()
          .timeout(timeout);
      final body = await response.transform(utf8.decoder).join();
      if (response.statusCode != 200) {
        return FailureResult(_networkFailure('HTTP ${response.statusCode}'));
      }
      final list = (jsonDecode(body) as List).cast<Map<String, dynamic>>();
      return Success([
        for (final p in list)
          Promotion(
            id: p['id'] as String,
            title: p['title'] as String,
            body: p['body'] as String,
            validUntil: DateTime.parse(p['valid_until'] as String),
          ),
      ]);
    } on Object catch (e, st) {
      return FailureResult(_networkFailure('Request failed', e, st));
    } finally {
      client.close(force: true);
    }
  }

  Failure _networkFailure(String message, [Object? e, StackTrace? st]) =>
      UnknownFailure(
        technicalMessage: message,
        userMessageFr: 'Service partenaire injoignable.',
        cause: e,
        stackTrace: st,
      );
}
