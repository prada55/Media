// integration_test/e2e_offline_stress_test.dart
//
// Charge hors ligne : 100 opérations chiffrées créées en < 5 s, base
// < 50 Mo, lecture/totaux/recherche cohérents.
//
// Lancer sur un appareil d'entrée de gamme (Tecno Spark / Infinix Hot) :
//   flutter test integration_test/e2e_offline_stress_test.dart -d <device>

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:yako/features/transactions/data/repositories/transaction_repository_impl.dart';
import 'package:yako/features/transactions/data/services/audio_storage_service_impl.dart';
import 'package:yako/features/transactions/domain/entities/transaction.dart';
import 'package:yako/features/transactions/domain/entities/transaction_draft.dart';
import 'package:yako/features/transactions/domain/value_objects/transaction_filter.dart';

import '../test/helpers/auth_harness.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  test('100 encrypted transactions: < 5 s and database < 50 MB', () async {
    final h = await AuthHarness.create();
    addTearDown(h.dispose);
    when(h.directories.temporary).thenAnswer((_) async => h.dir);
    final key = h.encryption.generateKey().getOrNull();
    final repo = TransactionRepositoryImpl(
      databaseManager: h.databaseManager,
      encryption: h.encryption,
      audioStorage: AudioStorageServiceImpl(
        encryption: h.encryption,
        dataKey: () => key,
        directories: h.directories,
      ),
      dataKey: () => key,
    );

    final stopwatch = Stopwatch()..start();
    for (var i = 0; i < 100; i++) {
      final sale = i.isEven;
      final result = await repo.create(
        TransactionDraft(
          type: sale ? TransactionType.sale : TransactionType.expense,
          amount: 1000 + i * 250,
          category: sale
              ? TransactionCategory.saleGoods
              : TransactionCategory.expenseStock,
          transcriptFr: 'opération numéro $i : sac de riz et tomates',
        ),
      );
      expect(result.isSuccess, isTrue);
    }
    stopwatch.stop();
    expect(
      stopwatch.elapsed,
      lessThan(const Duration(seconds: 5)),
      reason: 'created in ${stopwatch.elapsedMilliseconds} ms',
    );

    final all = (await repo.getAll(limit: 200)).getOrNull()!;
    expect(all, hasLength(100));
    final totals = (await repo.computeTotals(const TransactionFilter()))
        .getOrNull()!;
    expect(totals.count, 100);
    expect(
      (await repo.search('numéro 42')).getOrNull()!.single.amount,
      1000 + 42 * 250,
    );

    await h.databaseManager.close();
    final size = h.databaseFile.lengthSync();
    expect(size, lessThan(50 * 1024 * 1024), reason: 'db size $size bytes');
  });
}
