// lib/core/presentation/l10n.dart
//
// Accès aux textes traduits depuis les widgets : `context.tr('clé')` ou le
// widget constant `Tr('clé')`.

import 'package:flutter/widgets.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';
import 'package:yako/features/translation/domain/services/localization_service.dart';

/// Provides the current UI language below the app root.
class L10nScope extends InheritedWidget {
  const L10nScope({
    required this.language,
    required this.service,
    required super.child,
    super.key,
  });

  final LanguageCode language;
  final LocalizationService service;

  @override
  bool updateShouldNotify(L10nScope oldWidget) =>
      language != oldWidget.language || service != oldWidget.service;
}

/// `context.tr(key)`.
extension L10nContext on BuildContext {
  String tr(String key, [Map<String, String> args = const {}]) {
    final scope = dependOnInheritedWidgetOfExactType<L10nScope>();
    final service = scope?.service ?? LocalizationService.instance;
    return service.translate(
      key,
      scope?.language ?? LanguageCode.fr,
      args: args,
    );
  }
}

/// Constant-friendly translated [Text].
class Tr extends StatelessWidget {
  const Tr(this.textKey, {this.style, this.textAlign, super.key});

  final String textKey;
  final TextStyle? style;
  final TextAlign? textAlign;

  @override
  Widget build(BuildContext context) =>
      Text(context.tr(textKey), style: style, textAlign: textAlign);
}
