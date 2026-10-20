// lib/core/config/app_config_provider.dart
//
// Exposition Riverpod de la configuration chargée au démarrage.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/config/app_config.dart';

/// Configuration loaded in `main()`; overridden in the root ProviderScope.
final appConfigProvider = Provider<AppConfig>((ref) => AppConfig.defaults);
