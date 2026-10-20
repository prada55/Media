// lib/features/transactions/data/transactions_module.dart
//
// Enregistrements DI de la feature transactions.

import 'package:injectable/injectable.dart';
import 'package:record/record.dart';
import 'package:yako/core/platform/app_directories.dart';
import 'package:yako/core/security/encryption_service.dart';
import 'package:yako/data/local/database_manager.dart';
import 'package:yako/features/auth/domain/services/session_manager.dart';
import 'package:yako/features/transactions/data/repositories/transaction_repository_impl.dart';
import 'package:yako/features/transactions/data/services/audio_storage_service_impl.dart';
import 'package:yako/features/transactions/data/services/just_audio_player_service.dart';
import 'package:yako/features/transactions/data/services/permission_handler_microphone.dart';
import 'package:yako/features/transactions/data/services/stt_engine.dart';
import 'package:yako/features/transactions/data/services/voice_service_impl.dart';
import 'package:yako/features/transactions/domain/repositories/transaction_repository.dart';
import 'package:yako/features/transactions/domain/services/audio_player_service.dart';
import 'package:yako/features/transactions/domain/services/audio_storage_service.dart';
import 'package:yako/features/transactions/domain/services/microphone_permission.dart';
import 'package:yako/features/transactions/domain/services/voice_service.dart';

/// Transactions registrations.
@module
abstract class TransactionsModule {
  @lazySingleton
  AudioStorageService audioStorage(
    EncryptionService encryption,
    SessionManager session,
    AppDirectories directories,
  ) => AudioStorageServiceImpl(
    encryption: encryption,
    dataKey: () => session.dataKey,
    directories: directories,
  );

  @lazySingleton
  TransactionRepository transactionRepository(
    DatabaseManager databaseManager,
    EncryptionService encryption,
    AudioStorageService audioStorage,
    SessionManager session,
  ) => TransactionRepositoryImpl(
    databaseManager: databaseManager,
    encryption: encryption,
    audioStorage: audioStorage,
    dataKey: () => session.dataKey,
  );

  @lazySingleton
  VoiceService voiceService(AppDirectories directories) => VoiceServiceImpl(
    recorder: AudioRecorder(),
    stt: StubSttEngine(),
    directories: directories,
  );

  @lazySingleton
  MicrophonePermission get microphonePermission =>
      const PermissionHandlerMicrophone();

  @lazySingleton
  AudioPlayerService audioPlayer(AudioStorageService storage) =>
      JustAudioPlayerService(storage);
}
