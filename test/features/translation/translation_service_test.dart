// test/features/translation/translation_service_test.dart

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/features/translation/data/datasources/dictionary_datasource.dart';
import 'package:yako/features/translation/data/datasources/translation_cache_datasource.dart';
import 'package:yako/features/translation/data/engines/stub_translation_engine.dart';
import 'package:yako/features/translation/data/services/translation_service_impl.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';
import 'package:yako/features/translation/domain/entities/translation_result.dart';
import 'package:yako/features/translation/domain/services/translation_engine.dart';

import '../../helpers/auth_harness.dart';
import 'dictionary_datasource_test.dart' show syntheticBundle;

class _MockEngine extends Mock implements TranslationEngine;

void main() {
  setUpAll(() => registerFallbackValue(LanguageCode.fr));

  late AuthHarness h;
  late String? key;
  late TranslationCacheDatasource cache;

  setUp(() async {
    h = await AuthHarness.create();
    key = h.encryption.generateKey().getOrNull();
    cache = TranslationCacheDatasource(
      db: h.databaseManager,
      encryption: h.encryption,
      dataKey: () => key,
    );
  });
  tearDown(() => h.dispose());

  TranslationServiceImpl service({TranslationEngine? engine}) =>
      TranslationServiceImpl(
        dictionary: DictionaryDatasource(bundle: syntheticBundle()),
        cache: cache,
        engine: engine ?? const StubTranslationEngine(),
      );

  Future<Result<TranslationResult>> fr2dyu(
    TranslationServiceImpl s,
    String text,
  ) => s.translate(text, from: LanguageCode.fr, to: LanguageCode.dyu);

  test('exact dictionary hit', () async {
    final r = (await fr2dyu(service(), 'riz')).getOrNull()!;
    expect(r.text, '[dyu]riz');
    expect(r.origin, TranslationOrigin.dictionary);
  });

  test('fuzzy hit is cached, second call is a cache hit', () async {
    final s = service();
    final first = (await fr2dyu(s, 'bonjoru')).getOrNull()!;
    expect(first.origin, TranslationOrigin.fuzzyDictionary);
    final second = (await fr2dyu(s, 'bonjoru')).getOrNull()!;
    expect(second.origin, TranslationOrigin.cache);
    expect(second.text, '[dyu]bonjour');
  });

  test('cache stores only a hash of the source and encrypted text', () async {
    await fr2dyu(service(), 'bonjoru');
    final db = (await h.databaseManager.open()).getOrNull()!;
    final row = await db.select(db.translationsCache).getSingle();
    expect(row.sourceTextHash, TranslationCacheDatasource.hashOf('bonjoru'));
    expect(row.sourceTextHash, isNot(contains('bonjoru')));
    expect(row.translatedText, isNot(contains('[dyu]')));
  });

  test('cache miss when locked: no read, no write', () async {
    key = null;
    final r = (await fr2dyu(service(), 'bonjoru')).getOrNull()!;
    expect(r.origin, TranslationOrigin.fuzzyDictionary);
    final db = (await h.databaseManager.open()).getOrNull()!;
    expect(await db.select(db.translationsCache).get(), isEmpty);
  });

  test('unknown phrase → TranslationUnavailableFailure', () async {
    final r = await fr2dyu(service(), 'une phrase inconnue du dictionnaire');
    expect(r.getFailureOrNull(), isA<TranslationUnavailableFailure>());
  });

  test('placeholder entry → TranslationUnavailableFailure', () async {
    final r = await fr2dyu(service(), 'tomate');
    expect(r.getFailureOrNull(), isA<TranslationUnavailableFailure>());
  });

  test('model engine used last when available, result cached', () async {
    final engine = _MockEngine();
    when(engine.isAvailable).thenAnswer((_) async => true);
    when(
      () => engine.translate(
        any(),
        from: any(named: 'from'),
        to: any(named: 'to'),
      ),
    ).thenAnswer((_) async => const Success('[model]x'));
    final s = service(engine: engine);
    final r = (await fr2dyu(s, 'phrase hors dictionnaire')).getOrNull()!;
    expect(r.origin, TranslationOrigin.model);
    expect(
      (await fr2dyu(s, 'phrase hors dictionnaire')).getOrNull()!.origin,
      TranslationOrigin.cache,
    );
  });

  test('empty text → ValidationFailure; same language → identity', () async {
    final s = service();
    expect(
      (await fr2dyu(s, '  ')).getFailureOrNull(),
      isA<ValidationFailure>(),
    );
    final same = await s.translate(
      'riz',
      from: LanguageCode.fr,
      to: LanguageCode.fr,
    );
    expect(same.getOrNull()!.text, 'riz');
  });

  test('available targets are FR ↔ local only', () {
    final s = service();
    expect(s.getAvailableTargetLanguages(LanguageCode.fr), [
      LanguageCode.dyu,
      LanguageCode.bci,
    ]);
    expect(s.getAvailableTargetLanguages(LanguageCode.dyu), [LanguageCode.fr]);
  });

  test('stub engine is never available', () async {
    const engine = StubTranslationEngine();
    expect(await engine.isAvailable(), isFalse);
    expect(
      (await engine.translate(
        'x',
        from: LanguageCode.fr,
        to: LanguageCode.bci,
      )).isFailure,
      isTrue,
    );
  });
}
