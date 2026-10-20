// lib/features/transactions/presentation/providers/transaction_providers.dart
//
// Providers Riverpod des transactions et de la voix.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show FutureProviderFamily;
import 'package:yako/core/di/injection.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/features/auth/presentation/providers/auth_providers.dart';
import 'package:yako/features/transactions/domain/entities/recording_state.dart';
import 'package:yako/features/transactions/domain/entities/transaction.dart';
import 'package:yako/features/transactions/domain/repositories/transaction_repository.dart';
import 'package:yako/features/transactions/domain/services/audio_player_service.dart';
import 'package:yako/features/transactions/domain/services/audio_storage_service.dart';
import 'package:yako/features/transactions/domain/services/microphone_permission.dart';
import 'package:yako/features/transactions/domain/services/voice_service.dart';
import 'package:yako/features/transactions/domain/value_objects/transaction_filter.dart';
import 'package:yako/features/transactions/domain/value_objects/transaction_totals.dart';

final transactionRepositoryProvider = Provider<TransactionRepository>(
  (ref) => getIt<TransactionRepository>(),
);

final voiceServiceProvider = Provider<VoiceService>(
  (ref) => getIt<VoiceService>(),
);

final audioStorageServiceProvider = Provider<AudioStorageService>(
  (ref) => getIt<AudioStorageService>(),
);

final microphonePermissionProvider = Provider<MicrophonePermission>(
  (ref) => getIt<MicrophonePermission>(),
);

final audioPlayerServiceProvider = Provider<AudioPlayerService>(
  (ref) => getIt<AudioPlayerService>(),
);

/// 50 newest transactions, refreshed on every database change. Scoped to
/// the unlocked session: logout, lock or account deletion reset it.
final StreamProvider<List<Transaction>> recentTransactionsProvider =
    StreamProvider<List<Transaction>>((ref) {
      final userId = ref.watch(
        currentUserProvider.select((user) => user.value?.id),
      );
      if (userId == null) return Stream.value(const <Transaction>[]);
      return ref
          .watch(transactionRepositoryProvider)
          .watchRecent()
          .map(
            (result) => result.fold(
              (list) => list,
              (failure) => throw FailureException(failure),
            ),
          );
    });

final transactionFilterProvider =
    NotifierProvider<TransactionFilterController, TransactionFilter>(
      TransactionFilterController.new,
    );

/// Journal filter state.
class TransactionFilterController extends Notifier<TransactionFilter> {
  @override
  TransactionFilter build() => const TransactionFilter();

  void setPeriod(TransactionPeriod period) =>
      state = state.copyWith(period: period);

  void setType(TransactionType? type) =>
      state = state.copyWith(type: () => type);
}

final searchQueryProvider = NotifierProvider<SearchQueryController, String>(
  SearchQueryController.new,
);

/// Journal search text.
class SearchQueryController extends Notifier<String> {
  @override
  String build() => '';

  // A setter would read oddly on a Notifier: keep an explicit verb.
  // ignore: use_setters_to_change_properties
  void set(String query) => state = query;
}

/// Totals for a filter, recomputed whenever transactions change.
final FutureProviderFamily<TransactionTotals, TransactionFilter>
transactionTotalsProvider = FutureProvider.autoDispose
    .family<TransactionTotals, TransactionFilter>((ref, filter) async {
      await ref.watch(recentTransactionsProvider.future);
      final result = await ref
          .watch(transactionRepositoryProvider)
          .computeTotals(filter);
      final totals = result.fold((t) => t, (f) => throw FailureException(f));
      return totals;
    });

/// Journal list: filter + search.
final FutureProvider<List<Transaction>> filteredTransactionsProvider =
    FutureProvider.autoDispose<List<Transaction>>((ref) async {
      await ref.watch(recentTransactionsProvider.future);
      final filter = ref.watch(transactionFilterProvider);
      final query = ref.watch(searchQueryProvider);
      final result = await ref
          .watch(transactionRepositoryProvider)
          .search(query, filter: filter, limit: 200);
      final list = result.fold((l) => l, (f) => throw FailureException(f));
      return list;
    });

final StreamProvider<RecordingState> recordingStateProvider =
    StreamProvider.autoDispose<RecordingState>(
      (ref) => ref.watch(voiceServiceProvider).watchRecordingState(),
    );

final StreamProvider<double> amplitudeProvider =
    StreamProvider.autoDispose<double>(
      (ref) => ref.watch(voiceServiceProvider).watchAmplitude(),
    );

/// One transaction by id (detail screen).
final FutureProviderFamily<Transaction?, String> transactionByIdProvider =
    FutureProvider.autoDispose.family<Transaction?, String>((ref, id) async {
      await ref.watch(recentTransactionsProvider.future);
      final result = await ref.watch(transactionRepositoryProvider).getById(id);
      final transaction = result.fold(
        (t) => t,
        (f) => throw FailureException(f),
      );
      return transaction;
    });
