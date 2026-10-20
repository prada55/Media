// lib/features/auth/presentation/providers/auth_providers.dart
//
// Providers Riverpod de l'authentification. Les services viennent du
// conteneur get_it ; les tests remplacent ces providers via overrides.

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/di/injection.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/features/auth/domain/entities/auth_state.dart';
import 'package:yako/features/auth/domain/entities/user.dart';
import 'package:yako/features/auth/domain/repositories/auth_repository.dart';
import 'package:yako/features/auth/domain/services/auth_service.dart';
import 'package:yako/features/auth/domain/services/auto_lock_service.dart';
import 'package:yako/features/auth/domain/services/session_manager.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => getIt<AuthRepository>(),
);

final sessionManagerProvider = Provider<SessionManager>(
  (ref) => getIt<SessionManager>(),
);

final authServiceProvider = Provider<AuthService>(
  (ref) => AuthService(
    ref.watch(authRepositoryProvider),
    ref.watch(sessionManagerProvider),
  ),
);

/// User of the unlocked session, `null` otherwise.
final currentUserProvider = StreamProvider<User?>(
  (ref) => ref
      .watch(sessionManagerProvider)
      .watch()
      .map((snapshot) => snapshot.session?.user),
);

/// Remaining lockout, refreshed every second while watched.
final StreamProvider<Duration?> lockoutRemainingProvider =
    StreamProvider.autoDispose<Duration?>(
      (ref) => ref.watch(authServiceProvider).watchLockoutRemaining(),
    );

final autoLockServiceProvider = Provider<AutoLockService>((ref) {
  final service = AutoLockService(ref.watch(sessionManagerProvider))..start();
  ref.onDispose(service.dispose);
  return service;
});

/// Registered account (read from the database), for the login screen.
final FutureProvider<User?> registeredUserProvider =
    FutureProvider.autoDispose<User?>(
      (ref) async =>
          (await ref.watch(authServiceProvider).getCurrentUser()).getOrNull(),
    );

final authStateProvider = NotifierProvider<AuthController, AuthState>(
  AuthController.new,
);

/// Drives [AuthState] from user actions and session events.
class AuthController extends Notifier<AuthState> {
  late AuthService _service;
  bool _offerBiometrics = false;

  @override
  AuthState build() {
    _service = ref.watch(authServiceProvider);
    final sub = _service.session.watch().listen(_onSession);
    ref.onDispose(sub.cancel);
    unawaited(_bootstrap());
    return const AuthLoading();
  }

  Future<void> _bootstrap() async {
    final result = await _service.getCurrentUser();
    if (!ref.mounted || state is! AuthLoading) return;
    final user = result.getOrNull();
    state = switch (user) {
      null => const AuthUnauthenticated(hasAccount: false),
      User(biometricEnabled: true) => AuthBiometricRequired(user),
      _ => const AuthUnauthenticated(hasAccount: true),
    };
  }

  void _onSession(SessionSnapshot snapshot) {
    if (!ref.mounted) return;
    switch (snapshot.status) {
      case SessionStatus.active:
        state = AuthAuthenticated(
          snapshot.session!.user,
          offerBiometrics: _offerBiometrics,
        );
      case SessionStatus.locked:
        state = AuthLocked(snapshot.lockedUser!);
      case SessionStatus.none:
        break;
    }
  }

  Future<Result<User>> register({
    required String phone,
    required String pin,
    required LanguageCode language,
  }) async {
    _offerBiometrics = await _service.isBiometricAvailable();
    return await _service.register(phone: phone, pin: pin, language: language);
  }

  Future<Result<User>> login({required String phone, required String pin}) =>
      _service.login(phone: phone, pin: pin);

  Future<Result<User>> unlockWithPin(String pin) => _service.unlockWithPin(pin);

  Future<Result<User>> loginWithBiometrics({required String reason}) =>
      _service.loginWithBiometrics(reason: reason);

  Future<Result<User>> enableBiometrics({required String reason}) {
    _offerBiometrics = false;
    return _service.enableBiometrics(reason: reason);
  }

  Future<Result<User>> disableBiometrics() => _service.disableBiometrics();

  void dismissBiometricOffer() {
    _offerBiometrics = false;
    if (state case AuthAuthenticated(:final user)) {
      state = AuthAuthenticated(user);
    }
  }

  void lock() => _service.lock();

  Future<Result<void>> logout() async {
    final result = await _service.logout();
    if (ref.mounted) state = const AuthUnauthenticated(hasAccount: true);
    return result;
  }

  Future<Result<void>> deleteAccount({required String pin}) async {
    final result = await _service.deleteAccount(pin: pin);
    if (result.isSuccess && ref.mounted) {
      state = const AuthUnauthenticated(hasAccount: false);
    }
    return result;
  }
}
