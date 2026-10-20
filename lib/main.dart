// lib/main.dart
//
// Point d'entrée : DI, configuration signée, puis ProviderScope.

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/app.dart';
import 'package:yako/core/config/app_config.dart';
import 'package:yako/core/config/app_config_provider.dart';
import 'package:yako/core/di/injection.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  configureDependencies();
  final config = await AppConfig.load();
  runApp(
    ProviderScope(
      overrides: [appConfigProvider.overrideWithValue(config)],
      child: const YakoApp(),
    ),
  );
}
