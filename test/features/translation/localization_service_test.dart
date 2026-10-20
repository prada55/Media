// test/features/translation/localization_service_test.dart

import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yako/features/translation/data/services/localization_loader.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';
import 'package:yako/features/translation/domain/services/localization_service.dart';

void main() {
  const service = LocalizationService({
    LanguageCode.fr: {'hello': 'Bonjour {name}', 'only_fr': 'Français'},
    LanguageCode.dyu: {'hello': '[dyu] {name}'},
  });

  test('requested language, then French, then the key', () {
    expect(
      service.translate('hello', LanguageCode.dyu, args: {'name': 'Awa'}),
      '[dyu] Awa',
    );
    expect(service.translate('only_fr', LanguageCode.dyu), 'Français');
    expect(service.translate('only_fr', LanguageCode.bci), 'Français');
    expect(service.translate('missing', LanguageCode.fr), 'missing');
  });

  test('coverage and hasTranslation', () {
    expect(service.coverage(LanguageCode.fr), 1);
    expect(service.coverage(LanguageCode.dyu), 0.5);
    expect(service.hasTranslation('hello', LanguageCode.dyu), isTrue);
    expect(service.hasTranslation('only_fr', LanguageCode.dyu), isFalse);
  });

  test('shipped files: same keys everywhere, local values are null', () async {
    TestWidgetsFlutterBinding.ensureInitialized();
    final fr = jsonDecode(
      await rootBundle.loadString('assets/i18n/ui_fr.json'),
    ) as Map<String, dynamic>;
    for (final code in ['dyu', 'bci']) {
      final local = jsonDecode(
        await rootBundle.loadString('assets/i18n/ui_$code.json'),
      ) as Map<String, dynamic>;
      expect(
        local.keys.where((k) => !k.startsWith('_')).toSet(),
        fr.keys.toSet(),
        reason: code,
      );
      expect(
        local.entries
            .where((e) => !e.key.startsWith('_'))
            .every((e) => e.value == null),
        isTrue,
      );
    }
    final loaded = await loadLocalization();
    expect(loaded.translate('onboarding.start', LanguageCode.dyu), 'Commencer');
    expect(loaded.coverage(LanguageCode.dyu), 0);
  });
}
