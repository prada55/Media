// lib/features/transactions/data/services/voice_service_impl.dart
//
// Capture micro via `record` : AAC-LC, 16 kHz, mono, 32 kbit/s (voix
// intelligible, ~240 Ko/min). Le fichier temporaire en clair vit dans le
// cache privé de l'app le temps d'être chiffré par AudioStorageService.

import 'dart:async';
import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:record/record.dart';
import 'package:uuid/uuid.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/core/platform/app_directories.dart';
import 'package:yako/core/utils/secure_file.dart';
import 'package:yako/features/transactions/data/services/stt_engine.dart';
import 'package:yako/features/transactions/domain/entities/recording_state.dart';
import 'package:yako/features/transactions/domain/services/voice_service.dart';

/// Recording configuration imposed by the spec.
const RecordConfig kYakoRecordConfig = RecordConfig(
  sampleRate: 16000,
  numChannels: 1,
  bitRate: 32000,
);

/// Default [VoiceService].
class VoiceServiceImpl implements VoiceService {
  VoiceServiceImpl({
    required this._recorder,
    required this._stt,
    this._directories = const AppDirectories(),
    this._uuid = const Uuid(),
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now;

  final AudioRecorder _recorder;
  final SttEngine _stt;
  final AppDirectories _directories;
  final Uuid _uuid;
  final DateTime Function() _now;

  final StreamController<RecordingState> _states =
      StreamController<RecordingState>.broadcast();
  RecordingState _state = RecordingState.idle;
  DateTime? _startedAt;

  void _setState(RecordingState state) {
    _state = state;
    _states.add(state);
  }

  @override
  Future<Result<void>> startRecording() async {
    try {
      if (_state != RecordingState.idle) await cancelRecording();
      final tmp = await _directories.temporary();
      final path = p.join(tmp.path, 'rec_${_uuid.v4()}.m4a');
      await _recorder.start(kYakoRecordConfig, path: path);
      _startedAt = _now();
      _setState(RecordingState.recording);
      return const Success(null);
    } on Object catch (e, st) {
      _setState(RecordingState.idle);
      return FailureResult(_micFailure('Recorder start failed', e, st));
    }
  }

  @override
  Future<Result<RecordedAudio>> stopRecording() async {
    try {
      _setState(RecordingState.processing);
      final path = await _recorder.stop();
      final started = _startedAt;
      _startedAt = null;
      _setState(RecordingState.idle);
      if (path == null || started == null) {
        return FailureResult(_micFailure('No recording in progress'));
      }
      return Success(
        RecordedAudio(tempPath: path, duration: _now().difference(started)),
      );
    } on Object catch (e, st) {
      _setState(RecordingState.idle);
      return FailureResult(_micFailure('Recorder stop failed', e, st));
    }
  }

  @override
  Future<void> cancelRecording() async {
    try {
      await _recorder.cancel();
    } on Object {
      // Nothing to clean: cancel() already removes the partial file.
    }
    _startedAt = null;
    _setState(RecordingState.idle);
  }

  @override
  Future<Result<String>> transcribeAudio(String audioPath) async {
    _setState(RecordingState.transcribing);
    try {
      return await _stt.transcribe(audioPath);
    } finally {
      _setState(RecordingState.idle);
    }
  }

  @override
  Future<bool> isTranscriptionAvailable() => _stt.isAvailable();

  @override
  Future<void> deleteAudio(String audioPath) async {
    try {
      await overwriteAndDelete(File(audioPath));
    } on Object {
      // Best effort: the temp directory is private and purged by the OS.
    }
  }

  @override
  Stream<RecordingState> watchRecordingState() async* {
    yield _state;
    yield* _states.stream;
  }

  @override
  Stream<double> watchAmplitude() => _recorder
      .onAmplitudeChanged(const Duration(milliseconds: 100))
      .map((a) => ((a.current + 60) / 60).clamp(0.0, 1.0));

  Failure _micFailure(String message, [Object? cause, StackTrace? st]) =>
      UnknownFailure(
        technicalMessage: message,
        userMessageFr: 'Le micro ne répond pas. Réessayez.',
        cause: cause,
        stackTrace: st,
      );

  Future<void> dispose() async {
    await _states.close();
    await _recorder.dispose();
  }
}
