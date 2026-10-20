// lib/features/transactions/data/services/just_audio_player_service.dart
//
// Réécoute : déchiffrement vers un fichier temporaire privé, lecture, puis
// effacement immédiat. (Pas de source en mémoire : just_audio passerait par
// un proxy HTTP local qui exigerait la permission INTERNET sur Android.)

import 'dart:async';
import 'dart:io';

import 'package:just_audio/just_audio.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/core/utils/secure_file.dart';
import 'package:yako/features/transactions/domain/services/audio_player_service.dart';
import 'package:yako/features/transactions/domain/services/audio_storage_service.dart';

/// just_audio implementation.
class JustAudioPlayerService implements AudioPlayerService {
  JustAudioPlayerService(this._storage, [AudioPlayer? player])
    : _player = player ?? AudioPlayer();

  final AudioStorageService _storage;
  final AudioPlayer _player;
  String? _tempPath;

  @override
  Future<Result<void>> play(String relativePath) async {
    await stop();
    final decrypted = await _storage.decryptToTemp(relativePath);
    final path = decrypted.getOrNull();
    if (path == null) return FailureResult(decrypted.getFailureOrNull()!);
    _tempPath = path;
    try {
      await _player.setFilePath(path);
      await _player.play();
      await _player.playerStateStream.firstWhere(
        (s) => s.processingState == ProcessingState.completed || !s.playing,
      );
      return const Success(null);
    } on Object catch (e, st) {
      return FailureResult(
        UnknownFailure(
          technicalMessage: 'Playback failed',
          userMessageFr: 'Impossible de lire l’enregistrement.',
          cause: e,
          stackTrace: st,
        ),
      );
    } finally {
      await _cleanup();
    }
  }

  @override
  Future<void> stop() async {
    await _player.stop();
    await _cleanup();
  }

  @override
  Stream<bool> watchPlaying() => _player.playingStream;

  Future<void> _cleanup() async {
    final path = _tempPath;
    _tempPath = null;
    if (path != null) await overwriteAndDelete(File(path));
  }

  Future<void> dispose() async {
    await stop();
    await _player.dispose();
  }
}
