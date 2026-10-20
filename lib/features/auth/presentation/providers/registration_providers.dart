// lib/features/auth/presentation/providers/registration_providers.dart
//
// Brouillon d'inscription en mémoire (langue + numéro). Le PIN n'y est
// jamais stocké : il est transmis directement à l'inscription.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';

/// Registration draft values.
final class RegistrationDraft {
  const RegistrationDraft({this.language = LanguageCode.fr, this.phone});

  final LanguageCode language;

  /// Numéro national à 10 chiffres déjà validé.
  final String? phone;
}

final registrationDraftProvider =
    NotifierProvider<RegistrationDraftController, RegistrationDraft>(
      RegistrationDraftController.new,
    );

/// Holds the onboarding draft.
class RegistrationDraftController extends Notifier<RegistrationDraft> {
  @override
  RegistrationDraft build() => const RegistrationDraft();

  void setLanguage(LanguageCode language) =>
      state = RegistrationDraft(language: language, phone: state.phone);

  void setPhone(String nationalPhone) =>
      state = RegistrationDraft(language: state.language, phone: nationalPhone);

  void clear() => state = const RegistrationDraft();
}
