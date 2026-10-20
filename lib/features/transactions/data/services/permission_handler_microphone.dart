// lib/features/transactions/data/services/permission_handler_microphone.dart
//
// Permission micro via permission_handler.

import 'package:permission_handler/permission_handler.dart';
import 'package:yako/features/transactions/domain/services/microphone_permission.dart';

/// permission_handler implementation.
class PermissionHandlerMicrophone implements MicrophonePermission {
  const PermissionHandlerMicrophone();

  @override
  Future<MicPermission> status() async =>
      _map(await Permission.microphone.status);

  @override
  Future<MicPermission> request() async =>
      _map(await Permission.microphone.request());

  @override
  Future<bool> openSettings() => openAppSettings();

  MicPermission _map(PermissionStatus status) {
    if (status.isGranted || status.isLimited) return MicPermission.granted;
    if (status.isPermanentlyDenied || status.isRestricted) {
      return MicPermission.permanentlyDenied;
    }
    return MicPermission.denied;
  }
}
