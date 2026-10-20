// lib/features/auth/domain/entities/auth_session.dart
//
// Session déverrouillée : l'utilisateur et la clé de données (AES-256)
// qui chiffre montants et transcriptions. Vit UNIQUEMENT en mémoire.

import 'package:yako/features/auth/domain/entities/user.dart';

/// Unlocked session material (memory only, never persisted or logged).
final class AuthSession {
  const AuthSession({required this.user, required this.dataKey});

  final User user;

  /// Base64 32-byte key for application-level field encryption.
  final String dataKey;

  AuthSession copyWith({User? user}) =>
      AuthSession(user: user ?? this.user, dataKey: dataKey);

  @override
  String toString() => 'AuthSession(user: ${user.id})';
}
