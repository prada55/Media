// lib/main.dart
//
// Point d'entrée : DI, configuration signée, puis ProviderScope.

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/app.dart';
import 'package:yako/core/config/app_config.dart';
import 'package:yako/core/config/app_config_provider.dart';
import 'package:yako/core/di/injection.dart';
import 'package:yako/features/translation/data/services/localization_loader.dart';
import 'package:yako/features/translation/domain/services/localization_service.dart';
import 'package:yako/features/translation/presentation/providers/translation_providers.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  configureDependencies();
  final config = await AppConfig.load();
  final localization = await loadLocalization();
  LocalizationService.instance = localization;
  runApp(
    ProviderScope(
      overrides: [
        appConfigProvider.overrideWithValue(config),
        localizationServiceProvider.overrideWithValue(localization),
      ],
      child: const YakoApp(),
    ),
  );
}
