// lib/core/security/data_key_reader.dart
//
// Accès à la clé de données de la session déverrouillée.

/// Returns the session data key, `null` when the app is locked.
typedef DataKeyReader = String? Function();
