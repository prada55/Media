// lib/core/di/core_module.dart
//
// Enregistrement des services transverses (stockage sécurisé, répertoires,
// chiffrement, coffre de clés, base locale).

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:injectable/injectable.dart';
import 'package:yako/core/platform/app_directories.dart';
import 'package:yako/core/security/encryption_service.dart';
import 'package:yako/core/security/encryption_service_impl.dart';
import 'package:yako/core/security/key_vault.dart';
import 'package:yako/data/local/database_manager.dart';

/// Core third-party and platform registrations.
@module
abstract class CoreModule {
  @lazySingleton
  FlutterSecureStorage get secureStorage => kYakoSecureStorage;

  @lazySingleton
  AppDirectories get appDirectories => const AppDirectories();

  @lazySingleton
  EncryptionService encryptionService(
    FlutterSecureStorage storage,
    AppDirectories directories,
  ) => EncryptionServiceImpl(storage: storage, directories: directories);

  @lazySingleton
  KeyVault keyVault(FlutterSecureStorage storage) => KeyVault(storage);

  @lazySingleton
  DatabaseManager databaseManager(
    EncryptionService encryption,
    AppDirectories directories,
  ) => DatabaseManager(encryption: encryption, directories: directories);
}
