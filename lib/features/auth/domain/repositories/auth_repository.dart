// lib/features/auth/domain/repositories/auth_repository.dart
//
// Contrat d'authentification locale. Tout passe par Result : aucune
// exception ne remonte à la présentation.

import 'package:yako/core/error/result.dart';
import 'package:yako/features/auth/domain/entities/auth_session.dart';
import 'package:yako/features/auth/domain/entities/user.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';

/// Local authentication repository.
abstract interface class AuthRepository {
  /// Creates the single local account and opens a session.
  Future<Result<AuthSession>> register({
    required String phone,
    required String pin,
    required LanguageCode language,
  });

  /// Phone + PIN login (counts failures, enforces lockout).
  Future<Result<AuthSession>> login({
    required String phone,
    required String pin,
  });

  /// PIN-only unlock after an auto-lock (same lockout rules).
  Future<Result<AuthSession>> unlockWithPin(String pin);

  /// Biometric prompt, then reads the data key from Keychain / Keystore.
  Future<Result<AuthSession>> loginWithBiometrics({required String reason});

  /// Ends the session; keeps the database and keys.
  Future<Result<void>> logout();

  Future<Result<void>> changePin({
    required String currentPin,
    required String newPin,
  });

  /// Whether the device can do biometrics at all.
  Future<bool> isBiometricAvailable();

  Future<Result<User>> enableBiometrics(
    AuthSession session, {
    required String reason,
  });

  Future<Result<User>> disableBiometrics();

  Future<Result<User>> setLanguage(LanguageCode language);

  /// Requires the PIN; wipes database files, keys and biometrics.
  Future<Result<void>> deleteAccount({required String pin});

  Future<Result<User?>> getCurrentUser();

  Future<Result<bool>> hasRegisteredUser();

  /// Remaining lockout, `null` when login is allowed.
  Future<Result<Duration?>> getLockoutRemaining();
}
