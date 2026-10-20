// lib/core/config/feature_flags.dart
//
// Drapeaux de fonctionnalités issus de la configuration signée. Remplaçables
// en test via `featureFlagsProvider.overrideWithValue(...)`.

import 'package:flutter/foundation.dart' show immutable;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/config/app_config.dart';
import 'package:yako/core/config/app_config_provider.dart';

/// Effective feature flags.
@immutable
final class FeatureFlags {
  const FeatureFlags({
    this.monetizationEnabled = false,
    this.sync = false,
    this.voiceTranslation = false,
  });

  factory FeatureFlags.fromConfig(AppConfig config) => FeatureFlags(
    monetizationEnabled: config.monetizationEnabled,
    sync: config.featureFlags.sync,
    voiceTranslation: config.featureFlags.voiceTranslation,
  );

  /// Monétisation (hooks B2B). OFF par défaut.
  final bool monetizationEnabled;

  /// Envoi des payloads consentis. OFF par défaut.
  final bool sync;

  final bool voiceTranslation;
}

final featureFlagsProvider = Provider<FeatureFlags>(
  (ref) => FeatureFlags.fromConfig(ref.watch(appConfigProvider)),
);
