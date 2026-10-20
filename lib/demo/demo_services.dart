// lib/demo/demo_services.dart
//
// DÉMO WEB UNIQUEMENT : micro, audio, consentements, traduction et export
// simulés (aucun accès matériel, aucune donnée persistée).

import 'dart:async';

import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/features/consent/domain/entities/consent_state.dart';
import 'package:yako/features/consent/domain/repositories/consent_repository.dart';
import 'package:yako/features/settings/presentation/providers/settings_providers.dart';
import 'package:yako/features/transactions/domain/entities/recording_state.dart';
import 'package:yako/features/transactions/domain/services/audio_player_service.dart';
import 'package:yako/features/transactions/domain/services/audio_storage_service.dart';
import 'package:yako/features/transactions/domain/services/microphone_permission.dart';
import 'package:yako/features/transactions/domain/services/voice_service.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';
import 'package:yako/features/translation/domain/entities/translation_result.dart';
import 'package:yako/features/translation/domain/services/translation_service.dart';

const _notInDemo = FeatureNotAvailableFailure(
  technicalMessage: 'Not available in the web demo',
  userMessageFr:
      'Le micro n’est pas disponible dans la démo web. '
      'Utilisez « Écrire sans parler ».',
);

/// Microphone always unavailable: the form is used instead.
class DemoVoiceService implements VoiceService {
  @override
  Future<Result<void>> startRecording() async =>
      const FailureResult(_notInDemo);

  @override
  Future<Result<RecordedAudio>> stopRecording() async =>
      const FailureResult(_notInDemo);

  @override
  Future<void> cancelRecording() async {}

  @override
  Future<Result<String>> transcribeAudio(String audioPath) async =>
      const FailureResult(_notInDemo);

  @override
  Future<bool> isTranscriptionAvailable() async => false;

  @override
  Future<void> deleteAudio(String audioPath) async {}

  @override
  Stream<RecordingState> watchRecordingState() =>
      Stream.value(RecordingState.idle);

  @override
  Stream<double> watchAmplitude() => const Stream.empty();
}

/// Permission granted (the voice service explains the limitation).
class DemoMicrophonePermission implements MicrophonePermission {
  @override
  Future<MicPermission> status() async => MicPermission.granted;

  @override
  Future<MicPermission> request() async => MicPermission.granted;

  @override
  Future<bool> openSettings() async => false;
}

/// No files in the demo.
class DemoAudioStorage implements AudioStorageService {
  @override
  Future<Result<String>> storeEncrypted(String plainTempPath) async =>
      const FailureResult(_notInDemo);

  @override
  Future<Result<String>> decryptToTemp(String relativePath) async =>
      const FailureResult(_notInDemo);

  @override
  Future<Result<void>> delete(String relativePath) async => const Success(null);

  @override
  Future<Result<void>> wipeAll() async => const Success(null);
}

/// No playback in the demo.
class DemoAudioPlayer implements AudioPlayerService {
  @override
  Future<Result<void>> play(String relativePath) async =>
      const FailureResult(_notInDemo);

  @override
  Future<void> stop() async {}

  @override
  Stream<bool> watchPlaying() => Stream.value(false);
}

/// In-memory consents (all OFF by default, like the real app).
class DemoConsentRepository implements ConsentRepository {
  ConsentState _state = const ConsentState();
  final StreamController<ConsentState> _changes = StreamController.broadcast();

  Result<ConsentState> _emit(ConsentState next) {
    _state = next;
    _changes.add(next);
    return Success(next);
  }

  @override
  Future<Result<ConsentState>> getConsentState() async => Success(_state);

  @override
  Future<Result<ConsentState>> setCreditScoreSharing({
    required bool value,
  }) async => _emit(
    ConsentState(
      creditScoreSharing: value,
      promotions: _state.promotions,
      diagnostics: _state.diagnostics,
    ),
  );

  @override
  Future<Result<ConsentState>> setPromotions({required bool value}) async =>
      _emit(
        ConsentState(
          creditScoreSharing: _state.creditScoreSharing,
          promotions: value,
          diagnostics: _state.diagnostics,
        ),
      );

  @override
  Future<Result<ConsentState>> setDiagnostics({required bool value}) async =>
      _emit(
        ConsentState(
          creditScoreSharing: _state.creditScoreSharing,
          promotions: _state.promotions,
          diagnostics: value,
        ),
      );

  @override
  Future<Result<ConsentState>> revokeAll() async => _emit(const ConsentState());

  @override
  Stream<ConsentState> watch() async* {
    yield _state;
    yield* _changes.stream;
  }
}

/// Dioula/Baoulé dictionaries are still empty: always « Non traduit ».
class DemoTranslationService implements TranslationService {
  @override
  Future<Result<TranslationResult>> translate(
    String text, {
    required LanguageCode from,
    required LanguageCode to,
  }) async => const FailureResult(TranslationUnavailableFailure());

  @override
  List<LanguageCode> getAvailableTargetLanguages(LanguageCode from) => const [
    LanguageCode.dyu,
    LanguageCode.bci,
  ];

  @override
  Future<bool> isReady() async => true;
}

/// Export disabled in the browser (no file system, no share sheet).
class DemoExportActions extends ExportActions {
  // The parent's parameter is the private `_ref`: forwarding it is fine.
  // ignore: matching_super_parameters
  DemoExportActions(super.ref);

  @override
  Future<Result<void>> exportAndShare(String password) async =>
      const FailureResult(
        FeatureNotAvailableFailure(
          technicalMessage: 'Export not available in the web demo',
          userMessageFr:
              'L’export chiffré est disponible dans l’application mobile.',
        ),
      );
}
