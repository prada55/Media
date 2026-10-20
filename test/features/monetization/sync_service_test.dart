// test/features/monetization/sync_service_test.dart

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:yako/core/config/feature_flags.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/features/consent/data/repositories/consent_repository_impl.dart';
import 'package:yako/features/monetization/data/services/credit_score_api_mock.dart';
import 'package:yako/features/monetization/data/services/sync_service_impl.dart';
import 'package:yako/features/monetization/domain/entities/aggregated_credit_payload.dart';
import 'package:yako/features/monetization/domain/services/connectivity_checker.dart';
import 'package:yako/features/monetization/domain/services/credit_score_api.dart';
import 'package:yako/features/monetization/domain/services/credit_score_service.dart';
import 'package:yako/features/monetization/domain/services/sync_service.dart';
import 'package:yako/features/transactions/domain/entities/transaction.dart';

import '../../helpers/auth_harness.dart';
import '../../helpers/fake_transaction_repository.dart';

class _Online implements ConnectivityChecker {
  bool online = true;

  @override
  Future<bool> isOnline() async => online;
}

class _FailingApi extends Mock implements CreditScoreApi;

void main() {
  setUpAll(
    () => registerFallbackValue(
      const AggregatedCreditPayload(
        score: 0,
        businessCategory: BusinessCategory.other,
        monthsActive: 0,
        regularityPct: 0,
        txCountBucket: TxCountBucket.b0to9,
      ),
    ),
  );

  late AuthHarness h;
  late ConsentRepositoryImpl consents;
  late CreditScoreApiMock api;
  late _Online connectivity;
  late FeatureFlags flags;
  late String? key;

  setUp(() async {
    h = await AuthHarness.create();
    consents = ConsentRepositoryImpl(databaseManager: h.databaseManager);
    api = CreditScoreApiMock();
    connectivity = _Online();
    flags = const FeatureFlags();
    key = h.encryption.generateKey().getOrNull();
  });
  tearDown(() => h.dispose());

  SyncServiceImpl service({CreditScoreApi? withApi}) {
    final now = DateTime(2026, 10, 20);
    final repo = FakeTransactionRepository([
      Transaction(
        id: 't1',
        type: TransactionType.sale,
        amount: 5000,
        category: TransactionCategory.saleFood,
        transcriptFr: '',
        createdAt: now,
        updatedAt: now,
      ),
    ]);
    return SyncServiceImpl(
      consents: consents,
      scores: CreditScoreService(repo, now: () => h.now),
      api: withApi ?? api,
      flags: () => flags,
      connectivity: connectivity,
      databaseManager: h.databaseManager,
      encryption: h.encryption,
      dataKey: () => key,
      now: () => h.now,
    );
  }

  Future<int> queueLength() async {
    final db = (await h.databaseManager.open()).getOrNull()!;
    return (await db.select(db.syncQueue).get()).length;
  }

  test('consent OFF → no-op even with every flag on', () async {
    flags = const FeatureFlags(monetizationEnabled: true, sync: true);
    final outcome = await service().syncIfConsented();
    expect(outcome.getOrNull(), SyncOutcome.skipped);
    expect(api.log, isEmpty);
    expect(await queueLength(), 0);
  });

  test('consent ON + sync flag OFF → no-op', () async {
    await consents.setCreditScoreSharing(value: true);
    flags = const FeatureFlags(monetizationEnabled: true);
    expect(
      (await service().syncIfConsented()).getOrNull(),
      SyncOutcome.skipped,
    );
    expect(api.log, isEmpty);
  });

  test('consent ON + monetization OFF → no-op', () async {
    await consents.setCreditScoreSharing(value: true);
    flags = const FeatureFlags(sync: true);
    expect(
      (await service().syncIfConsented()).getOrNull(),
      SyncOutcome.skipped,
    );
  });

  test('consent ON + flags ON + mock → mock called and logged', () async {
    await consents.setCreditScoreSharing(value: true);
    flags = const FeatureFlags(monetizationEnabled: true, sync: true);
    final outcome = await service().syncIfConsented();
    expect(outcome.getOrNull(), SyncOutcome.sent);
    expect(api.log, ['submitScore']);
    expect(await queueLength(), 0);
  });

  test('offline → payload queued encrypted, sent when back online', () async {
    await consents.setCreditScoreSharing(value: true);
    flags = const FeatureFlags(monetizationEnabled: true, sync: true);
    connectivity.online = false;
    final s = service();
    expect((await s.syncIfConsented()).getOrNull(), SyncOutcome.queued);
    final db = (await h.databaseManager.open()).getOrNull()!;
    final row = (await db.select(db.syncQueue).get()).single;
    expect(row.payloadEncrypted, isNot(contains('score')));
    connectivity.online = true;
    expect((await s.syncIfConsented()).getOrNull(), SyncOutcome.sent);
  });

  test('promotions only with the promotions consent', () async {
    flags = const FeatureFlags(monetizationEnabled: true, sync: true);
    await consents.setPromotions(value: true);
    final s = service();
    await s.syncIfConsented();
    expect(api.log, ['fetchPromotions']);
    expect(await s.getCachedPromotions(), hasLength(1));
  });

  test('failures back off 30 s, 2 min… and give up after 5', () async {
    final failing = _FailingApi();
    when(() => failing.submitScore(any())).thenAnswer(
      (_) async =>
          const FailureResult(UnknownFailure(technicalMessage: 'down')),
    );
    await consents.setCreditScoreSharing(value: true);
    flags = const FeatureFlags(monetizationEnabled: true, sync: true);
    final s = service(withApi: failing);

    await s.syncIfConsented(); // attempt 1 fails → retry_count 1
    await s.syncIfConsented(); // too early: not retried
    verify(() => failing.submitScore(any())).called(1);

    for (final wait in SyncServiceImpl.backoff) {
      h.now = h.now.add(wait);
      await s.syncIfConsented();
    }
    verify(() => failing.submitScore(any())).called(4);
    expect(await queueLength(), 0, reason: 'dropped after 5 attempts');
  });

  test('backoff schedule', () {
    final t0 = DateTime(2026);
    expect(SyncServiceImpl.nextAttemptAt(t0, 0), t0);
    expect(
      SyncServiceImpl.nextAttemptAt(t0, 2),
      t0.add(const Duration(seconds: 30 + 120)),
    );
    expect(
      SyncServiceImpl.nextAttemptAt(t0, 5),
      t0.add(const Duration(seconds: 30 + 120 + 600 + 3600 + 3600)),
    );
  });

  test('default connectivity is offline (no network permission)', () async {
    expect(await const OfflineConnectivityChecker().isOnline(), isFalse);
  });
}
