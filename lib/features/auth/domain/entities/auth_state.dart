// lib/features/auth/domain/entities/auth_state.dart
//
// États d'authentification pilotant la navigation racine.

import 'package:yako/features/auth/domain/entities/user.dart';

/// Root authentication state.
sealed class AuthState {
  const AuthState();
}

/// Lecture initiale de la base / du trousseau.
final class AuthLoading extends AuthState {
  const AuthLoading();
}

/// Pas de session. [hasAccount] distingue inscription et connexion.
final class AuthUnauthenticated extends AuthState {
  const AuthUnauthenticated({required this.hasAccount});

  final bool hasAccount;
}

/// Session verrouillée automatiquement (inactivité / arrière-plan).
final class AuthLocked extends AuthState {
  const AuthLocked(this.user);

  final User user;
}

/// Compte avec biométrie : l'invite biométrique est proposée d'abord.
final class AuthBiometricRequired extends AuthState {
  const AuthBiometricRequired(this.user);

  final User user;
}

/// Session ouverte. [offerBiometrics] : proposer l'activation après
/// l'inscription.
final class AuthAuthenticated extends AuthState {
  const AuthAuthenticated(this.user, {this.offerBiometrics = false});

  final User user;

  final bool offerBiometrics;
}
