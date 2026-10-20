// test/features/transactions/transaction_repository_test.dart

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/features/transactions/data/repositories/transaction_repository_impl.dart';
import 'package:yako/features/transactions/data/services/audio_storage_service_impl.dart';
import 'package:yako/features/transactions/domain/entities/transaction.dart';
import 'package:yako/features/transactions/domain/entities/transaction_draft.dart';
import 'package:yako/features/transactions/domain/value_objects/transaction_filter.dart';

import '../../helpers/auth_harness.dart';

void main() {
  late AuthHarness h;
  late String? dataKey;
  late TransactionRepositoryImpl repo;
  late AudioStorageServiceImpl audio;
  late Directory tmp;

  setUp(() async {
    h = await AuthHarness.create();
    tmp = await h.dir.createTemp('tmp');
    when(h.directories.temporary).thenAnswer((_) async => tmp);
    dataKey = h.encryption.generateKey().getOrNull();
    audio = AudioStorageServiceImpl(
      encryption: h.encryption,
      dataKey: () => dataKey,
      directories: h.directories,
    );
    repo = TransactionRepositoryImpl(
      databaseManager: h.databaseManager,
      encryption: h.encryption,
      audioStorage: audio,
      dataKey: () => dataKey,
      now: () => h.now,
    );
  });
  tearDown(() => h.dispose());

  TransactionDraft draft({
    int amount = 25000,
    TransactionType type = TransactionType.sale,
    String transcript = 'trois sacs de riz',
  }) => TransactionDraft(
    type: type,
    amount: amount,
    category: type == TransactionType.sale
        ? TransactionCategory.saleGoods
        : TransactionCategory.expenseTransport,
    transcriptFr: transcript,
  );

  test('create / getById / update / delete', () async {
    final created = (await repo.create(draft())).getOrNull()!;
    final read = (await repo.getById(created.id)).getOrNull()!;
    expect(read.amount, 25000);
    expect(read.transcriptFr, 'trois sacs de riz');
    expect(read.formattedAmount, '25 000 FCFA');

    final updated = await repo.update(read.copyWith(amount: 30000));
    expect(updated.getOrNull()!.amount, 30000);
    expect((await repo.getById(created.id)).getOrNull()!.amount, 30000);

    expect((await repo.delete(created.id)).isSuccess, isTrue);
    expect((await repo.getById(created.id)).getOrNull(), isNull);
    expect((await repo.delete(created.id)).isFailure, isTrue);
  });

  test('raw database contains neither amounts nor transcripts', () async {
    await repo.create(draft(amount: 987654, transcript: 'piment rouge'));
    final db = (await h.databaseManager.open()).getOrNull()!;
    final raw = await db.customSelect('SELECT * FROM transactions').get();
    final values = raw.single.data.values.map((v) => '$v').join('|');
    expect(values, isNot(contains('987654')));
    expect(values, isNot(contains('piment')));
    // The amount column holds AES-GCM ciphertext (base64).
    expect(
      base64Decode(raw.single.read<String>('amount')).length,
      greaterThan(28),
    );

    await h.databaseManager.close();
    final fileBytes = latin1.decode(h.databaseFile.readAsBytesSync());
    expect(fileBytes, isNot(contains('piment')));
  });

  test('wrong data key cannot read transactions', () async {
    final created = (await repo.create(draft())).getOrNull()!;
    dataKey = h.encryption.generateKey().getOrNull();
    final read = await repo.getById(created.id);
    expect(read.getFailureOrNull(), isA<EncryptionFailure>());
  });

  test('locked session → failure, nothing written', () async {
    dataKey = null;
    expect(
      (await repo.create(draft())).getFailureOrNull(),
      isA<EncryptionFailure>(),
    );
  });

  test('invalid amount → ValidationFailure', () async {
    expect(
      (await repo.create(draft(amount: 0))).getFailureOrNull(),
      isA<ValidationFailure>(),
    );
  });

  test('totals, filters and newest-first ordering', () async {
    await repo.create(draft(amount: 10000));
    h.now = h.now.add(const Duration(minutes: 1));
    await repo.create(draft(amount: 4000, type: TransactionType.expense));
    h.now = h.now.add(const Duration(days: 10));
    await repo.create(draft(amount: 500));

    final all = (await repo.getAll()).getOrNull()!;
    expect(all.map((t) => t.amount), [500, 4000, 10000]);

    final totals = (await repo.computeTotals(const TransactionFilter()))
        .getOrNull()!;
    expect(totals.totalSales, 10500);
    expect(totals.totalExpenses, 4000);
    expect(totals.balance, 6500);

    final today = (await repo.computeTotals(
      const TransactionFilter(period: TransactionPeriod.today),
    )).getOrNull()!;
    expect(today.totalSales, 500);

    final expenses = (await repo.getAll(
      filter: const TransactionFilter(type: TransactionType.expense),
    )).getOrNull()!;
    expect(expenses.single.amount, 4000);
  });

  test('search on decrypted transcript, category and amount', () async {
    await repo.create(draft(transcript: 'Riz parfumé'));
    await repo.create(draft(amount: 1500, transcript: 'pain'));
    await repo.create(
      draft(amount: 3000, type: TransactionType.expense, transcript: 'taxi'),
    );
    expect((await repo.search('riz')).getOrNull()!.single.amount, 25000);
    expect(
      (await repo.search('1 500')).getOrNull()!.single.transcriptFr,
      'pain',
    );
    expect((await repo.search('transport')).getOrNull()!.single.amount, 3000);
    expect((await repo.search('')).getOrNull(), hasLength(3));
    expect((await repo.search('inconnu')).getOrNull(), isEmpty);
  });

  test('search paginates beyond one scan page', () async {
    for (var i = 0; i < TransactionRepositoryImpl.scanPageSize + 20; i++) {
      await repo.create(draft(amount: 100 + i, transcript: 'lot $i'));
    }
    final found = (await repo.search('lot 7', limit: 1000)).getOrNull()!;
    // lot 7, 70-79, 700-... within 520 rows: 7 + 70..79 = 11
    expect(found, hasLength(11));
  }, timeout: const Timeout(Duration(minutes: 2)));

  test('watchRecent emits on changes', () async {
    final emissions = <int>[];
    final sub = repo.watchRecent().listen(
      (r) => emissions.add(r.getOrNull()!.length),
    );
    await Future<void>.delayed(const Duration(milliseconds: 100));
    await repo.create(draft());
    await Future<void>.delayed(const Duration(milliseconds: 100));
    await sub.cancel();
    expect(emissions.first, 0);
    expect(emissions.last, 1);
  });

  test('delete also wipes the encrypted audio', () async {
    final temp = File('${tmp.path}/rec.m4a')..writeAsBytesSync([1, 2, 3, 4]);
    final stored = (await audio.storeEncrypted(temp.path)).getOrNull()!;
    final created = (await repo.create(
      TransactionDraft(
        type: TransactionType.sale,
        amount: 1000,
        category: TransactionCategory.saleFood,
        audioPath: stored,
      ),
    )).getOrNull()!;
    final file = File('${h.dir.path}/$stored');
    expect(file.existsSync(), isTrue);
    await repo.delete(created.id);
    expect(file.existsSync(), isFalse);
  });
}
