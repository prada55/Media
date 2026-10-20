// test/helpers/mocks.dart
//
// Mocks partagés : aucun test ne touche au vrai Keychain/Keystore.

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:mocktail/mocktail.dart';
import 'package:yako/core/platform/app_directories.dart';

class MockSecureStorage extends Mock implements FlutterSecureStorage;

class MockAppDirectories extends Mock implements AppDirectories;
