// lib/core/config/app_config.dart
//
// Configuration applicative embarquée (assets/config.json), signée
// HMAC-SHA256. Si la signature est absente/invalide ou le JSON malformé,
// Yako démarre avec des valeurs par défaut sûres (monétisation OFF,
// toutes les fonctionnalités expérimentales OFF).

import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:yako/core/config/config_signature.dart';

export 'package:yako/core/config/config_signature.dart'
    show computeJsonSignature, kConfigHmacKey;

/// Asset path of the signed configuration.
const String kConfigAssetPath = 'assets/config.json';

/// Origin of the loaded configuration.
enum ConfigSource {
  /// Le fichier a été lu et sa signature est valide.
  signed,

  /// Valeurs par défaut (fichier absent, malformé ou signature invalide).
  fallback,
}

/// Feature flags embedded in the configuration.
final class FeatureFlagsConfig {
  const FeatureFlagsConfig({this.voiceTranslation = false, this.sync = false});

  /// Traduction vocale (Phase 4).
  final bool voiceTranslation;

  /// Synchronisation des payloads consentis (Phase 5).
  final bool sync;
}

/// Immutable application configuration.
final class AppConfig {
  const AppConfig({
    required this.appVersion,
    required this.apiBaseUrl,
    required this.monetizationEnabled,
    required this.defaultLanguage,
    required this.featureFlags,
    required this.source,
  });

  /// Parses [raw] JSON and checks its signature. Never throws.
  factory AppConfig.parse(String raw, {String hmacKey = kConfigHmacKey}) {
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) return defaults;
      if (!hasValidJsonSignature(decoded, hmacKey: hmacKey)) {
        return defaults;
      }
      return AppConfig._fromVerifiedJson(decoded);
    } on Object {
      return defaults;
    }
  }

  factory AppConfig._fromVerifiedJson(Map<String, dynamic> json) {
    final flags = json['feature_flags'];
    final flagsMap = flags is Map<String, dynamic>
        ? flags
        : const <String, dynamic>{};
    final language = json['default_language'];
    return AppConfig(
      appVersion: _string(json['app_version'], defaults.appVersion),
      apiBaseUrl: _string(json['api_base_url'], defaults.apiBaseUrl),
      monetizationEnabled: json['monetization_enabled'] == true,
      defaultLanguage:
          language is String && _supportedLanguages.contains(language)
          ? language
          : defaults.defaultLanguage,
      featureFlags: FeatureFlagsConfig(
        voiceTranslation: flagsMap['voice_translation'] == true,
        sync: flagsMap['sync'] == true,
      ),
      source: ConfigSource.signed,
    );
  }

  /// Safe defaults used when the signed file cannot be trusted.
  static const AppConfig defaults = AppConfig(
    appVersion: '1.0.0',
    apiBaseUrl: '',
    monetizationEnabled: false,
    defaultLanguage: 'fr',
    featureFlags: FeatureFlagsConfig(),
    source: ConfigSource.fallback,
  );

  static const Set<String> _supportedLanguages = {'fr', 'dyu', 'bci'};

  /// Version affichée dans « À propos ».
  final String appVersion;

  /// Base URL of the (future, consent-gated) B2B API. Unused while
  /// [monetizationEnabled] is false.
  final String apiBaseUrl;

  /// Monétisation (hooks Phase 5). Toujours false par défaut.
  final bool monetizationEnabled;

  /// Langue par défaut de l'UI : fr | dyu | bci.
  final String defaultLanguage;

  /// Feature flags.
  final FeatureFlagsConfig featureFlags;

  /// Whether values come from the signed file or the defaults.
  final ConfigSource source;

  /// Loads and verifies [kConfigAssetPath]. Never throws.
  static Future<AppConfig> load({
    AssetBundle? bundle,
    String hmacKey = kConfigHmacKey,
  }) async {
    try {
      final raw = await (bundle ?? rootBundle).loadString(kConfigAssetPath);
      return AppConfig.parse(raw, hmacKey: hmacKey);
    } on Object {
      return defaults;
    }
  }

  static String _string(Object? value, String fallback) =>
      value is String ? value : fallback;
}
