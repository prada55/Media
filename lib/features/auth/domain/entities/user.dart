// lib/features/auth/domain/entities/user.dart
//
// Utilisateur côté domaine. Ne contient JAMAIS le hash ni le sel du PIN.

import 'package:yako/features/translation/domain/entities/language_code.dart';

/// Domain user.
final class User {
  const User({
    required this.id,
    required this.phoneHash,
    required this.language,
    required this.biometricEnabled,
    required this.createdAt,
  });

  final String id;

  /// Empreinte salée du numéro (jamais le numéro lui-même).
  final String phoneHash;

  final LanguageCode language;

  final bool biometricEnabled;

  final DateTime createdAt;

  User copyWith({LanguageCode? language, bool? biometricEnabled}) => User(
    id: id,
    phoneHash: phoneHash,
    language: language ?? this.language,
    biometricEnabled: biometricEnabled ?? this.biometricEnabled,
    createdAt: createdAt,
  );
}
