// lib/features/transactions/data/services/audio_storage_service_impl.dart
//
// Chiffre chaque enregistrement avec la clé de données de la session
// (AES-256-GCM) dans <documents>/audio/{uuid}.enc, puis efface le fichier
// temporaire en clair.

import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:uuid/uuid.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/core/platform/app_directories.dart';
import 'package:yako/core/security/encryption_service.dart';
import 'package:yako/core/utils/secure_file.dart';
import 'package:yako/features/transactions/domain/services/audio_storage_service.dart';

/// Returns the session data key, `null` when locked.
typedef DataKeyReader = String? Function();

/// Default [AudioStorageService].
class AudioStorageServiceImpl implements AudioStorageService {
  AudioStorageServiceImpl({
    required this._encryption,
    required this._dataKey,
    this._directories = const AppDirectories(),
    this._uuid = const Uuid(),
  });

  static const String audioDirName = 'audio';

  final EncryptionService _encryption;
  final DataKeyReader _dataKey;
  final AppDirectories _directories;
  final Uuid _uuid;

  @override
  Future<Result<String>> storeEncrypted(String plainTempPath) =>
      _guard(() async {
        final key = _requireKey();
        final plain = File(plainTempPath);
        final sealed = await _encryption.encryptBytes(
          await plain.readAsBytes(),
          key,
        );
        final bytes = sealed.getOrNull();
        if (bytes == null) return FailureResult(sealed.getFailureOrNull()!);
        final relative = p.join(audioDirName, '${_uuid.v4()}.enc');
        final target = File(
          p.join((await _directories.documents()).path, relative),
        );
        await target.parent.create(recursive: true);
        await target.writeAsBytes(bytes, flush: true);
        await overwriteAndDelete(plain);
        return Success(relative);
      });

  @override
  Future<Result<String>> decryptToTemp(String relativePath) => _guard(() async {
    final key = _requireKey();
    final source = await _resolve(relativePath);
    final clear = await _encryption.decryptBytes(
      await source.readAsBytes(),
      key,
    );
    final bytes = clear.getOrNull();
    if (bytes == null) return FailureResult(clear.getFailureOrNull()!);
    final tmp = await _directories.temporary();
    final out = File(p.join(tmp.path, 'play_${_uuid.v4()}.m4a'));
    await out.writeAsBytes(bytes, flush: true);
    return Success(out.path);
  });

  @override
  Future<Result<void>> delete(String relativePath) => _guard(() async {
    await overwriteAndDelete(await _resolve(relativePath));
    return const Success(null);
  });

  @override
  Future<Result<void>> wipeAll() => _guard(() async {
    final dir = Directory(
      p.join((await _directories.documents()).path, audioDirName),
    );
    if (dir.existsSync()) {
      await for (final entity in dir.list()) {
        if (entity is File) await overwriteAndDelete(entity);
      }
      await dir.delete(recursive: true);
    }
    return const Success(null);
  });

  Future<File> _resolve(String relativePath) async {
    final normalized = p.normalize(relativePath);
    if (p.isAbsolute(normalized) || !p.isWithin(audioDirName, normalized)) {
      throw ArgumentError('Audio path outside audio directory');
    }
    return File(p.join((await _directories.documents()).path, normalized));
  }

  String _requireKey() {
    final key = _dataKey();
    if (key == null) throw StateError('Session locked');
    return key;
  }

  Future<Result<T>> _guard<T>(Future<Result<T>> Function() action) async {
    try {
      return await action();
    } on Object catch (e, st) {
      return FailureResult(
        EncryptionFailure(
          technicalMessage: 'Audio storage operation failed',
          userMessageFr: 'Impossible de lire ou d’enregistrer l’audio.',
          cause: e,
          stackTrace: st,
        ),
      );
    }
  }
}
