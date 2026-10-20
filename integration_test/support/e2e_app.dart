// integration_test/support/e2e_app.dart
//
// Application complète câblée pour les tests de bout en bout : vraie base
// SQLCipher (fichier), vrai chiffrement, vrais dépôts ; seuls le Keychain,
// la biométrie, le micro et la feuille de partage sont simulés.

import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:yako/app.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/core/security/key_vault.dart';
import 'package:yako/features/auth/domain/services/session_manager.dart';
import 'package:yako/features/auth/presentation/providers/auth_providers.dart';
import 'package:yako/features/consent/data/repositories/consent_repository_impl.dart';
import 'package:yako/features/consent/presentation/providers/consent_providers.dart';
import 'package:yako/features/settings/data/services/export_service.dart';
import 'package:yako/features/settings/presentation/providers/settings_providers.dart';
import 'package:yako/features/transactions/data/repositories/transaction_repository_impl.dart';
import 'package:yako/features/transactions/data/services/audio_storage_service_impl.dart';
import 'package:yako/features/transactions/domain/services/microphone_permission.dart';
import 'package:yako/features/transactions/presentation/providers/transaction_providers.dart';
import 'package:yako/features/translation/data/services/localization_loader.dart';
import 'package:yako/features/translation/domain/services/localization_service.dart';
import 'package:yako/features/translation/presentation/providers/translation_providers.dart';

import '../../test/helpers/auth_harness.dart';
import '../../test/helpers/mocks.dart';

/// Everything a scenario needs to drive and inspect the app.
class E2eApp {
  E2eApp._(this.harness, this.session, this.widget, this.shared);

  final AuthHarness harness;
  final SessionManager session;
  final Widget widget;

  /// Files handed to the (fake) share sheet.
  final List<File> shared;

  static Future<E2eApp> create() async {
    final h = await AuthHarness.create();
    final tmp = await h.dir.createTemp('tmp');
    when(h.directories.temporary).thenAnswer((_) async => tmp);
    final session = SessionManager();
    final localization = await loadLocalization();
    LocalizationService.instance = localization;

    final audio = AudioStorageServiceImpl(
      encryption: h.encryption,
      dataKey: () => session.dataKey,
      directories: h.directories,
    );
    final transactions = TransactionRepositoryImpl(
      databaseManager: h.databaseManager,
      encryption: h.encryption,
      audioStorage: audio,
      dataKey: () => session.dataKey,
    );
    final mic = MockMicrophonePermission();
    when(mic.status).thenAnswer((_) async => MicPermission.granted);
    final voice = MockVoiceService();
    when(voice.isTranscriptionAvailable).thenAnswer((_) async => false);
    when(() => voice.deleteAudio(any())).thenAnswer((_) async {});
    when(voice.startRecording).thenAnswer(
      (_) async => const FailureResult(
        FeatureNotAvailableFailure(technicalMessage: 'no mic in e2e'),
      ),
    );
    final shared = <File>[];

    final widget = ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(h.repository),
        sessionManagerProvider.overrideWithValue(session),
        transactionRepositoryProvider.overrideWithValue(transactions),
        audioStorageServiceProvider.overrideWithValue(audio),
        voiceServiceProvider.overrideWithValue(voice),
        microphonePermissionProvider.overrideWithValue(mic),
        consentRepositoryProvider.overrideWithValue(
          ConsentRepositoryImpl(databaseManager: h.databaseManager),
        ),
        exportServiceProvider.overrideWithValue(
          ExportService(
            transactions: transactions,
            encryption: h.encryption,
            directories: h.directories,
          ),
        ),
        keyVaultProvider.overrideWithValue(KeyVault(h.storage)),
        encryptionServiceProvider.overrideWithValue(h.encryption),
        fileSharerProvider.overrideWithValue((file) async {
          // Copy before ExportActions wipes the temporary file.
          shared.add(file.copySync('${h.dir.path}/shared_export.yako'));
        }),
        localizationServiceProvider.overrideWithValue(localization),
      ],
      child: const YakoApp(),
    );
    return E2eApp._(h, session, widget, shared);
  }

  Future<void> dispose() => harness.dispose();
}

/// Lets isolates (PBKDF2) and SQLite I/O complete inside widget tests.
Future<void> settleIo(
  WidgetTester tester, {
  int rounds = 10,
  Duration fakeStep = const Duration(milliseconds: 200),
}) async {
  for (var i = 0; i < rounds; i++) {
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 100)),
    );
    await tester.pump(fakeStep);
  }
}

/// Pumps real I/O until [finder] matches (or [maxRounds] is reached).
Future<void> settleUntil(
  WidgetTester tester,
  Finder finder, {
  int maxRounds = 100,
}) async {
  for (var i = 0; i < maxRounds && finder.evaluate().isEmpty; i++) {
    // Drift's close() waits on timers: advance fake time generously too.
    await settleIo(tester, rounds: 1, fakeStep: const Duration(seconds: 2));
  }
}

/// Types a PIN on the on-screen keypad.
Future<void> typePin(WidgetTester tester, String pin) async {
  for (final digit in pin.split('')) {
    await tester.tap(find.byKey(ValueKey('pin-key-$digit')));
    await tester.pump();
  }
  await tester.pump(const Duration(milliseconds: 200));
}
