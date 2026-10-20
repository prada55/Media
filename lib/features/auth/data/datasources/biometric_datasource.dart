// lib/features/auth/data/datasources/biometric_datasource.dart
//
// Accès à la biométrie du système (Face ID, Touch ID, empreinte Android)
// via local_auth. Aucune donnée biométrique n'est lue par Yako : seul un
// booléen « reconnu / non reconnu » est renvoyé par le système.

import 'package:local_auth/local_auth.dart';

/// Biometric prompt abstraction.
abstract interface class BiometricDatasource {
  Future<bool> isAvailable();

  /// `true` when the user was recognized. Never throws.
  Future<bool> authenticate({required String reason});
}

/// local_auth implementation.
class LocalAuthBiometricDatasource implements BiometricDatasource {
  LocalAuthBiometricDatasource([LocalAuthentication? auth])
    : _auth = auth ?? LocalAuthentication();

  final LocalAuthentication _auth;

  @override
  Future<bool> isAvailable() async {
    try {
      final supported = await _auth.isDeviceSupported();
      final canCheck = await _auth.canCheckBiometrics;
      if (!supported || !canCheck) return false;
      final enrolled = await _auth.getAvailableBiometrics();
      return enrolled.isNotEmpty;
    } on Object {
      return false;
    }
  }

  @override
  Future<bool> authenticate({required String reason}) async {
    try {
      return await _auth.authenticate(
        localizedReason: reason,
        biometricOnly: true,
      );
    } on Object {
      return false;
    }
  }
}
