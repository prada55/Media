// lib/features/auth/domain/services/auth_service.dart
//
// Orchestration : appelle le dépôt, ouvre/verrouille/efface la session et
// expose le compte à rebours de verrouillage.

import 'dart:async';

import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/features/auth/domain/entities/auth_session.dart';
import 'package:yako/features/auth/domain/entities/user.dart';
import 'package:yako/features/auth/domain/repositories/auth_repository.dart';
import 'package:yako/features/auth/domain/services/session_manager.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';

/// Authentication use cases.
class AuthService {
  AuthService(this._repository, this._session);

  final AuthRepository _repository;
  final SessionManager _session;

  SessionManager get session => _session;

  Future<Result<User>> register({
    required String phone,
    required String pin,
    required LanguageCode language,
  }) async => _open(
    await _repository.register(phone: phone, pin: pin, language: language),
  );

  Future<Result<User>> login({
    required String phone,
    required String pin,
  }) async => _open(await _repository.login(phone: phone, pin: pin));

  Future<Result<User>> unlockWithPin(String pin) async =>
      _open(await _repository.unlockWithPin(pin));

  Future<Result<User>> loginWithBiometrics({required String reason}) async =>
      _open(await _repository.loginWithBiometrics(reason: reason));

  Future<Result<void>> logout() async {
    final result = await _repository.logout();
    _session.clear();
    return result;
  }

  void lock() => _session.lock();

  Future<Result<void>> changePin({
    required String currentPin,
    required String newPin,
  }) => _repository.changePin(currentPin: currentPin, newPin: newPin);

  Future<bool> isBiometricAvailable() => _repository.isBiometricAvailable();

  Future<Result<User>> enableBiometrics({required String reason}) async {
    final current = _session.current.session;
    if (current == null) return _noSession();
    return _refreshUser(
      await _repository.enableBiometrics(current, reason: reason),
    );
  }

  Future<Result<User>> disableBiometrics() async =>
      _refreshUser(await _repository.disableBiometrics());

  Future<Result<User>> setLanguage(LanguageCode language) async =>
      _refreshUser(await _repository.setLanguage(language));

  Future<Result<void>> deleteAccount({required String pin}) async {
    final result = await _repository.deleteAccount(pin: pin);
    if (result.isSuccess) _session.clear();
    return result;
  }

  Future<Result<User?>> getCurrentUser() => _repository.getCurrentUser();

  /// Reads the lockout once, then counts down locally every [tick] and
  /// completes with `null` when login is allowed again. Callers re-read it
  /// after each failed attempt.
  Stream<Duration?> watchLockoutRemaining({
    Duration tick = const Duration(seconds: 1),
  }) async* {
    var remaining = (await _repository.getLockoutRemaining()).getOrNull();
    while (remaining != null && remaining > Duration.zero) {
      yield remaining;
      await Future<void>.delayed(tick);
      remaining -= tick;
    }
    yield null;
  }

  Result<User> _open(Result<AuthSession> result) => result.map((session) {
    _session.start(session);
    return session.user;
  });

  Result<User> _refreshUser(Result<User> result) {
    if (result case Success(:final value)) _session.updateUser(value);
    return result;
  }

  Result<User> _noSession() => const FailureResult(
    AuthenticationFailure(
      technicalMessage: 'No active session',
      userMessageFr: 'Session expirée. Reconnectez-vous.',
    ),
  );
}
