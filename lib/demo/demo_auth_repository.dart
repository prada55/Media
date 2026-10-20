// lib/demo/demo_auth_repository.dart
//
// DÉMO WEB UNIQUEMENT : compte en mémoire (perdu au rechargement de la
// page), sans chiffrement ni Keychain. Mêmes règles de validation et de
// verrouillage que l'application mobile pour un rendu fidèle.

import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/core/utils/phone_validator.dart';
import 'package:yako/core/utils/pin_validator.dart';
import 'package:yako/features/auth/domain/entities/auth_session.dart';
import 'package:yako/features/auth/domain/entities/user.dart';
import 'package:yako/features/auth/domain/repositories/auth_repository.dart';
import 'package:yako/features/auth/domain/services/lockout_policy.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';

/// In-memory [AuthRepository] for the web demo.
class DemoAuthRepository implements AuthRepository {
  User? _user;
  String? _phone;
  String? _pin;
  int _failures = 0;
  DateTime? _lockedUntil;

  /// Masked number shown in the settings.
  String? get maskedPhone {
    final phone = _phone;
    return phone == null ? null : PhoneValidator.mask(phone);
  }

  AuthSession _session() => AuthSession(user: _user!, dataKey: 'demo');

  Result<AuthSession>? _checkLock() {
    final until = _lockedUntil;
    if (until != null && until.isAfter(DateTime.now())) {
      return FailureResult(
        LockedOutFailure(remaining: until.difference(DateTime.now())),
      );
    }
    return null;
  }

  Result<AuthSession> _fail() {
    _failures++;
    final lock = LockoutPolicy.lockDurationFor(_failures);
    if (lock != null) {
      _lockedUntil = DateTime.now().add(lock);
      return FailureResult(LockedOutFailure(remaining: lock));
    }
    return FailureResult(
      AuthenticationFailure(
        technicalMessage: 'Invalid credentials',
        remainingAttempts: LockoutPolicy.remainingBeforeLock(_failures),
      ),
    );
  }

  Result<AuthSession> _succeed() {
    _failures = 0;
    _lockedUntil = null;
    return Success(_session());
  }

  @override
  Future<Result<AuthSession>> register({
    required String phone,
    required String pin,
    required LanguageCode language,
  }) async {
    final national = PhoneValidator.normalize(phone);
    if (national case FailureResult(:final failure)) {
      return FailureResult(failure);
    }
    final checked = PinValidator.validate(
      pin,
      nationalPhone: national.getOrNull(),
    );
    if (checked case FailureResult(:final failure)) {
      return FailureResult(failure);
    }
    _phone = national.getOrNull();
    _pin = pin;
    _user = User(
      id: 'demo',
      phoneHash: 'demo',
      language: language,
      biometricEnabled: false,
      createdAt: DateTime.now(),
    );
    return Success(_session());
  }

  @override
  Future<Result<AuthSession>> login({
    required String phone,
    required String pin,
  }) async {
    final locked = _checkLock();
    if (locked != null) return locked;
    final national = PhoneValidator.normalize(phone).getOrNull();
    if (_user == null || national != _phone || pin != _pin) return _fail();
    return _succeed();
  }

  @override
  Future<Result<AuthSession>> unlockWithPin(String pin) async {
    final locked = _checkLock();
    if (locked != null) return locked;
    if (_user == null || pin != _pin) return _fail();
    return _succeed();
  }

  @override
  Future<Result<AuthSession>> loginWithBiometrics({
    required String reason,
  }) async => const FailureResult(
    BiometricFailure(
      technicalMessage: 'No biometrics in web demo',
      userMessageFr: 'Empreinte indisponible dans la démo web.',
    ),
  );

  @override
  Future<Result<void>> logout() async => const Success(null);

  @override
  Future<Result<void>> changePin({
    required String currentPin,
    required String newPin,
  }) async {
    if (currentPin != _pin) return _fail();
    final checked = PinValidator.validate(newPin, nationalPhone: _phone);
    if (checked case FailureResult(:final failure)) {
      return FailureResult(failure);
    }
    _pin = newPin;
    return const Success(null);
  }

  @override
  Future<bool> isBiometricAvailable() async => false;

  @override
  Future<Result<User>> enableBiometrics(
    AuthSession session, {
    required String reason,
  }) async => const FailureResult(
    BiometricFailure(
      technicalMessage: 'No biometrics in web demo',
      userMessageFr: 'Empreinte indisponible dans la démo web.',
    ),
  );

  @override
  Future<Result<User>> disableBiometrics() async => Success(_user!);

  @override
  Future<Result<User>> setLanguage(LanguageCode language) async {
    _user = _user!.copyWith(language: language);
    return Success(_user!);
  }

  @override
  Future<Result<void>> deleteAccount({required String pin}) async {
    if (pin != _pin) {
      final failure = _fail().getFailureOrNull()!;
      return FailureResult(failure);
    }
    _user = null;
    _phone = null;
    _pin = null;
    return const Success(null);
  }

  @override
  Future<Result<User?>> getCurrentUser() async => Success(_user);

  @override
  Future<Result<bool>> hasRegisteredUser() async => Success(_user != null);

  @override
  Future<Result<Duration?>> getLockoutRemaining() async {
    final until = _lockedUntil;
    if (until == null || !until.isAfter(DateTime.now())) {
      return const Success(null);
    }
    return Success(until.difference(DateTime.now()));
  }
}
