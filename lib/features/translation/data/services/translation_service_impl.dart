// lib/features/translation/data/services/translation_service_impl.dart
//
// Stratégie honnête : cache → dictionnaire exact → dictionnaire approché →
// modèle embarqué (si présent) → TranslationUnavailableFailure (l'UI
// affiche alors le français avec le badge « Non traduit »).

import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/features/translation/data/datasources/dictionary_datasource.dart';
import 'package:yako/features/translation/data/datasources/translation_cache_datasource.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';
import 'package:yako/features/translation/domain/entities/translation_result.dart';
import 'package:yako/features/translation/domain/services/translation_engine.dart';
import 'package:yako/features/translation/domain/services/translation_service.dart';

/// Default [TranslationService].
class TranslationServiceImpl implements TranslationService {
  TranslationServiceImpl({
    required this._dictionary,
    required this._cache,
    required this._engine,
  });

  final DictionaryDatasource _dictionary;
  final TranslationCacheDatasource _cache;
  final TranslationEngine _engine;

  @override
  Future<Result<TranslationResult>> translate(
    String text, {
    required LanguageCode from,
    required LanguageCode to,
  }) async {
    if (text.trim().isEmpty) {
      return const FailureResult(
        ValidationFailure(
          technicalMessage: 'Empty text',
          userMessageFr: 'Rien à traduire.',
        ),
      );
    }
    if (from == to) {
      return Success(
        TranslationResult(text: text, origin: TranslationOrigin.dictionary),
      );
    }
    try {
      final cached = await _cache.get(text, from: from, to: to);
      if (cached != null) {
        return Success(
          TranslationResult(text: cached, origin: TranslationOrigin.cache),
        );
      }
      final match = await _dictionary.lookup(text, from: from, to: to);
      if (match != null) {
        if (!match.exact) {
          await _cache.put(text, match.text, from: from, to: to);
        }
        return Success(
          TranslationResult(
            text: match.text,
            origin: match.exact
                ? TranslationOrigin.dictionary
                : TranslationOrigin.fuzzyDictionary,
          ),
        );
      }
      if (await _engine.isAvailable()) {
        final machine = await _engine.translate(text, from: from, to: to);
        if (machine case Success(:final value)) {
          await _cache.put(text, value, from: from, to: to);
          return Success(
            TranslationResult(text: value, origin: TranslationOrigin.model),
          );
        }
      }
      return const FailureResult(TranslationUnavailableFailure());
    } on Object catch (e, st) {
      return FailureResult(
        TranslationUnavailableFailure(
          technicalMessage: 'Translation pipeline failed',
          cause: e,
          stackTrace: st,
        ),
      );
    }
  }

  @override
  List<LanguageCode> getAvailableTargetLanguages(LanguageCode from) => [
    for (final to in LanguageCode.values)
      if (DictionaryDatasource.supports(from, to)) to,
  ];

  @override
  Future<bool> isReady() async {
    await _dictionary.load(LanguageCode.fr, LanguageCode.dyu);
    await _dictionary.load(LanguageCode.fr, LanguageCode.bci);
    return true;
  }
}
