// test/core/security/encryption_service_test.dart

import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/security/encryption_service_impl.dart';
import 'package:yako/data/local/database_opener.dart';

import '../../helpers/mocks.dart';

void main() {
  late MockSecureStorage storage;
  late MockAppDirectories directories;
  late Directory tempDir;
  late EncryptionServiceImpl service;

  setUp(() async {
    storage = MockSecureStorage();
    directories = MockAppDirectories();
    tempDir = await Directory.systemTemp.createTemp('yako_enc_');
    when(() => directories.documents()).thenAnswer((_) async => tempDir);
    service = EncryptionServiceImpl(storage: storage, directories: directories);
  });

  tearDown(() async {
    if (tempDir.existsSync()) await tempDir.delete(recursive: true);
  });

  group('salts and keys', () {
    test('generateSalt returns 32 random bytes, unique each call', () {
      final a = service.generateSalt().getOrNull()!;
      final b = service.generateSalt().getOrNull()!;
      expect(base64Decode(a), hasLength(32));
      expect(a, isNot(b));
    });

    test('generateKey returns 32 bytes', () {
      expect(base64Decode(service.generateKey().getOrNull()!), hasLength(32));
    });
  });

  group('PBKDF2', () {
    test('deriveKeyFromPin is deterministic and 32 bytes', () async {
      final salt = service.generateSalt().getOrNull()!;
      final k1 = (await service.deriveKeyFromPin('814725', salt)).getOrNull();
      final k2 = (await service.deriveKeyFromPin('814725', salt)).getOrNull();
      expect(k1, isNotNull);
      expect(k1, k2);
      expect(base64Decode(k1!), hasLength(32));
    });

    test('different salt or PIN gives a different key', () async {
      final s1 = service.generateSalt().getOrNull()!;
      final s2 = service.generateSalt().getOrNull()!;
      final a = (await service.deriveKeyFromPin('814725', s1)).getOrNull();
      final b = (await service.deriveKeyFromPin('814725', s2)).getOrNull();
      final c = (await service.deriveKeyFromPin('814726', s1)).getOrNull();
      expect(a, isNot(b));
      expect(a, isNot(c));
    });

    test('hashPin is domain-separated from the derived key', () async {
      final salt = service.generateSalt().getOrNull()!;
      final key = (await service.deriveKeyFromPin('814725', salt)).getOrNull();
      final hash = (await service.hashPin('814725', salt)).getOrNull();
      expect(hash, isNotNull);
      expect(hash, isNot(key));
    });

    test('verifyPin accepts the right PIN only', () async {
      final salt = service.generateSalt().getOrNull()!;
      final hash = (await service.hashPin('814725', salt)).getOrNull()!;
      expect((await service.verifyPin('814725', salt, hash)).getOrNull(),
          isTrue);
      expect((await service.verifyPin('814726', salt, hash)).getOrNull(),
          isFalse);
    });

    test('short or invalid salt → EncryptionFailure', () async {
      final short = await service.deriveKeyFromPin('814725', 'AAAA');
      expect(short.getFailureOrNull(), isA<EncryptionFailure>());
      final invalid = await service.hashPin('814725', '%%%');
      expect(invalid.getFailureOrNull(), isA<EncryptionFailure>());
    });
  });

  group('AES-256-GCM', () {
    test('round-trip text', () async {
      final key = service.generateKey().getOrNull()!;
      final sealed =
          (await service.encryptAesGcm('Vente riz 25 000 F', key)).getOrNull()!;
      expect(sealed, isNot(contains('riz')));
      final clear = await service.decryptAesGcm(sealed, key);
      expect(clear.getOrNull(), 'Vente riz 25 000 F');
    });

    test('same plaintext encrypts differently (random nonce)', () async {
      final key = service.generateKey().getOrNull()!;
      final a = (await service.encryptAesGcm('15000', key)).getOrNull();
      final b = (await service.encryptAesGcm('15000', key)).getOrNull();
      expect(a, isNot(b));
    });

    test('wrong key → EncryptionFailure', () async {
      final key = service.generateKey().getOrNull()!;
      final other = service.generateKey().getOrNull()!;
      final sealed = (await service.encryptAesGcm('secret', key)).getOrNull()!;
      final result = await service.decryptAesGcm(sealed, other);
      expect(result.getFailureOrNull(), isA<EncryptionFailure>());
    });

    test('tampered ciphertext → EncryptionFailure', () async {
      final key = service.generateKey().getOrNull()!;
      final sealed = base64Decode(
        (await service.encryptAesGcm('secret', key)).getOrNull()!,
      );
      sealed[sealed.length - 1] ^= 0x01;
      final result = await service.decryptAesGcm(base64Encode(sealed), key);
      expect(result.isFailure, isTrue);
    });

    test('invalid inputs → EncryptionFailure, never throws', () async {
      final key = service.generateKey().getOrNull()!;
      expect((await service.decryptAesGcm('***', key)).isFailure, isTrue);
      expect((await service.decryptAesGcm('AQID', key)).isFailure, isTrue);
      expect((await service.encryptAesGcm('x', 'AAAA')).isFailure, isTrue);
    });

    test('round-trip bytes', () async {
      final key = service.generateKey().getOrNull()!;
      final data = Uint8List.fromList(List.generate(5000, (i) => i % 256));
      final sealed = (await service.encryptBytes(data, key)).getOrNull()!;
      final clear = (await service.decryptBytes(sealed, key)).getOrNull();
      expect(clear, data);
    });
  });

  group('secure storage', () {
    test('store / get / delete the DB key', () async {
      when(
        () => storage.write(key: kDbKeyStorageKey, value: 'k'),
      ).thenAnswer((_) async {});
      when(() => storage.read(key: kDbKeyStorageKey))
          .thenAnswer((_) async => 'k');
      when(() => storage.delete(key: kDbKeyStorageKey))
          .thenAnswer((_) async {});

      expect((await service.storeDbKey('k')).isSuccess, isTrue);
      expect((await service.getDbKey()).getOrNull(), 'k');
      expect((await service.deleteDbKey()).isSuccess, isTrue);
      verify(() => storage.delete(key: kDbKeyStorageKey)).called(1);
    });

    test('storage error → EncryptionFailure', () async {
      when(() => storage.read(key: kDbKeyStorageKey))
          .thenThrow(Exception('keystore down'));
      final result = await service.getDbKey();
      expect(result.getFailureOrNull(), isA<EncryptionFailure>());
    });
  });

  group('secureWipe', () {
    test('deletes keys and overwrites then removes DB files', () async {
      when(() => storage.deleteAll()).thenAnswer((_) async {});
      final db = File(databasePath(tempDir))
        ..writeAsStringSync('SQLite format 3 secret data');
      final wal = File('${db.path}-wal')..writeAsStringSync('wal');

      final result = await service.secureWipe();

      expect(result.isSuccess, isTrue);
      verify(() => storage.deleteAll()).called(1);
      expect(db.existsSync(), isFalse);
      expect(wal.existsSync(), isFalse);
    });

    test('storage failure → EncryptionFailure', () async {
      when(() => storage.deleteAll()).thenThrow(Exception('fail'));
      expect((await service.secureWipe()).isFailure, isTrue);
    });
  });
}
