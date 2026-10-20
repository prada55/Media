// test/features/settings/export_service_test.dart

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/security/encryption_service_impl.dart';
import 'package:yako/features/settings/data/services/export_service.dart';
import 'package:yako/features/transactions/domain/entities/transaction.dart';

import '../../helpers/fake_transaction_repository.dart';
import '../../helpers/mocks.dart';

Transaction _tx(String id, String transcript, int amount) => Transaction(
  id: id,
  type: TransactionType.sale,
  amount: amount,
  category: TransactionCategory.saleGoods,
  transcriptFr: transcript,
  createdAt: DateTime(2026, 10, 20, 9, 5),
  updatedAt: DateTime(2026, 10, 20, 9, 5),
);

void main() {
  late Directory tmp;
  late ExportService service;

  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('yako_export_');
    final dirs = MockAppDirectories();
    when(dirs.temporary).thenAnswer((_) async => tmp);
    service = ExportService(
      transactions: FakeTransactionRepository([
        _tx('a', 'riz, "parfumé"', 25000),
        _tx('b', '=SUM(A1:A9)', 1500),
      ]),
      encryption: EncryptionServiceImpl(
        storage: MockSecureStorage(),
        directories: dirs,
      ),
      directories: dirs,
      now: () => DateTime(2026, 10, 20),
    );
  });
  tearDown(() => tmp.delete(recursive: true));

  test('CSV escapes quotes/commas and neutralizes formulas', () {
    final csv = ExportService.buildCsv([
      _tx('a', 'riz, "parfumé"', 25000),
      _tx('b', '=SUM(A1:A9)', 1500),
    ]);
    final lines = csv.split('\r\n');
    expect(lines.first, startsWith('date,type,categorie,montant_fcfa'));
    expect(lines[1], contains('"riz, ""parfumé"""'));
    expect(lines[1], contains(',25000,'));
    expect(lines[2], contains("'=SUM(A1:A9)"));
  });

  test('export file: name, magic header, no plaintext', () async {
    final file = (await service.exportToFile('motdepasse')).getOrNull()!;
    expect(file.path, endsWith('yako_export_20261020.yako'));
    final bytes = file.readAsBytesSync();
    expect(ascii.decode(bytes.sublist(0, 5)), 'YAKO1');
    expect(latin1.decode(bytes), isNot(contains('riz')));
    expect(latin1.decode(bytes), isNot(contains('25000')));
  });

  test('right password decrypts, wrong one fails', () async {
    final bytes = (await service.exportToFile('motdepasse'))
        .getOrNull()!
        .readAsBytesSync();
    final clear = (await service.decrypt(bytes, 'motdepasse')).getOrNull()!;
    expect(clear, contains('25000'));
    expect(clear, contains('riz'));
    final wrong = await service.decrypt(bytes, 'mauvais-mdp');
    expect(wrong.getFailureOrNull(), isA<EncryptionFailure>());
  });

  test('short password is refused', () async {
    final result = await service.exportToFile('1234');
    expect(result.getFailureOrNull(), isA<ValidationFailure>());
  });

  test('not a Yako file → failure', () async {
    final result = await service.decrypt(utf8.encode('hello world, data'), 'x');
    expect(result.isFailure, isTrue);
  });
}
