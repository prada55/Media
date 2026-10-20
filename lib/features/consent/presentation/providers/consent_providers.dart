// lib/features/consent/presentation/providers/consent_providers.dart
//
// Consentements : état observé + actions (chaque bascule = 1 geste).

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/di/injection.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/features/auth/presentation/providers/auth_providers.dart';
import 'package:yako/features/consent/domain/entities/consent_state.dart';
import 'package:yako/features/consent/domain/repositories/consent_repository.dart';

final consentRepositoryProvider = Provider<ConsentRepository>(
  (ref) => getIt<ConsentRepository>(),
);

/// Live consents (all OFF until the user turns one on).
final StreamProvider<ConsentState> consentStateProvider =
    StreamProvider<ConsentState>((ref) {
      ref.watch(currentUserProvider.select((u) => u.value?.id));
      return ref.watch(consentRepositoryProvider).watch();
    });

final consentActionsProvider = Provider<ConsentActions>(ConsentActions.new);

/// Consent use cases.
class ConsentActions {
  ConsentActions(this._ref);

  final Ref _ref;

  ConsentRepository get _repo => _ref.read(consentRepositoryProvider);

  Future<Result<ConsentState>> set(ConsentKey key, {required bool value}) =>
      switch (key) {
        ConsentKey.creditScoreSharing => _repo.setCreditScoreSharing(
          value: value,
        ),
        ConsentKey.promotions => _repo.setPromotions(value: value),
        ConsentKey.diagnostics => _repo.setDiagnostics(value: value),
      };

  Future<Result<ConsentState>> revokeAll() => _repo.revokeAll();
}
