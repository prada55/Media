// lib/features/translation/data/datasources/dictionary_datasource.dart
//
// Dictionnaires de phrases commerciales embarqués (assets/i18n/phrases_*).
// Chargement paresseux mis en cache. Recherche exacte puis approchée
// (distance de Levenshtein ≤ 2). Les entrées sans traduction (null =
// placeholder à compléter par un locuteur natif) sont ignorées.

import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:yako/features/translation/data/datasources/text_normalizer.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';

/// A dictionary hit.
typedef DictionaryMatch = ({String text, bool exact});

/// Loads and queries phrase dictionaries.
class DictionaryDatasource {
  DictionaryDatasource({AssetBundle? bundle}) : _bundle = bundle ?? rootBundle;

  static const int maxFuzzyDistance = 2;

  final AssetBundle _bundle;
  final Map<String, Future<Map<String, String>>> _cache = {};

  static String assetFor(LanguageCode from, LanguageCode to) =>
      'assets/i18n/phrases_${from.code}_${to.code}.json';

  /// Pairs shipped with the app (FR ↔ local languages).
  static bool supports(LanguageCode from, LanguageCode to) =>
      from != to && (from == LanguageCode.fr || to == LanguageCode.fr);

  /// Normalized source → target, translated entries only.
  Future<Map<String, String>> load(LanguageCode from, LanguageCode to) =>
      _cache.putIfAbsent('${from.code}_${to.code}', () => _load(from, to));

  Future<Map<String, String>> _load(LanguageCode from, LanguageCode to) async {
    if (!supports(from, to)) return const {};
    try {
      final raw = await _bundle.loadString(assetFor(from, to));
      final json = jsonDecode(raw) as Map<String, dynamic>;
      final entries = json['entries'] as List<dynamic>;
      final result = <String, String>{};
      for (final entry in entries.cast<Map<String, dynamic>>()) {
        final source = entry[from.code];
        final target = entry[to.code];
        if (source is String && target is String && target.trim().isNotEmpty) {
          result[normalizePhrase(source)] = target;
        }
      }
      return result;
    } on Object {
      return const {};
    }
  }

  /// Exact match first, then the closest phrase within distance 2.
  Future<DictionaryMatch?> lookup(
    String text, {
    required LanguageCode from,
    required LanguageCode to,
  }) async {
    final dictionary = await load(from, to);
    final key = normalizePhrase(text);
    if (key.isEmpty) return null;
    final exact = dictionary[key];
    if (exact != null) return (text: exact, exact: true);

    String? best;
    var bestDistance = maxFuzzyDistance + 1;
    for (final MapEntry(key: source, value: target) in dictionary.entries) {
      final d = levenshtein(key, source, max: maxFuzzyDistance);
      if (d < bestDistance) {
        bestDistance = d;
        best = target;
      }
    }
    return best == null ? null : (text: best, exact: false);
  }

  /// Number of translated entries for the pair (0 = placeholders only).
  Future<int> translatedCount(LanguageCode from, LanguageCode to) async =>
      (await load(from, to)).length;
}
