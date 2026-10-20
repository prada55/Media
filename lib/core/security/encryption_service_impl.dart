// lib/core/security/encryption_service_impl.dart
//
// Implémentation des primitives cryptographiques.
// - PBKDF2-HMAC-SHA256 100 000 itérations, exécuté dans un isolate pour ne
//   pas bloquer l'UI sur les téléphones d'entrée de gamme.
// - AES-256-GCM via package:cryptography (nonce 96 bits aléatoire, tag 128).
// - Clés stockées dans Keychain (iOS, *this device only*) / Keystore
//   (Android, chiffrement AES-GCM de flutter_secure_storage 11).
// Aucune clé ni aucun PIN n'est jamais journalisé.

import 'dart:convert';
import 'dart:io';
import 'dart:isolate';
import 'dart:math';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:yako/core/config/config_signature.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/core/platform/app_directories.dart';
import 'package:yako/core/security/encryption_service.dart';
import 'package:yako/data/local/database_opener.dart';

/// Number of PBKDF2 iterations (OWASP MASVS L1 baseline for this app).
const int kPbkdf2Iterations = 100000;

/// Secure-storage key holding the SQLCipher database key.
const String kDbKeyStorageKey = 'yako.db_key';

/// Secure-storage options shared by the whole app.
const FlutterSecureStorage kYakoSecureStorage = FlutterSecureStorage(
  iOptions: IOSOptions(
    accessibility: KeychainAccessibility.first_unlock_this_device,
  ),
  aOptions: AndroidOptions(storageNamespace: 'yako'),
);

/// Version byte prefixed to every sealed payload (format evolution).
const int _formatVersion = 1;
const int _keyLength = 32;
const int _nonceLength = 12;
const int _macLength = 16;

// Domain separation: the PIN verifier must never equal the derived key.
const String _keyDomain = 'yako/db-key/v1';
const String _verifierDomain = 'yako/pin-verifier/v1';

/// Default [EncryptionService].
class EncryptionServiceImpl implements EncryptionService {
  EncryptionServiceImpl({
    this._storage = kYakoSecureStorage,
    this._directories = const AppDirectories(),
    Random? random,
    int pbkdf2Iterations = kPbkdf2Iterations,
  }) : _random = random ?? Random.secure(),
       _iterations = pbkdf2Iterations;

  final FlutterSecureStorage _storage;
  final AppDirectories _directories;
  final Random _random;
  final int _iterations;
  final AesGcm _aes = AesGcm.with256bits();

  @override
  Future<Result<String>> deriveKeyFromPin(String pin, String salt) =>
      _pbkdf2(pin, salt, _keyDomain);

  @override
  Future<Result<String>> hashPin(String pin, String salt) =>
      _pbkdf2(pin, salt, _verifierDomain);

  @override
  Future<Result<bool>> verifyPin(
    String pin,
    String salt,
    String expectedHash,
  ) async {
    final computed = await hashPin(pin, salt);
    return computed.map((hash) => constantTimeEquals(hash, expectedHash));
  }

  @override
  Result<String> generateSalt() => _randomBase64();

  @override
  Result<String> generateKey() => _randomBase64();

  Result<String> _randomBase64() {
    try {
      final bytes = Uint8List(_keyLength);
      for (var i = 0; i < bytes.length; i++) {
        bytes[i] = _random.nextInt(256);
      }
      return Success(base64Encode(bytes));
    } on Object catch (e, st) {
      return FailureResult(
        EncryptionFailure(
          technicalMessage: 'Random generation failed',
          cause: e,
          stackTrace: st,
        ),
      );
    }
  }

  Future<Result<String>> _pbkdf2(String pin, String salt, String domain) async {
    try {
      final saltBytes = base64Decode(salt);
      if (saltBytes.length < 16) {
        return const FailureResult(
          EncryptionFailure(technicalMessage: 'Salt too short'),
        );
      }
      final nonce = <int>[...saltBytes, ...utf8.encode(domain)];
      final iterations = _iterations;
      final bytes = await Isolate.run(() async {
        final algorithm = Pbkdf2(
          macAlgorithm: Hmac.sha256(),
          iterations: iterations,
          bits: _keyLength * 8,
        );
        final key = await algorithm.deriveKeyFromPassword(
          password: pin,
          nonce: nonce,
        );
        return await key.extractBytes();
      });
      return Success(base64Encode(bytes));
    } on Object catch (e, st) {
      return FailureResult(
        EncryptionFailure(
          technicalMessage: 'PBKDF2 derivation failed',
          cause: e,
          stackTrace: st,
        ),
      );
    }
  }

  @override
  Future<Result<void>> storeDbKey(String keyBase64) => _guardStorage(
    () => _storage.write(key: kDbKeyStorageKey, value: keyBase64),
    'storeDbKey',
  );

  @override
  Future<Result<String?>> getDbKey() =>
      _guardStorage(() => _storage.read(key: kDbKeyStorageKey), 'getDbKey');

  @override
  Future<Result<void>> deleteDbKey() => _guardStorage(
    () => _storage.delete(key: kDbKeyStorageKey),
    'deleteDbKey',
  );

  Future<Result<T>> _guardStorage<T>(
    Future<T> Function() action,
    String operation,
  ) async {
    try {
      return Success(await action());
    } on Object catch (e, st) {
      return FailureResult(
        EncryptionFailure(
          technicalMessage: 'Secure storage $operation failed',
          cause: e,
          stackTrace: st,
        ),
      );
    }
  }

  @override
  Future<Result<String>> encryptAesGcm(
    String plaintext,
    String keyBase64,
  ) async {
    final sealed = await encryptBytes(
      Uint8List.fromList(utf8.encode(plaintext)),
      keyBase64,
    );
    return sealed.map(base64Encode);
  }

  @override
  Future<Result<String>> decryptAesGcm(
    String ciphertext,
    String keyBase64,
  ) async {
    final Uint8List sealed;
    try {
      sealed = base64Decode(ciphertext);
    } on FormatException catch (e, st) {
      return FailureResult(
        EncryptionFailure(
          technicalMessage: 'Ciphertext is not valid base64',
          cause: e,
          stackTrace: st,
        ),
      );
    }
    final clear = await decryptBytes(sealed, keyBase64);
    return clear.flatMap((bytes) {
      try {
        return Success(utf8.decode(bytes));
      } on FormatException catch (e, st) {
        return FailureResult(
          EncryptionFailure(
            technicalMessage: 'Decrypted payload is not UTF-8',
            cause: e,
            stackTrace: st,
          ),
        );
      }
    });
  }

  @override
  Future<Result<Uint8List>> encryptBytes(
    Uint8List clear,
    String keyBase64,
  ) async {
    try {
      final key = _secretKey(keyBase64);
      final box = await _aes.encrypt(
        clear,
        secretKey: key,
        nonce: _aes.newNonce(),
      );
      final builder = BytesBuilder(copy: false)
        ..addByte(_formatVersion)
        ..add(box.concatenation());
      return Success(builder.takeBytes());
    } on Object catch (e, st) {
      return FailureResult(
        EncryptionFailure(
          technicalMessage: 'AES-GCM encryption failed',
          cause: e,
          stackTrace: st,
        ),
      );
    }
  }

  @override
  Future<Result<Uint8List>> decryptBytes(
    Uint8List sealed,
    String keyBase64,
  ) async {
    try {
      if (sealed.length < 1 + _nonceLength + _macLength ||
          sealed[0] != _formatVersion) {
        return const FailureResult(
          EncryptionFailure(technicalMessage: 'Unknown sealed format'),
        );
      }
      final box = SecretBox.fromConcatenation(
        Uint8List.sublistView(sealed, 1),
        nonceLength: _nonceLength,
        macLength: _macLength,
      );
      final clear = await _aes.decrypt(box, secretKey: _secretKey(keyBase64));
      return Success(Uint8List.fromList(clear));
    } on Object catch (e, st) {
      return FailureResult(
        EncryptionFailure(
          technicalMessage: 'AES-GCM decryption failed (key or integrity)',
          cause: e,
          stackTrace: st,
        ),
      );
    }
  }

  SecretKey _secretKey(String keyBase64) {
    final bytes = base64Decode(keyBase64);
    if (bytes.length != _keyLength) {
      throw ArgumentError('AES key must be 32 bytes');
    }
    return SecretKey(bytes);
  }

  @override
  Future<Result<void>> secureWipe() async {
    try {
      await _storage.deleteAll();
      final dir = await _directories.documents();
      final base = databasePath(dir);
      for (final path in [base, '$base-wal', '$base-shm', '$base-journal']) {
        await _overwriteAndDelete(File(path));
      }
      return const Success(null);
    } on Object catch (e, st) {
      return FailureResult(
        EncryptionFailure(
          technicalMessage: 'Secure wipe failed',
          cause: e,
          stackTrace: st,
        ),
      );
    }
  }

  Future<void> _overwriteAndDelete(File file) async {
    if (!file.existsSync()) return;
    final length = await file.length();
    final raf = await file.open(mode: FileMode.writeOnly);
    try {
      const chunk = 64 * 1024;
      final buffer = Uint8List(chunk);
      var written = 0;
      while (written < length) {
        final size = min(chunk, length - written);
        for (var i = 0; i < size; i++) {
          buffer[i] = _random.nextInt(256);
        }
        await raf.writeFrom(buffer, 0, size);
        written += size;
      }
      await raf.flush();
    } finally {
      await raf.close();
    }
    await file.delete();
  }
}
