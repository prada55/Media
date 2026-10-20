// lib/features/transactions/domain/services/audio_storage_service.dart
//
// Fichiers audio chiffrés AES-256-GCM dans <documents>/audio/{uuid}.enc.

import 'package:yako/core/error/result.dart';

/// Encrypted audio files storage.
abstract interface class AudioStorageService {
  /// Encrypts [plainTempPath], wipes it, returns the relative stored path.
  Future<Result<String>> storeEncrypted(String plainTempPath);

  /// Decrypts [relativePath] to a private temp file for playback.
  Future<Result<String>> decryptToTemp(String relativePath);

  /// Overwrites and deletes a stored file.
  Future<Result<void>> delete(String relativePath);

  /// Wipes every stored audio file (account deletion).
  Future<Result<void>> wipeAll();
}
