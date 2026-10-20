// test/features/translation/dictionary_datasource_test.dart
//
// Les entrées de test sont SYNTHÉTIQUES (« [dyu]… ») : aucune traduction
// réelle n'est inventée.

import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yako/features/translation/data/datasources/dictionary_datasource.dart';
import 'package:yako/features/translation/data/datasources/text_normalizer.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';

class FakeBundle extends CachingAssetBundle {
  FakeBundle(this.files);

  final Map<String, String> files;
  int loads = 0;

  @override
  Future<ByteData> load(String key) async {
    loads++;
    final content = files[key];
    if (content == null) throw StateError('missing $key');
    return ByteData.sublistView(utf8.encode(content));
  }

  @override
  Future<String> loadString(String key, {bool cache = true}) async {
    loads++;
    final content = files[key];
    if (content == null) throw StateError('missing $key');
    return content;
  }
}

String dictionaryJson(List<Map<String, Object?>> entries) =>
    jsonEncode({'meta': <String, Object>{}, 'entries': entries});

FakeBundle syntheticBundle() => FakeBundle({
  DictionaryDatasource.assetFor(
    LanguageCode.fr,
    LanguageCode.dyu,
  ): dictionaryJson([
    {'id': 'p1', 'fr': 'Bonjour', 'dyu': '[dyu]bonjour', 'category': 's'},
    {'id': 'p2', 'fr': 'riz', 'dyu': '[dyu]riz', 'category': 'p'},
    {'id': 'p3', 'fr': 'tomate', 'dyu': null, 'category': 'p'},
    {
      'id': 'p4',
      'fr': "aujourd'hui",
      'dyu': '[dyu]aujourdhui',
      'category': 't',
    },
  ]),
});

void main() {
  test('exact match is case/punctuation insensitive', () async {
    final ds = DictionaryDatasource(bundle: syntheticBundle());
    final hit = await ds.lookup(
      '  BONJOUR !',
      from: LanguageCode.fr,
      to: LanguageCode.dyu,
    );
    expect(hit, isNotNull);
    expect(hit!.text, '[dyu]bonjour');
    expect(hit.exact, isTrue);
  });

  test('apostrophes are unified', () async {
    final ds = DictionaryDatasource(bundle: syntheticBundle());
    final hit = await ds.lookup(
      'aujourd’hui',
      from: LanguageCode.fr,
      to: LanguageCode.dyu,
    );
    expect(hit?.text, '[dyu]aujourdhui');
  });

  test('fuzzy match within Levenshtein 2, not beyond', () async {
    final ds = DictionaryDatasource(bundle: syntheticBundle());
    final close = await ds.lookup(
      'bonjoru',
      from: LanguageCode.fr,
      to: LanguageCode.dyu,
    );
    expect(close?.text, '[dyu]bonjour');
    expect(close?.exact, isFalse);
    final far = await ds.lookup(
      'bon soir',
      from: LanguageCode.fr,
      to: LanguageCode.dyu,
    );
    expect(far, isNull);
  });

  test('placeholder entries (null target) are ignored', () async {
    final ds = DictionaryDatasource(bundle: syntheticBundle());
    expect(
      await ds.lookup('tomate', from: LanguageCode.fr, to: LanguageCode.dyu),
      isNull,
    );
    expect(await ds.translatedCount(LanguageCode.fr, LanguageCode.dyu), 3);
  });

  test('loads each file once (cache)', () async {
    final bundle = syntheticBundle();
    final ds = DictionaryDatasource(bundle: bundle);
    await ds.lookup('riz', from: LanguageCode.fr, to: LanguageCode.dyu);
    await ds.lookup('riz', from: LanguageCode.fr, to: LanguageCode.dyu);
    expect(bundle.loads, 1);
  });

  test('missing file or unsupported pair → empty', () async {
    final ds = DictionaryDatasource(bundle: FakeBundle({}));
    expect(await ds.load(LanguageCode.fr, LanguageCode.bci), isEmpty);
    expect(await ds.load(LanguageCode.dyu, LanguageCode.bci), isEmpty);
    expect(
      DictionaryDatasource.supports(LanguageCode.dyu, LanguageCode.bci),
      isFalse,
    );
  });

  test(
    'shipped dictionaries: 60 FR phrases, no invented translation',
    () async {
      TestWidgetsFlutterBinding.ensureInitialized();
      for (final pair in ['fr_dyu', 'fr_bci', 'dyu_fr', 'bci_fr']) {
        final raw = await rootBundle.loadString(
          'assets/i18n/phrases_$pair.json',
        );
        final json = jsonDecode(raw) as Map<String, dynamic>;
        final entries = (json['entries'] as List).cast<Map<String, dynamic>>();
        expect(entries, hasLength(60), reason: pair);
        final categories = entries.map((e) => e['category']).toSet();
        expect(categories, hasLength(6));
        final local = pair.replaceAll('fr', '').replaceAll('_', '');
        expect(entries.every((e) => e[local] == null), isTrue, reason: pair);
      }
    },
  );

  test('levenshtein', () {
    expect(levenshtein('riz', 'riz'), 0);
    expect(levenshtein('riz', 'ris'), 1);
    expect(levenshtein('kitten', 'sitting'), 3);
    expect(levenshtein('abc', 'abcdef', max: 2), 3);
  });
}
