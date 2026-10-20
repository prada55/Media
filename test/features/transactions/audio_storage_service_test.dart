// test/features/transactions/audio_storage_service_test.dart

import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/security/encryption_service_impl.dart';
import 'package:yako/features/transactions/data/services/audio_storage_service_impl.dart';

import '../../helpers/mocks.dart';

void main() {
  late Directory docs;
  late Directory tmp;
  late MockAppDirectories directories;
  late EncryptionServiceImpl encryption;
  late String? key;
  late AudioStorageServiceImpl storage;

  setUp(() async {
    docs = await Directory.systemTemp.createTemp('yako_docs_');
    tmp = await Directory.systemTemp.createTemp('yako_tmp_');
    directories = MockAppDirectories();
    when(directories.documents).thenAnswer((_) async => docs);
    when(directories.temporary).thenAnswer((_) async => tmp);
    encryption = EncryptionServiceImpl(
      storage: MockSecureStorage(),
      directories: directories,
    );
    key = encryption.generateKey().getOrNull();
    storage = AudioStorageServiceImpl(
      encryption: encryption,
      dataKey: () => key,
      directories: directories,
    );
  });

  tearDown(() async {
    await docs.delete(recursive: true);
    await tmp.delete(recursive: true);
  });

  File plainTemp() => File('${tmp.path}/rec.m4a')
    ..writeAsBytesSync(Uint8List.fromList(List.generate(4096, (i) => i % 251)));

  test('round-trip: encrypted at rest, plaintext temp wiped', () async {
    final plain = plainTemp();
    final original = plain.readAsBytesSync();

    final relative = (await storage.storeEncrypted(plain.path)).getOrNull()!;

    expect(relative, startsWith('audio/'));
    expect(relative, endsWith('.enc'));
    expect(plain.existsSync(), isFalse);
    final sealed = File('${docs.path}/$relative').readAsBytesSync();
    expect(sealed, isNot(original));

    final played = (await storage.decryptToTemp(relative)).getOrNull()!;
    expect(File(played).readAsBytesSync(), original);
  });

  test('wrong key cannot decrypt', () async {
    final relative = (await storage.storeEncrypted(plainTemp().path))
        .getOrNull()!;
    key = encryption.generateKey().getOrNull();
    final result = await storage.decryptToTemp(relative);
    expect(result.getFailureOrNull(), isA<EncryptionFailure>());
  });

  test('locked session → failure and plaintext kept for retry', () async {
    key = null;
    final plain = plainTemp();
    expect((await storage.storeEncrypted(plain.path)).isFailure, isTrue);
    expect(plain.existsSync(), isTrue);
  });

  test('delete and wipeAll remove files', () async {
    final a = (await storage.storeEncrypted(plainTemp().path)).getOrNull()!;
    final b = (await storage.storeEncrypted(plainTemp().path)).getOrNull()!;
    await storage.delete(a);
    expect(File('${docs.path}/$a').existsSync(), isFalse);
    expect(File('${docs.path}/$b').existsSync(), isTrue);
    await storage.wipeAll();
    expect(Directory('${docs.path}/audio').existsSync(), isFalse);
  });

  test('refuses paths outside the audio directory', () async {
    final result = await storage.delete('../yako.sqlite');
    expect(result.isFailure, isTrue);
  });
}
