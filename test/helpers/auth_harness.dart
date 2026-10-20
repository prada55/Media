// test/helpers/auth_harness.dart
//
// Pile d'authentification complète sur une vraie base SQLCipher en
// fichier temporaire, avec Keychain simulé et horloge contrôlée.

import 'dart:convert';
import 'dart:io';

import 'package:drift/native.dart';
import 'package:mocktail/mocktail.dart';
import 'package:yako/core/security/encryption_service_impl.dart';
import 'package:yako/core/security/key_vault.dart';
import 'package:yako/data/local/database_manager.dart';
import 'package:yako/data/local/database_opener.dart';
import 'package:yako/features/auth/data/repositories/auth_repository_impl.dart';

import 'mocks.dart';

/// Test PIN (non trivial, not part of [kTestPhone]).
const String kTestPin = '814725';

/// Valid Ivorian test number.
const String kTestPhone = '0100000000';

/// Wires a real repository on top of fakes.
class AuthHarness {
  AuthHarness._(this.dir) {
    storageValues = stubInMemoryStorage(storage);
    when(directories.documents).thenAnswer((_) async => dir);
    when(biometrics.isAvailable).thenAnswer((_) async => true);
    when(() => biometrics.authenticate(reason: any(named: 'reason')))
        .thenAnswer((_) async => true);
    encryption = EncryptionServiceImpl(
      storage: storage,
      directories: directories,
      // Faster than production (100k) to keep the suite quick; the
      // production count is covered by encryption_service_test.dart.
      pbkdf2Iterations: 1000,
    );
    databaseManager = DatabaseManager(
      encryption: encryption,
      directories: directories,
      executorFactory: (path, key) => NativeDatabase(
        File(path),
        setup: (db) => applySqlCipherKey(db, _hex(base64Decode(key))),
      ),
    );
    repository = AuthRepositoryImpl(
      databaseManager: databaseManager,
      encryption: encryption,
      vault: KeyVault(storage),
      biometrics: biometrics,
      now: () => now,
    );
  }

  static Future<AuthHarness> create() async =>
      AuthHarness._(await Directory.systemTemp.createTemp('yako_auth_'));

  final Directory dir;
  final MockSecureStorage storage = MockSecureStorage();
  final MockAppDirectories directories = MockAppDirectories();
  final MockBiometricDatasource biometrics = MockBiometricDatasource();
  late final Map<String, String> storageValues;
  late final EncryptionServiceImpl encryption;
  late final DatabaseManager databaseManager;
  late final AuthRepositoryImpl repository;
  DateTime now = DateTime(2026, 10, 20, 9);

  File get databaseFile => File(databasePath(dir));

  Future<void> dispose() async {
    await databaseManager.close();
    if (dir.existsSync()) await dir.delete(recursive: true);
  }

  static String _hex(List<int> bytes) =>
      bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
}
