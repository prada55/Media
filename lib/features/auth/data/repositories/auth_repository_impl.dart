// lib/features/auth/data/repositories/auth_repository_impl.dart
//
// Authentification 100 % locale.
// - Téléphone : seulement SHA-256(sel + numéro) en base.
// - PIN : seulement son vérificateur PBKDF2 en base.
// - Clé de données (montants, transcriptions) : aléatoire, enveloppée par
//   une clé dérivée du PIN ; copie biométrique seulement si activée.
// - Verrouillage progressif après 5 échecs (table auth_attempts).

import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';
import 'package:yako/core/config/config_signature.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/core/security/encryption_service.dart';
import 'package:yako/core/security/key_vault.dart';
import 'package:yako/core/utils/phone_validator.dart';
import 'package:yako/core/utils/pin_validator.dart';
import 'package:yako/data/local/database.dart';
import 'package:yako/data/local/database_manager.dart';
import 'package:yako/features/auth/data/datasources/biometric_datasource.dart';
import 'package:yako/features/auth/domain/entities/auth_session.dart';
import 'package:yako/features/auth/domain/entities/user.dart';
import 'package:yako/features/auth/domain/repositories/auth_repository.dart';
import 'package:yako/features/auth/domain/services/lockout_policy.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';

/// Hook run during account deletion (e.g. wiping encrypted audio files).
typedef AccountWiper = Future<void> Function();

/// Default [AuthRepository].
class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl({
    required DatabaseManager databaseManager,
    required this._encryption,
    required this._vault,
    required this._biometrics,
    this._extraWipers = const [],
    DateTime Function()? now,
    this._uuid = const Uuid(),
  }) : _db = databaseManager,
       _now = now ?? DateTime.now;

  final DatabaseManager _db;
  final EncryptionService _encryption;
  final KeyVault _vault;
  final BiometricDatasource _biometrics;
  final List<AccountWiper> _extraWipers;
  final DateTime Function() _now;
  final Uuid _uuid;

  @override
  Future<Result<AuthSession>> register({
    required String phone,
    required String pin,
    required LanguageCode language,
  }) => _withDb((db) async {
    final national = _ok(PhoneValidator.normalize(phone));
    _ok(PinValidator.validate(pin, nationalPhone: national));
    if (await _userRow(db) != null) {
      throw const _Abort(
        ValidationFailure(
          technicalMessage: 'Account already exists',
          userMessageFr: 'Un compte existe déjà sur ce téléphone.',
        ),
      );
    }
    final salt = _ok(_encryption.generateSalt());
    final pinHash = _ok(await _encryption.hashPin(pin, salt));
    final dataKey = _ok(_encryption.generateKey());
    final kek = _ok(await _encryption.deriveKeyFromPin(pin, salt));
    final wrapped = _ok(await _encryption.encryptAesGcm(dataKey, kek));
    final hint = _ok(
      await _encryption.encryptAesGcm(PhoneValidator.mask(national), dataKey),
    );
    _ok(await _vault.write(KeyVault.wrappedDataKey, wrapped));
    _ok(await _vault.write(KeyVault.phoneHint, hint));

    final now = _now();
    final row = UserRow(
      id: _uuid.v4(),
      phoneHash: _phoneHash(national, salt),
      pinHash: pinHash,
      pinSalt: salt,
      biometricEnabled: false,
      language: language.code,
      createdAt: now,
      updatedAt: now,
    );
    await db.into(db.users).insert(row);
    await _audit(db, 'register');
    return Success(AuthSession(user: _toUser(row), dataKey: dataKey));
  });

  @override
  Future<Result<AuthSession>> login({
    required String phone,
    required String pin,
  }) => _withDb((db) async {
    final row = await _requireUser(db);
    await _ensureNotLocked(db, row.phoneHash);
    final national = PhoneValidator.normalize(phone).getOrNull();
    final phoneOk =
        national != null &&
        constantTimeEquals(_phoneHash(national, row.pinSalt), row.phoneHash);
    final pinOk = _ok(
      await _encryption.verifyPin(pin, row.pinSalt, row.pinHash),
    );
    if (!phoneOk || !pinOk) return await _recordFailure(db, row.phoneHash);
    return await _openSession(db, row, pin);
  });

  @override
  Future<Result<AuthSession>> unlockWithPin(String pin) => _withDb((db) async {
    final row = await _requireUser(db);
    await _ensureNotLocked(db, row.phoneHash);
    final pinOk = _ok(
      await _encryption.verifyPin(pin, row.pinSalt, row.pinHash),
    );
    if (!pinOk) return await _recordFailure(db, row.phoneHash);
    return await _openSession(db, row, pin);
  });

  @override
  Future<Result<AuthSession>> loginWithBiometrics({required String reason}) =>
      _withDb((db) async {
        final row = await _requireUser(db);
        if (!row.biometricEnabled) {
          throw const _Abort(
            BiometricFailure(technicalMessage: 'Biometrics not enabled'),
          );
        }
        if (!await _biometrics.authenticate(reason: reason)) {
          await _audit(db, 'biometric_failure');
          throw const _Abort(
            BiometricFailure(technicalMessage: 'Biometric not recognized'),
          );
        }
        final key = _ok(await _vault.read(KeyVault.biometricDataKey));
        if (key == null) {
          throw const _Abort(
            BiometricFailure(technicalMessage: 'Biometric key missing'),
          );
        }
        await _audit(db, 'login_biometric');
        return Success(AuthSession(user: _toUser(row), dataKey: key));
      });

  @override
  Future<Result<void>> logout() => _withDb((db) async {
    await _audit(db, 'logout');
    return const Success(null);
  });

  @override
  Future<Result<void>> changePin({
    required String currentPin,
    required String newPin,
  }) => _withDb((db) async {
    final row = await _requireUser(db);
    await _ensureNotLocked(db, row.phoneHash);
    final ok = _ok(
      await _encryption.verifyPin(currentPin, row.pinSalt, row.pinHash),
    );
    if (!ok) return await _recordFailure(db, row.phoneHash);
    _ok(PinValidator.validate(newPin));
    if (newPin == currentPin) {
      throw const _Abort(
        ValidationFailure(
          technicalMessage: 'New PIN equals current PIN',
          userMessageFr: 'Le nouveau code doit être différent.',
        ),
      );
    }
    final dataKey = await _unwrapDataKey(currentPin, row.pinSalt);
    final newKek = _ok(await _encryption.deriveKeyFromPin(newPin, row.pinSalt));
    final wrapped = _ok(await _encryption.encryptAesGcm(dataKey, newKek));
    final newHash = _ok(await _encryption.hashPin(newPin, row.pinSalt));
    _ok(await _vault.write(KeyVault.wrappedDataKey, wrapped));
    await (db.update(db.users)..where((u) => u.id.equals(row.id))).write(
      UsersCompanion(pinHash: Value(newHash), updatedAt: Value(_now())),
    );
    await _resetAttempts(db, row.phoneHash);
    await _audit(db, 'pin_changed');
    return const Success(null);
  });

  @override
  Future<bool> isBiometricAvailable() => _biometrics.isAvailable();

  @override
  Future<Result<User>> enableBiometrics(
    AuthSession session, {
    required String reason,
  }) => _withDb((db) async {
    if (!await _biometrics.isAvailable()) {
      throw const _Abort(
        BiometricFailure(
          technicalMessage: 'Biometrics unavailable',
          userMessageFr: 'Ce téléphone ne permet pas la biométrie.',
        ),
      );
    }
    if (!await _biometrics.authenticate(reason: reason)) {
      throw const _Abort(
        BiometricFailure(technicalMessage: 'Biometric not recognized'),
      );
    }
    _ok(await _vault.write(KeyVault.biometricDataKey, session.dataKey));
    return await _setBiometricFlag(db, enabled: true);
  });

  @override
  Future<Result<User>> disableBiometrics() => _withDb((db) async {
    _ok(await _vault.delete(KeyVault.biometricDataKey));
    return await _setBiometricFlag(db, enabled: false);
  });

  @override
  Future<Result<User>> setLanguage(LanguageCode language) =>
      _withDb((db) async {
        final row = await _requireUser(db);
        await (db.update(db.users)..where((u) => u.id.equals(row.id))).write(
          UsersCompanion(language: Value(language.code)),
        );
        return Success(_toUser(row.copyWith(language: language.code)));
      });

  @override
  Future<Result<void>> deleteAccount({required String pin}) => _withDb((
    db,
  ) async {
    final row = await _requireUser(db);
    await _ensureNotLocked(db, row.phoneHash);
    final ok = _ok(await _encryption.verifyPin(pin, row.pinSalt, row.pinHash));
    if (!ok) return await _recordFailure(db, row.phoneHash);
    _ok(await _vault.delete(KeyVault.biometricDataKey));
    for (final wipe in _extraWipers) {
      await wipe();
    }
    await _db.close();
    // Deletes every Keychain/Keystore entry and overwrites DB files.
    _ok(await _encryption.secureWipe());
    return const Success(null);
  });

  @override
  Future<Result<User?>> getCurrentUser() => _withDb((db) async {
    final row = await _userRow(db);
    return Success(row == null ? null : _toUser(row));
  });

  @override
  Future<Result<bool>> hasRegisteredUser() =>
      _withDb((db) async => Success(await _userRow(db) != null));

  @override
  Future<Result<Duration?>> getLockoutRemaining() => _withDb((db) async {
    final row = await _userRow(db);
    if (row == null) return const Success(null);
    return Success(await _lockRemaining(db, row.phoneHash));
  });

  // ---------------------------------------------------------------------
  // Helpers

  Future<Result<T>> _withDb<T>(
    Future<Result<T>> Function(AppDatabase db) action,
  ) async {
    final opened = await _db.open();
    if (opened case FailureResult(:final failure)) {
      return FailureResult(failure);
    }
    try {
      return await action(opened.getOrNull()!);
    } on _Abort catch (abort) {
      return FailureResult(abort.failure);
    } on Object catch (e, st) {
      return FailureResult(
        DatabaseFailure(
          technicalMessage: 'Auth storage operation failed',
          cause: e,
          stackTrace: st,
        ),
      );
    }
  }

  /// Unwraps [result] or aborts the current `_withDb` block.
  T _ok<T>(Result<T> result) => switch (result) {
    Success(:final value) => value,
    FailureResult(:final failure) => throw _Abort(failure),
  };

  Future<UserRow?> _userRow(AppDatabase db) =>
      (db.select(db.users)..limit(1)).getSingleOrNull();

  Future<UserRow> _requireUser(AppDatabase db) async {
    final row = await _userRow(db);
    if (row == null) {
      throw const _Abort(
        AuthenticationFailure(
          technicalMessage: 'No registered account',
          userMessageFr: 'Aucun compte sur ce téléphone.',
        ),
      );
    }
    return row;
  }

  String _phoneHash(String national, String salt) =>
      sha256.convert(utf8.encode('$salt:$national')).toString();

  Future<Duration?> _lockRemaining(AppDatabase db, String phoneHash) async {
    final attempts = await (db.select(
      db.authAttempts,
    )..where((a) => a.phoneHash.equals(phoneHash))).getSingleOrNull();
    final until = attempts?.lockedUntil;
    if (until == null) return null;
    final remaining = until.difference(_now());
    return remaining > Duration.zero ? remaining : null;
  }

  Future<void> _ensureNotLocked(AppDatabase db, String phoneHash) async {
    final remaining = await _lockRemaining(db, phoneHash);
    if (remaining != null) throw _Abort(LockedOutFailure(remaining: remaining));
  }

  Future<Result<T>> _recordFailure<T>(AppDatabase db, String phoneHash) async {
    final current = await (db.select(
      db.authAttempts,
    )..where((a) => a.phoneHash.equals(phoneHash))).getSingleOrNull();
    final count = (current?.attemptCount ?? 0) + 1;
    final lock = LockoutPolicy.lockDurationFor(count);
    final now = _now();
    await db
        .into(db.authAttempts)
        .insertOnConflictUpdate(
          AuthAttemptRow(
            id: phoneHash,
            phoneHash: phoneHash,
            attemptCount: count,
            lockedUntil: lock == null ? null : now.add(lock),
            updatedAt: now,
          ),
        );
    await _audit(db, lock == null ? 'login_failure' : 'lockout');
    if (lock != null) return FailureResult(LockedOutFailure(remaining: lock));
    return FailureResult(
      AuthenticationFailure(
        technicalMessage: 'Invalid credentials',
        remainingAttempts: LockoutPolicy.remainingBeforeLock(count),
      ),
    );
  }

  Future<void> _resetAttempts(AppDatabase db, String phoneHash) => (db.delete(
    db.authAttempts,
  )..where((a) => a.phoneHash.equals(phoneHash))).go();

  Future<String> _unwrapDataKey(String pin, String salt) async {
    final kek = _ok(await _encryption.deriveKeyFromPin(pin, salt));
    final wrapped = _ok(await _vault.read(KeyVault.wrappedDataKey));
    if (wrapped == null) {
      throw const _Abort(
        EncryptionFailure(technicalMessage: 'Wrapped data key missing'),
      );
    }
    final dataKey = _ok(await _encryption.decryptAesGcm(wrapped, kek));
    return dataKey;
  }

  Future<Result<AuthSession>> _openSession(
    AppDatabase db,
    UserRow row,
    String pin,
  ) async {
    final dataKey = await _unwrapDataKey(pin, row.pinSalt);
    await _resetAttempts(db, row.phoneHash);
    await _audit(db, 'login_success');
    return Success(AuthSession(user: _toUser(row), dataKey: dataKey));
  }

  Future<Result<User>> _setBiometricFlag(
    AppDatabase db, {
    required bool enabled,
  }) async {
    final row = await _requireUser(db);
    await (db.update(db.users)..where((u) => u.id.equals(row.id))).write(
      UsersCompanion(
        biometricEnabled: Value(enabled),
        updatedAt: Value(_now()),
      ),
    );
    await _audit(db, enabled ? 'biometric_enabled' : 'biometric_disabled');
    return Success(_toUser(row.copyWith(biometricEnabled: enabled)));
  }

  Future<void> _audit(AppDatabase db, String eventType) => db
      .into(db.auditLog)
      .insert(
        AuditLogCompanion.insert(
          id: _uuid.v4(),
          eventType: eventType,
          createdAt: _now(),
        ),
      );

  User _toUser(UserRow row) => User(
    id: row.id,
    phoneHash: row.phoneHash,
    language: LanguageCode.fromCode(row.language),
    biometricEnabled: row.biometricEnabled,
    createdAt: row.createdAt,
  );
}

/// Internal early-exit carrying a [Failure]; never escapes `_withDb`.
final class _Abort implements Exception {
  const _Abort(this.failure);

  final Failure failure;
}
