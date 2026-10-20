// lib/features/transactions/domain/entities/recording_state.dart
//
// États du micro, affichés en temps réel sur l'écran d'enregistrement.

/// Recording lifecycle.
enum RecordingState { idle, recording, processing, transcribing }

/// Raw audio captured by the microphone (plaintext temp file).
final class RecordedAudio {
  const RecordedAudio({required this.tempPath, required this.duration});

  /// Fichier temporaire en clair, à chiffrer puis effacer immédiatement.
  final String tempPath;
  final Duration duration;
}
