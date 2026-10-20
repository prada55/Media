// lib/core/security/key_vault.dart
//
// Coffre de secrets applicatifs dans Keychain / Keystore :
// - clé de données enveloppée par le PIN (AES-GCM, clé dérivée PBKDF2) ;
// - clé de données pour la biométrie (présente seulement si activée) ;
// - indice de numéro masqué, chiffré avec la clé de données.

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';

/// Typed access to the secrets kept in secure storage.
class KeyVault {
  const KeyVault(this._storage);

  static const String wrappedDataKey = 'yako.data_key.pin';
  static const String biometricDataKey = 'yako.data_key.biometric';
  static const String phoneHint = 'yako.phone_hint';

  final FlutterSecureStorage _storage;

  Future<Result<void>> write(String key, String value) =>
      _guard(() => _storage.write(key: key, value: value), 'write');

  Future<Result<String?>> read(String key) =>
      _guard(() => _storage.read(key: key), 'read');

  Future<Result<void>> delete(String key) =>
      _guard(() => _storage.delete(key: key), 'delete');

  Future<Result<T>> _guard<T>(Future<T> Function() action, String op) async {
    try {
      return Success(await action());
    } on Object catch (e, st) {
      return FailureResult(
        EncryptionFailure(
          technicalMessage: 'Key vault $op failed',
          cause: e,
          stackTrace: st,
        ),
      );
    }
  }
}
