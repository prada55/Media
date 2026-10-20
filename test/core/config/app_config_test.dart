// test/core/config/app_config_test.dart

import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yako/core/config/app_config.dart';

const _key = 'test-key';

String _signed(Map<String, dynamic> json, {String key = _key}) {
  final copy = Map<String, dynamic>.of(json);
  copy['config_signature'] = computeJsonSignature(copy, hmacKey: key);
  return jsonEncode(copy);
}

Map<String, dynamic> _validJson() => {
  'app_version': '1.2.3',
  'api_base_url': 'https://example.test',
  'monetization_enabled': true,
  'default_language': 'dyu',
  'feature_flags': {'voice_translation': true, 'sync': false},
};

class _FakeBundle extends CachingAssetBundle {
  _FakeBundle(this.content);

  final String? content;

  @override
  Future<ByteData> load(String key) async {
    final value = content;
    if (value == null) throw StateError('missing asset $key');
    return ByteData.sublistView(utf8.encode(value));
  }
}

void main() {
  group('AppConfig.parse', () {
    test('valid signature → signed values', () {
      final config = AppConfig.parse(_signed(_validJson()), hmacKey: _key);
      expect(config.source, ConfigSource.signed);
      expect(config.appVersion, '1.2.3');
      expect(config.monetizationEnabled, isTrue);
      expect(config.defaultLanguage, 'dyu');
      expect(config.featureFlags.voiceTranslation, isTrue);
      expect(config.featureFlags.sync, isFalse);
    });

    test('signature does not depend on key order', () {
      final json = _validJson();
      final reordered = {
        for (final k in json.keys.toList().reversed) k: json[k],
      };
      expect(
        computeJsonSignature(json, hmacKey: _key),
        computeJsonSignature(reordered, hmacKey: _key),
      );
    });

    test('tampered value → fallback defaults', () {
      final raw = jsonDecode(_signed(_validJson())) as Map<String, dynamic>;
      raw['monetization_enabled'] = false;
      final config = AppConfig.parse(jsonEncode(raw), hmacKey: _key);
      expect(config.source, ConfigSource.fallback);
      expect(config.monetizationEnabled, isFalse);
    });

    test('wrong key → fallback', () {
      final config = AppConfig.parse(
        _signed(_validJson(), key: 'other'),
        hmacKey: _key,
      );
      expect(config.source, ConfigSource.fallback);
    });

    test('missing signature → fallback', () {
      final config = AppConfig.parse(jsonEncode(_validJson()), hmacKey: _key);
      expect(config.source, ConfigSource.fallback);
    });

    test('malformed JSON → fallback, no throw', () {
      expect(
        AppConfig.parse('{not json', hmacKey: _key).source,
        ConfigSource.fallback,
      );
      expect(
        AppConfig.parse('[1, 2]', hmacKey: _key).source,
        ConfigSource.fallback,
      );
    });

    test('unsupported language falls back to fr', () {
      final json = _validJson()..['default_language'] = 'xx';
      expect(
        AppConfig.parse(_signed(json), hmacKey: _key).defaultLanguage,
        'fr',
      );
    });

    test('defaults keep monetization and flags OFF', () {
      expect(AppConfig.defaults.monetizationEnabled, isFalse);
      expect(AppConfig.defaults.featureFlags.sync, isFalse);
      expect(AppConfig.defaults.featureFlags.voiceTranslation, isFalse);
    });
  });

  group('AppConfig.load', () {
    test('reads the bundle', () async {
      final config = await AppConfig.load(
        bundle: _FakeBundle(_signed(_validJson())),
        hmacKey: _key,
      );
      expect(config.source, ConfigSource.signed);
    });

    test('missing asset → fallback', () async {
      final config = await AppConfig.load(bundle: _FakeBundle(null));
      expect(config.source, ConfigSource.fallback);
    });

    test('shipped assets/config.json is signed with the dev key', () async {
      TestWidgetsFlutterBinding.ensureInitialized();
      final config = await AppConfig.load();
      expect(config.source, ConfigSource.signed);
      expect(config.monetizationEnabled, isFalse);
    });
  });
}
