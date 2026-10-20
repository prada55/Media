// test/helpers/l10n.dart
//
// Charge les textes d'interface réels (assets/i18n/ui_*.json) pour que les
// tests de widgets voient le français.

import 'package:flutter_test/flutter_test.dart';
import 'package:yako/features/translation/data/services/localization_loader.dart';
import 'package:yako/features/translation/domain/services/localization_service.dart';

Future<void> loadTestL10n() async {
  TestWidgetsFlutterBinding.ensureInitialized();
  LocalizationService.instance = await loadLocalization();
}
