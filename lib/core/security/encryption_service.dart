// lib/core/security/encryption_service.dart
//
// Contrat des primitives cryptographiques de Yako. Toutes les méthodes
// renvoient un Result : aucune exception ne fuit, et aucune clé, aucun PIN
// n'est jamais journalisé.

import 'dart:typed_data';

import 'package:yako/core/error/result.dart';

/// Cryptographic primitives and key storage.
abstract interface class EncryptionService {
  /// PBKDF2-HMAC-SHA256 (100k iterations) of [pin] with base64 [salt].
  /// Returns a base64 32-byte key.
  Future<Result<String>> deriveKeyFromPin(String pin, String salt);

  /// Plain PBKDF2-HMAC-SHA256 (100k iterations, no domain suffix) of a
  /// user password with base64 [salt] — used for portable exports.
  Future<Result<String>> deriveKeyFromPassword(String password, String salt);

  /// 32 random bytes from `Random.secure()`, base64-encoded.
  Result<String> generateSalt();

  /// 32 random bytes usable as an AES-256 / SQLCipher key, base64-encoded.
  Result<String> generateKey();

  /// PIN verifier (PBKDF2, domain-separated from [deriveKeyFromPin]).
  Future<Result<String>> hashPin(String pin, String salt);

  /// Constant-time check of [pin] against a stored [expectedHash].
  Future<Result<bool>> verifyPin(String pin, String salt, String expectedHash);

  /// Stores the database key in Keychain / Keystore.
  Future<Result<void>> storeDbKey(String keyBase64);

  /// Reads the database key, `null` if none is stored.
  Future<Result<String?>> getDbKey();

  /// Deletes the database key.
  Future<Result<void>> deleteDbKey();

  /// AES-256-GCM encryption of UTF-8 [plaintext]; returns base64.
  Future<Result<String>> encryptAesGcm(String plaintext, String keyBase64);

  /// Inverse of [encryptAesGcm]. Wrong key or tampering → EncryptionFailure.
  Future<Result<String>> decryptAesGcm(String ciphertext, String keyBase64);

  /// AES-256-GCM encryption of raw bytes (audio files, exports).
  Future<Result<Uint8List>> encryptBytes(Uint8List clear, String keyBase64);

  /// Inverse of [encryptBytes].
  Future<Result<Uint8List>> decryptBytes(Uint8List sealed, String keyBase64);

  /// Erases every stored key and overwrites then deletes the database files.
  Future<Result<void>> secureWipe();
}
