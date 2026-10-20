// lib/features/transactions/domain/services/audio_player_service.dart
//
// Réécoute d'un enregistrement chiffré.

import 'package:yako/core/error/result.dart';

/// Plays encrypted recordings.
abstract interface class AudioPlayerService {
  /// Decrypts and plays [relativePath]; completes when playback ends.
  Future<Result<void>> play(String relativePath);

  Future<void> stop();

  Stream<bool> watchPlaying();
}
