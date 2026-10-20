// lib/features/translation/data/services/localization_loader.dart
//
// Chargement des fichiers assets/i18n/ui_{fr,dyu,bci}.json. Les valeurs
// null (placeholders) sont ignorées : le français prend le relais.

import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';
import 'package:yako/features/translation/domain/services/localization_service.dart';

/// Loads every UI language file. Never throws.
Future<LocalizationService> loadLocalization({AssetBundle? bundle}) async {
  final source = bundle ?? rootBundle;
  final strings = <LanguageCode, Map<String, String>>{};
  for (final language in LanguageCode.values) {
    try {
      final raw = await source.loadString(
        'assets/i18n/ui_${language.code}.json',
      );
      final json = jsonDecode(raw) as Map<String, dynamic>;
      strings[language] = {
        for (final MapEntry(:key, :value) in json.entries)
          if (value is String && !key.startsWith('_')) key: value,
      };
    } on Object {
      strings[language] = const {};
    }
  }
  return LocalizationService(strings);
}
