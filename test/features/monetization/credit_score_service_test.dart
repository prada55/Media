// test/features/monetization/credit_score_service_test.dart

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:yako/features/monetization/domain/entities/aggregated_credit_payload.dart';
import 'package:yako/features/monetization/domain/services/credit_score_service.dart';
import 'package:yako/features/transactions/domain/entities/transaction.dart';

import '../../helpers/fake_transaction_repository.dart';

final _now = DateTime(2026, 10, 20, 12);

Transaction _tx(
  int daysAgo,
  TransactionType type,
  int amount, {
  TransactionCategory? category,
}) {
  final at = _now.subtract(Duration(days: daysAgo));
  return Transaction(
    id: 'tx-$daysAgo-${type.code}-$amount',
    type: type,
    amount: amount,
    category:
        category ??
        (type == TransactionType.sale
            ? TransactionCategory.saleDrinks
            : TransactionCategory.expenseStock),
    transcriptFr: 'Mamadou 0700000000 a payé $amount',
    createdAt: at,
    updatedAt: at,
  );
}

void main() {
  final service = CreditScoreService(
    FakeTransactionRepository(),
    now: () => _now,
  );

  test('no activity → score 0, bucket 0-9, other', () {
    final score = service.computeLocalScore(const []);
    expect(score.score, 0);
    final payload = service.buildAggregatedPayload(score);
    expect(payload.txCountBucket, TxCountBucket.b0to9);
    expect(payload.businessCategory, BusinessCategory.other);
  });

  test('regular sales with low expenses score high', () {
    final txs = [
      for (var d = 0; d < 90; d++) ...[
        _tx(d, TransactionType.sale, 20000),
        _tx(d, TransactionType.sale, 15000),
        if (d.isEven) _tx(d, TransactionType.expense, 5000),
      ],
    ];
    final score = service.computeLocalScore(txs);
    expect(score.score, greaterThanOrEqualTo(80));
    expect(score.regularityPct, 100);
    expect(score.monthsActive, 2);
    final payload = service.buildAggregatedPayload(score);
    expect(payload.businessCategory, BusinessCategory.drinks);
    expect(payload.txCountBucket, TxCountBucket.b200plus);
  });

  test('expenses above sales lower the score', () {
    final good = service.computeLocalScore([
      for (var d = 0; d < 30; d++) _tx(d, TransactionType.sale, 10000),
    ]);
    final bad = service.computeLocalScore([
      for (var d = 0; d < 30; d++) ...[
        _tx(d, TransactionType.sale, 10000),
        _tx(d, TransactionType.expense, 15000),
      ],
    ]);
    expect(bad.expenseRatioScore, 0);
    expect(bad.score, lessThan(good.score + 25));
    expect(good.expenseRatioScore, 1);
  });

  test('payload: strict whitelist, no PII, no exact amounts', () {
    final txs = [
      for (var d = 0; d < 20; d++) _tx(d, TransactionType.sale, 12345 + d),
    ];
    final payload = service.buildAggregatedPayload(
      service.computeLocalScore(txs),
    );
    final json = payload.toJson();
    expect(json.keys.toSet(), AggregatedCreditPayload.allowedFields);
    expect(json.keys, hasLength(5));

    final serialized = jsonEncode(json);
    for (final forbidden in [
      'Mamadou',
      '0700000000',
      '12345',
      'phone',
      'name',
      'amount',
      'transcript',
      'audio',
      'lat',
      'lon',
      'device',
      '2026',
    ]) {
      expect(serialized, isNot(contains(forbidden)), reason: forbidden);
    }
    expect((json['regularity_pct']! as int) % 5, 0);
    expect(json['tx_count_bucket'], '10-49');
  });

  test('values are clamped to their documented ranges', () {
    const payload = AggregatedCreditPayload(
      score: 140,
      businessCategory: BusinessCategory.food,
      monthsActive: -3,
      regularityPct: 120,
      txCountBucket: TxCountBucket.b50to199,
    );
    final json = payload.toJson();
    expect(json['score'], 100);
    expect(json['months_active'], 0);
    expect(json['regularity_pct'], 100);
  });

  test('computeFromRepository pages through every transaction', () async {
    final repo = FakeTransactionRepository([
      for (var d = 0; d < 30; d++) _tx(d, TransactionType.sale, 1000),
    ]);
    final score = await CreditScoreService(
      repo,
      now: () => _now,
    ).computeFromRepository();
    expect(score.getOrNull()!.txCount90d, 30);
  });
}
