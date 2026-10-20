// lib/main_demo.dart
//
// Point d'entrée de la DÉMO WEB (Railway). Même interface que l'app
// mobile, mais services simulés en mémoire : aucune donnée réelle, aucun
// chiffrement, pas de micro ni d'empreinte. Tout est perdu au
// rechargement de la page. Build : flutter build web -t lib/main_demo.dart

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/app.dart';
import 'package:yako/core/config/app_config.dart';
import 'package:yako/core/config/app_config_provider.dart';
import 'package:yako/demo/demo_auth_repository.dart';
import 'package:yako/demo/demo_services.dart';
import 'package:yako/demo/demo_transaction_repository.dart';
import 'package:yako/features/auth/domain/services/session_manager.dart';
import 'package:yako/features/auth/presentation/providers/auth_providers.dart';
import 'package:yako/features/consent/presentation/providers/consent_providers.dart';
import 'package:yako/features/settings/presentation/providers/settings_providers.dart';
import 'package:yako/features/transactions/presentation/providers/transaction_providers.dart';
import 'package:yako/features/translation/data/services/localization_loader.dart';
import 'package:yako/features/translation/domain/services/localization_service.dart';
import 'package:yako/features/translation/presentation/providers/translation_providers.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final config = await AppConfig.load();
  final localization = await loadLocalization();
  LocalizationService.instance = localization;
  final auth = DemoAuthRepository();

  runApp(
    ProviderScope(
      overrides: [
        appConfigProvider.overrideWithValue(config),
        localizationServiceProvider.overrideWithValue(localization),
        authRepositoryProvider.overrideWithValue(auth),
        sessionManagerProvider.overrideWithValue(SessionManager()),
        transactionRepositoryProvider.overrideWithValue(
          DemoTransactionRepository(),
        ),
        voiceServiceProvider.overrideWithValue(DemoVoiceService()),
        microphonePermissionProvider.overrideWithValue(
          DemoMicrophonePermission(),
        ),
        audioStorageServiceProvider.overrideWithValue(DemoAudioStorage()),
        audioPlayerServiceProvider.overrideWithValue(DemoAudioPlayer()),
        consentRepositoryProvider.overrideWithValue(DemoConsentRepository()),
        translationServiceProvider.overrideWithValue(DemoTranslationService()),
        maskedPhoneProvider.overrideWith((ref) async => auth.maskedPhone),
        exportActionsProvider.overrideWith(DemoExportActions.new),
      ],
      child: const Directionality(
        textDirection: TextDirection.ltr,
        child: Banner(
          message: 'DÉMO',
          location: BannerLocation.bottomStart,
          child: YakoApp(),
        ),
      ),
    ),
  );
}
