// lib/features/transactions/domain/services/microphone_permission.dart
//
// Permission micro, demandée uniquement au premier appui long.

/// Microphone permission status as seen by the UI.
enum MicPermission { granted, denied, permanentlyDenied }

/// Microphone permission gateway.
abstract interface class MicrophonePermission {
  Future<MicPermission> status();

  Future<MicPermission> request();

  /// Opens the system settings page of the app.
  Future<bool> openSettings();
}
