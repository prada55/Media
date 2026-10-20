// lib/features/transactions/presentation/providers/record_controller.dart
//
// Logique de l'écran d'enregistrement : permission micro (au premier appui
// long seulement), capture, transcription, puis sauvegarde chiffrée.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/features/transactions/domain/entities/transaction.dart';
import 'package:yako/features/transactions/domain/entities/transaction_draft.dart';
import 'package:yako/features/transactions/domain/services/microphone_permission.dart';
import 'package:yako/features/transactions/presentation/providers/transaction_providers.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';
import 'package:yako/features/translation/presentation/providers/translation_providers.dart';

/// Steps of the record screen.
enum RecordPhase { idle, recording, transcribing, review }

/// Record screen state.
final class RecordUiState {
  const RecordUiState({
    this.phase = RecordPhase.idle,
    this.permission,
    this.tempAudioPath,
    this.transcript = '',
    this.notice,
    this.saving = false,
    this.translation,
  });

  final RecordPhase phase;

  /// Dernier statut de permission connu (`null` = jamais demandé).
  final MicPermission? permission;

  /// Fichier audio en clair en attente de chiffrement.
  final String? tempAudioPath;
  final String transcript;

  /// Message d'information (ex. transcription indisponible).
  final String? notice;
  final bool saving;

  /// Dernière demande de traduction de la transcription.
  final RecordTranslation? translation;

  bool get hasAudio => tempAudioPath != null;

  RecordUiState copyWith({
    RecordPhase? phase,
    MicPermission? permission,
    String? Function()? tempAudioPath,
    String? transcript,
    String? Function()? notice,
    bool? saving,
    RecordTranslation? Function()? translation,
  }) => RecordUiState(
    phase: phase ?? this.phase,
    permission: permission ?? this.permission,
    tempAudioPath: tempAudioPath == null ? this.tempAudioPath : tempAudioPath(),
    transcript: transcript ?? this.transcript,
    notice: notice == null ? this.notice : notice(),
    saving: saving ?? this.saving,
    translation: translation == null ? this.translation : translation(),
  );
}

/// Translation of the transcript into a local language.
final class RecordTranslation {
  const RecordTranslation({required this.language, this.text});

  final LanguageCode language;

  /// `null` = non traduit (badge « Non traduit »).
  final String? text;
}

final NotifierProvider<RecordController, RecordUiState>
recordControllerProvider =
    NotifierProvider.autoDispose<RecordController, RecordUiState>(
      RecordController.new,
    );

/// Drives the record screen.
class RecordController extends Notifier<RecordUiState> {
  /// Mirror of `state.tempAudioPath`, readable from onDispose (where
  /// Riverpod forbids touching `state` or `ref`).
  String? _pendingTemp;

  @override
  set state(RecordUiState value) {
    _pendingTemp = value.tempAudioPath;
    super.state = value;
  }

  @override
  RecordUiState get state => super.state;

  @override
  RecordUiState build() {
    final voice = ref.read(voiceServiceProvider);
    ref.onDispose(() {
      final temp = _pendingTemp;
      // Fire-and-forget: overwrites then deletes the plaintext temp file.
      if (temp != null) voice.deleteAudio(temp).ignore();
    });
    return const RecordUiState();
  }

  Future<void> startRecording() async {
    if (state.phase == RecordPhase.recording) return;
    final permissions = ref.read(microphonePermissionProvider);
    var permission = await permissions.status();
    if (permission == MicPermission.denied) {
      permission = await permissions.request();
    }
    if (!ref.mounted) return;
    state = state.copyWith(permission: permission);
    if (permission != MicPermission.granted) return;

    _discardTempAudio();
    final started = await ref.read(voiceServiceProvider).startRecording();
    if (!ref.mounted) return;
    state = started.fold(
      (_) => state.copyWith(
        phase: RecordPhase.recording,
        tempAudioPath: () => null,
        notice: () => null,
      ),
      (f) => state.copyWith(notice: () => f.userMessageFr),
    );
  }

  Future<void> stopRecording() async {
    if (state.phase != RecordPhase.recording) return;
    final voice = ref.read(voiceServiceProvider);
    final stopped = await voice.stopRecording();
    if (!ref.mounted) return;
    final audio = stopped.getOrNull();
    if (audio == null) {
      state = state.copyWith(
        phase: RecordPhase.review,
        notice: () => stopped.getFailureOrNull()!.userMessageFr,
      );
      return;
    }
    state = state.copyWith(
      phase: RecordPhase.transcribing,
      tempAudioPath: () => audio.tempPath,
    );
    final transcript = await voice.transcribeAudio(audio.tempPath);
    if (!ref.mounted) return;
    state = state.copyWith(
      phase: RecordPhase.review,
      transcript: transcript.getOrNull() ?? '',
      notice: () => transcript.getFailureOrNull()?.userMessageFr,
    );
  }

  /// Skips voice entirely (manual form).
  /// Translates the transcript; failure → « Non traduit » badge.
  Future<void> translate(LanguageCode to) async {
    final text = state.transcript;
    if (text.trim().isEmpty) return;
    final result = await ref
        .read(translationServiceProvider)
        .translate(text, from: LanguageCode.fr, to: to);
    if (!ref.mounted) return;
    state = state.copyWith(
      translation: () =>
          RecordTranslation(language: to, text: result.getOrNull()?.text),
    );
  }

  void typeManually() =>
      state = state.copyWith(phase: RecordPhase.review, notice: () => null);

  Future<bool> openSettings() =>
      ref.read(microphonePermissionProvider).openSettings();

  /// Encrypts the audio (if any) and stores the transaction.
  Future<Result<Transaction>> save({
    required TransactionType type,
    required int amount,
    required TransactionCategory category,
    required String transcript,
  }) async {
    state = state.copyWith(saving: true);
    String? audioPath;
    final temp = state.tempAudioPath;
    if (temp != null) {
      final stored = await ref
          .read(audioStorageServiceProvider)
          .storeEncrypted(temp);
      if (stored case FailureResult(:final failure)) {
        if (ref.mounted) state = state.copyWith(saving: false);
        return FailureResult(failure);
      }
      audioPath = stored.getOrNull();
      if (ref.mounted) state = state.copyWith(tempAudioPath: () => null);
    }
    final result = await ref
        .read(transactionRepositoryProvider)
        .create(
          TransactionDraft(
            type: type,
            amount: amount,
            category: category,
            transcriptFr: transcript.trim(),
            transcriptLocal: state.translation?.text,
            audioPath: audioPath,
          ),
        );
    if (result.isFailure && audioPath != null) {
      await ref.read(audioStorageServiceProvider).delete(audioPath);
    }
    if (ref.mounted) state = state.copyWith(saving: false);
    return result;
  }

  void _discardTempAudio() {
    final temp = state.tempAudioPath;
    if (temp == null) return;
    ref.read(voiceServiceProvider).deleteAudio(temp).ignore();
  }
}
