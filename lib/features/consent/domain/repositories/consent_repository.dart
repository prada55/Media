// lib/features/consent/domain/repositories/consent_repository.dart
//
// Contrat des consentements (table `consent`).

import 'package:yako/core/error/result.dart';
import 'package:yako/features/consent/domain/entities/consent_state.dart';

/// Consent storage.
abstract interface class ConsentRepository {
  Future<Result<ConsentState>> getConsentState();

  Future<Result<ConsentState>> setCreditScoreSharing({required bool value});

  Future<Result<ConsentState>> setPromotions({required bool value});

  Future<Result<ConsentState>> setDiagnostics({required bool value});

  /// Turns every consent off in one step.
  Future<Result<ConsentState>> revokeAll();

  Stream<ConsentState> watch();
}
