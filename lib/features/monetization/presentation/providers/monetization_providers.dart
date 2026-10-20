// lib/features/monetization/presentation/providers/monetization_providers.dart
//
// Score local, payload agrégé (aperçu) et service de synchronisation.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/config/feature_flags.dart';
import 'package:yako/core/di/injection.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/security/encryption_service.dart';
import 'package:yako/data/local/database_manager.dart';
import 'package:yako/features/auth/presentation/providers/auth_providers.dart';
import 'package:yako/features/consent/presentation/providers/consent_providers.dart';
import 'package:yako/features/monetization/data/services/sync_service_impl.dart';
import 'package:yako/features/monetization/domain/entities/aggregated_credit_payload.dart';
import 'package:yako/features/monetization/domain/entities/credit_score.dart';
import 'package:yako/features/monetization/domain/services/connectivity_checker.dart';
import 'package:yako/features/monetization/domain/services/credit_score_api.dart';
import 'package:yako/features/monetization/domain/services/credit_score_service.dart';
import 'package:yako/features/monetization/domain/services/sync_service.dart';
import 'package:yako/features/transactions/presentation/providers/transaction_providers.dart';

final creditScoreServiceProvider = Provider<CreditScoreService>(
  (ref) => CreditScoreService(ref.watch(transactionRepositoryProvider)),
);

final creditScoreApiProvider = Provider<CreditScoreApi>(
  (ref) => getIt<CreditScoreApi>(),
);

final connectivityCheckerProvider = Provider<ConnectivityChecker>(
  (ref) => getIt<ConnectivityChecker>(),
);

/// Local score, recomputed when transactions change.
final FutureProvider<CreditScore> creditScoreProvider =
    FutureProvider.autoDispose<CreditScore>((ref) async {
      await ref.watch(recentTransactionsProvider.future);
      final result = await ref
          .watch(creditScoreServiceProvider)
          .computeFromRepository();
      final score = result.fold((s) => s, (f) => throw FailureException(f));
      return score;
    });

/// Exactly what would be shared if the user consented.
final FutureProvider<AggregatedCreditPayload> aggregatedPayloadProvider =
    FutureProvider.autoDispose<AggregatedCreditPayload>((ref) async {
      final score = await ref.watch(creditScoreProvider.future);
      return ref
          .watch(creditScoreServiceProvider)
          .buildAggregatedPayload(score);
    });

final syncServiceProvider = Provider<SyncService>(
  (ref) => SyncServiceImpl(
    consents: ref.watch(consentRepositoryProvider),
    scores: ref.watch(creditScoreServiceProvider),
    api: ref.watch(creditScoreApiProvider),
    flags: () => ref.read(featureFlagsProvider),
    connectivity: ref.watch(connectivityCheckerProvider),
    databaseManager: getIt<DatabaseManager>(),
    encryption: getIt<EncryptionService>(),
    dataKey: () => ref.read(sessionManagerProvider).dataKey,
  ),
);
