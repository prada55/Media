// lib/core/error/failure.dart
//
// Hiérarchie scellée des échecs métier/techniques de Yako.
// Chaque Failure porte un message technique (EN, pour le diagnostic local)
// et un message utilisateur (FR) affichable tel quel.
// Règle : aucun message ne doit contenir de PII (PIN, téléphone, montant).

/// Base type for every failure surfaced through `Result`.
sealed class Failure {
  const Failure({
    required this.technicalMessage,
    required this.userMessageFr,
    this.cause,
    this.stackTrace,
  });

  /// Developer-facing message (English). Must never contain PII.
  final String technicalMessage;

  /// Message montré à l'utilisateur (français).
  final String userMessageFr;

  /// Underlying error, kept for local debugging only (never logged remotely).
  final Object? cause;

  /// Stack trace captured where the failure was created.
  final StackTrace? stackTrace;

  @override
  String toString() => 'Failure($technicalMessage)';
}

/// Erreur de lecture/écriture dans la base locale.
final class DatabaseFailure extends Failure {
  const DatabaseFailure({
    required super.technicalMessage,
    super.userMessageFr = 'Impossible d’accéder à vos données. Réessayez.',
    super.cause,
    super.stackTrace,
  });
}

/// Erreur de chiffrement / déchiffrement / gestion de clé.
final class EncryptionFailure extends Failure {
  const EncryptionFailure({
    required super.technicalMessage,
    super.userMessageFr = 'Erreur de sécurité. Vos données sont protégées.',
    super.cause,
    super.stackTrace,
  });
}

/// Donnée saisie invalide (numéro, PIN, montant...).
final class ValidationFailure extends Failure {
  const ValidationFailure({
    required super.technicalMessage,
    required super.userMessageFr,
    super.cause,
    super.stackTrace,
  });
}

/// Erreur inattendue, non classée.
final class UnknownFailure extends Failure {
  const UnknownFailure({
    required super.technicalMessage,
    super.userMessageFr = 'Une erreur inattendue est survenue.',
    super.cause,
    super.stackTrace,
  });
}

/// Identifiants (téléphone / PIN) incorrects.
final class AuthenticationFailure extends Failure {
  const AuthenticationFailure({
    required super.technicalMessage,
    this.remainingAttempts,
    super.userMessageFr = 'Numéro ou code PIN incorrect.',
    super.cause,
    super.stackTrace,
  });

  /// Tentatives restantes avant verrouillage, si connu.
  final int? remainingAttempts;
}

/// Trop d'échecs : connexion bloquée pendant [remaining].
final class LockedOutFailure extends Failure {
  const LockedOutFailure({
    required this.remaining,
    super.technicalMessage = 'Too many failed attempts',
    super.userMessageFr = 'Trop d’essais. Patientez avant de réessayer.',
  });

  /// Durée restante de blocage.
  final Duration remaining;
}

/// Biométrie indisponible, refusée ou annulée.
final class BiometricFailure extends Failure {
  const BiometricFailure({
    required super.technicalMessage,
    super.userMessageFr = 'Empreinte ou visage non reconnu.',
    super.cause,
    super.stackTrace,
  });
}

/// Fonctionnalité absente de ce build (modèle non fourni, etc.).
final class FeatureNotAvailableFailure extends Failure {
  const FeatureNotAvailableFailure({
    required super.technicalMessage,
    super.userMessageFr = 'Cette fonction n’est pas encore disponible.',
    super.cause,
    super.stackTrace,
  });
}
