// lib/features/monetization/data/services/sync_service_impl.dart
//
// Synchronisation soumise au consentement.
// - Rien ne se passe sans : monétisation activée + drapeau `sync` + au
//   moins un consentement accordé.
// - Le score n'est préparé que si « partage du score » est accordé ; il est
//   mis en file (table sync_queue, chiffré avec la clé de session).
// - Nouvel essai avec attente croissante : 30 s, 2 min, 10 min, 1 h ;
//   abandon après 5 tentatives.
// - Le consentement « diagnostics » est enregistré mais aucun diagnostic
//   n'est produit dans cette version.

import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';
import 'package:yako/core/config/feature_flags.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/core/security/data_key_reader.dart';
import 'package:yako/core/security/encryption_service.dart';
import 'package:yako/data/local/database.dart';
import 'package:yako/data/local/database_manager.dart';
import 'package:yako/features/consent/domain/repositories/consent_repository.dart';
import 'package:yako/features/monetization/domain/entities/aggregated_credit_payload.dart';
import 'package:yako/features/monetization/domain/entities/promotion.dart';
import 'package:yako/features/monetization/domain/services/connectivity_checker.dart';
import 'package:yako/features/monetization/domain/services/credit_score_api.dart';
import 'package:yako/features/monetization/domain/services/credit_score_service.dart';
import 'package:yako/features/monetization/domain/services/sync_service.dart';

/// Default [SyncService] (offline mock API by default).
class SyncServiceImpl implements SyncService {
  SyncServiceImpl({
    required this._consents,
    required this._scores,
    required this._api,
    required this._flags,
    required this._connectivity,
    required DatabaseManager databaseManager,
    required this._encryption,
    required this._dataKey,
    DateTime Function()? now,
    this._uuid = const Uuid(),
  }) : _db = databaseManager,
       _now = now ?? DateTime.now;

  static const List<Duration> backoff = [
    Duration(seconds: 30),
    Duration(minutes: 2),
    Duration(minutes: 10),
    Duration(hours: 1),
  ];
  static const int maxAttempts = 5;

  final ConsentRepository _consents;
  final CreditScoreService _scores;
  final CreditScoreApi _api;
  final FeatureFlags Function() _flags;
  final ConnectivityChecker _connectivity;
  final DatabaseManager _db;
  final EncryptionService _encryption;
  final DataKeyReader _dataKey;
  final DateTime Function() _now;
  final Uuid _uuid;
  List<Promotion> _promotions = const [];

  /// Earliest time attempt number [retryCount] may run.
  static DateTime nextAttemptAt(DateTime createdAt, int retryCount) {
    var at = createdAt;
    for (var i = 0; i < retryCount; i++) {
      at = at.add(backoff[i < backoff.length ? i : backoff.length - 1]);
    }
    return at;
  }

  @override
  Future<Result<SyncOutcome>> syncIfConsented() async {
    final flags = _flags();
    if (!flags.monetizationEnabled || !flags.sync) {
      return const Success(SyncOutcome.skipped);
    }
    final consent = (await _consents.getConsentState()).getOrNull();
    if (consent == null || !consent.anyGranted) {
      return const Success(SyncOutcome.skipped);
    }
    final key = _dataKey();
    final db = (await _db.open()).getOrNull();
    if (key == null || db == null) return const Success(SyncOutcome.skipped);

    try {
      var outcome = SyncOutcome.skipped;
      String? category;
      if (consent.creditScoreSharing) {
        final score = await _scores.computeFromRepository();
        if (score case FailureResult(:final failure)) {
          return FailureResult(failure);
        }
        final payload = _scores.buildAggregatedPayload(score.getOrNull()!);
        category = payload.businessCategory.code;
        await _enqueueIfEmpty(db, payload, key);
        outcome = SyncOutcome.queued;
      }
      if (!await _connectivity.isOnline()) return Success(outcome);

      if (consent.creditScoreSharing && await _flushQueue(db, key)) {
        outcome = SyncOutcome.sent;
      }
      if (consent.promotions) {
        final promos = await _api.fetchPromotions(
          businessCategory: category ?? BusinessCategory.other.code,
        );
        _promotions = promos.getOrNull() ?? _promotions;
      }
      return Success(outcome);
    } on Object catch (e, st) {
      return FailureResult(
        UnknownFailure(
          technicalMessage: 'Sync failed',
          cause: e,
          stackTrace: st,
        ),
      );
    }
  }

  @override
  Future<List<Promotion>> getCachedPromotions() async => _promotions;

  Future<void> _enqueueIfEmpty(
    AppDatabase db,
    AggregatedCreditPayload payload,
    String key,
  ) async {
    if (await db.select(db.syncQueue).get().then((r) => r.isNotEmpty)) return;
    final sealed = await _encryption.encryptAesGcm(
      jsonEncode(payload.toJson()),
      key,
    );
    await db
        .into(db.syncQueue)
        .insert(
          SyncQueueCompanion.insert(
            id: _uuid.v4(),
            payloadEncrypted: sealed.getOrNull()!,
            createdAt: _now(),
          ),
        );
  }

  /// Sends eligible queued payloads; `true` if at least one was delivered.
  Future<bool> _flushQueue(AppDatabase db, String key) async {
    var delivered = false;
    for (final row in await db.select(db.syncQueue).get()) {
      if (_now().isBefore(nextAttemptAt(row.createdAt, row.retryCount))) {
        continue;
      }
      final clear = (await _encryption.decryptAesGcm(
        row.payloadEncrypted,
        key,
      )).getOrNull();
      final payload = clear == null ? null : _decode(clear);
      final sent =
          payload != null && (await _api.submitScore(payload)).isSuccess;
      if (sent || row.retryCount + 1 >= maxAttempts || payload == null) {
        await (db.delete(db.syncQueue)..where((q) => q.id.equals(row.id))).go();
        delivered = delivered || sent;
      } else {
        await (db.update(db.syncQueue)..where((q) => q.id.equals(row.id)))
            .write(SyncQueueCompanion(retryCount: Value(row.retryCount + 1)));
      }
    }
    return delivered;
  }

  static AggregatedCreditPayload? _decode(String json) {
    try {
      final map = jsonDecode(json) as Map<String, dynamic>;
      return AggregatedCreditPayload(
        score: map['score'] as int,
        businessCategory: BusinessCategory.values.firstWhere(
          (c) => c.code == map['business_category'],
        ),
        monthsActive: map['months_active'] as int,
        regularityPct: map['regularity_pct'] as int,
        txCountBucket: TxCountBucket.values.firstWhere(
          (b) => b.label == map['tx_count_bucket'],
        ),
      );
    } on Object {
      return null;
    }
  }
}
