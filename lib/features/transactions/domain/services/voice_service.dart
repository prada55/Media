// lib/features/transactions/domain/services/voice_service.dart
//
// Capture vocale et transcription hors ligne. Aucun appel réseau.

import 'package:yako/core/error/result.dart';
import 'package:yako/features/transactions/domain/entities/recording_state.dart';

/// Microphone capture and offline speech-to-text.
abstract interface class VoiceService {
  /// Starts recording (AAC, 16 kHz mono, 32 kbps) into a temp file.
  Future<Result<void>> startRecording();

  /// Stops and returns the plaintext temp file.
  Future<Result<RecordedAudio>> stopRecording();

  /// Stops and discards the current recording.
  Future<void> cancelRecording();

  /// Offline transcription of [audioPath] (French).
  Future<Result<String>> transcribeAudio(String audioPath);

  /// Whether an offline STT model is bundled in this build.
  Future<bool> isTranscriptionAvailable();

  /// Overwrites then deletes [audioPath].
  Future<void> deleteAudio(String audioPath);

  Stream<RecordingState> watchRecordingState();

  /// Normalized input level 0..1, for the waveform.
  Stream<double> watchAmplitude();
}
