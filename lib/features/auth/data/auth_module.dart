// lib/features/auth/data/auth_module.dart
//
// Enregistrements DI de la feature auth.

import 'package:injectable/injectable.dart';
import 'package:yako/core/security/encryption_service.dart';
import 'package:yako/core/security/key_vault.dart';
import 'package:yako/data/local/database_manager.dart';
import 'package:yako/features/auth/data/datasources/biometric_datasource.dart';
import 'package:yako/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:yako/features/auth/domain/repositories/auth_repository.dart';
import 'package:yako/features/auth/domain/services/session_manager.dart';
import 'package:yako/features/transactions/domain/services/audio_storage_service.dart';

/// Auth registrations.
@module
abstract class AuthModule {
  @lazySingleton
  BiometricDatasource get biometrics => LocalAuthBiometricDatasource();

  @lazySingleton
  SessionManager get sessionManager => SessionManager();

  @lazySingleton
  AuthRepository authRepository(
    DatabaseManager databaseManager,
    EncryptionService encryption,
    KeyVault vault,
    BiometricDatasource biometrics,
    AudioStorageService audioStorage,
  ) => AuthRepositoryImpl(
    databaseManager: databaseManager,
    encryption: encryption,
    vault: vault,
    biometrics: biometrics,
    // Les fichiers audio chiffrés sont effacés avec le compte.
    extraWipers: [
      () async {
        await audioStorage.wipeAll();
      },
    ],
  );
}
