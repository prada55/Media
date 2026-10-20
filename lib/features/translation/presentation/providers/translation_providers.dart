// lib/features/translation/presentation/providers/translation_providers.dart
//
// Providers Riverpod de la traduction et de la langue d'interface.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show FutureProviderFamily;
import 'package:yako/core/di/injection.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/features/auth/presentation/providers/auth_providers.dart';
import 'package:yako/features/auth/presentation/providers/registration_providers.dart';
import 'package:yako/features/translation/data/datasources/dictionary_datasource.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';
import 'package:yako/features/translation/domain/entities/translation_result.dart';
import 'package:yako/features/translation/domain/services/localization_service.dart';
import 'package:yako/features/translation/domain/services/translation_service.dart';

final translationServiceProvider = Provider<TranslationService>(
  (ref) => getIt<TranslationService>(),
);

final dictionaryDatasourceProvider = Provider<DictionaryDatasource>(
  (ref) => getIt<DictionaryDatasource>(),
);

/// UI strings, loaded in `main()` and overridden in the root scope.
final localizationServiceProvider = Provider<LocalizationService>(
  (ref) => LocalizationService.instance,
);

final currentLanguageProvider =
    NotifierProvider<CurrentLanguageController, LanguageCode>(
      CurrentLanguageController.new,
    );

/// Current UI language: the account's (persisted in `users.language`), or
/// the onboarding choice before registration.
class CurrentLanguageController extends Notifier<LanguageCode> {
  @override
  LanguageCode build() {
    final user = ref.watch(currentUserProvider).value;
    return user?.language ?? ref.watch(registrationDraftProvider).language;
  }

  Future<void> select(LanguageCode language) async {
    if (ref.read(sessionManagerProvider).isActive) {
      await ref.read(authServiceProvider).setLanguage(language);
    } else {
      ref.read(registrationDraftProvider.notifier).setLanguage(language);
    }
  }
}

/// Request key for [translationProvider].
typedef TranslationRequest = ({
  String text,
  LanguageCode from,
  LanguageCode to,
});

/// On-demand translation (detail screen toggle).
final FutureProviderFamily<Result<TranslationResult>, TranslationRequest>
translationProvider = FutureProvider.autoDispose
    .family<Result<TranslationResult>, TranslationRequest>(
      (ref, request) => ref
          .watch(translationServiceProvider)
          .translate(request.text, from: request.from, to: request.to),
    );
