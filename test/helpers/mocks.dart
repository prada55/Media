// test/helpers/mocks.dart
//
// Mocks partagés : aucun test ne touche au vrai Keychain/Keystore.

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:mocktail/mocktail.dart';
import 'package:yako/core/platform/app_directories.dart';
import 'package:yako/features/auth/data/datasources/biometric_datasource.dart';
import 'package:yako/features/transactions/domain/services/microphone_permission.dart';
import 'package:yako/features/transactions/domain/services/voice_service.dart';

class MockSecureStorage extends Mock implements FlutterSecureStorage;

class MockAppDirectories extends Mock implements AppDirectories;

class MockBiometricDatasource extends Mock implements BiometricDatasource;

class MockVoiceService extends Mock implements VoiceService;

class MockMicrophonePermission extends Mock implements MicrophonePermission;

/// Backs [storage] with an in-memory map and returns that map.
Map<String, String> stubInMemoryStorage(MockSecureStorage storage) {
  final values = <String, String>{};
  when(
    () => storage.write(
      key: any(named: 'key'),
      value: any(named: 'value'),
    ),
  ).thenAnswer((inv) async {
    final key = inv.namedArguments[#key] as String;
    final value = inv.namedArguments[#value] as String?;
    if (value == null) {
      values.remove(key);
    } else {
      values[key] = value;
    }
  });
  when(() => storage.read(key: any(named: 'key')))
      .thenAnswer((inv) async => values[inv.namedArguments[#key] as String]);
  when(() => storage.delete(key: any(named: 'key'))).thenAnswer((inv) async {
    values.remove(inv.namedArguments[#key] as String);
  });
  when(storage.deleteAll).thenAnswer((_) async => values.clear());
  return values;
}
