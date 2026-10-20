// lib/features/monetization/domain/services/credit_score_service.dart
//
// Score 0-100 calculé sur l'appareil, sur 90 jours glissants :
//   40 % régularité (jours avec au moins une opération),
//   35 % maîtrise des dépenses (1 − dépenses/ventes, borné à [0, 1]),
//   25 % fréquence (2 opérations/jour = maximum).
// Le payload agrégé ne contient que des valeurs arrondies ou par tranches.

import 'package:yako/core/error/result.dart';
import 'package:yako/features/monetization/domain/entities/aggregated_credit_payload.dart';
import 'package:yako/features/monetization/domain/entities/credit_score.dart';
import 'package:yako/features/transactions/domain/entities/transaction.dart';
import 'package:yako/features/transactions/domain/repositories/transaction_repository.dart';

/// Local credit scoring.
class CreditScoreService {
  CreditScoreService(this._transactions, {DateTime Function()? now})
    : _now = now ?? DateTime.now;

  static const int windowDays = 90;
  static const int _page = 500;

  final TransactionRepository _transactions;
  final DateTime Function() _now;

  /// Reads every transaction (decrypted in memory) and scores them.
  Future<Result<CreditScore>> computeFromRepository() async {
    final all = <Transaction>[];
    var offset = 0;
    while (true) {
      final page = await _transactions.getAll(limit: _page, offset: offset);
      if (page case FailureResult(:final failure)) {
        return FailureResult(failure);
      }
      final items = page.getOrNull()!;
      all.addAll(items);
      if (items.length < _page) break;
      offset += _page;
    }
    return Success(computeLocalScore(all));
  }

  /// Pure scoring function.
  CreditScore computeLocalScore(List<Transaction> transactions) {
    final now = _now();
    final from = now.subtract(const Duration(days: windowDays));
    final recent = transactions
        .where((t) => !t.createdAt.isBefore(from))
        .toList();

    DateTime? first;
    for (final t in transactions) {
      if (first == null || t.createdAt.isBefore(first)) first = t.createdAt;
    }
    final observedDays = first == null
        ? windowDays
        : now.difference(first).inDays.clamp(1, windowDays);

    final activeDays = {
      for (final t in recent)
        DateTime(t.createdAt.year, t.createdAt.month, t.createdAt.day),
    }.length;
    final regularity = (activeDays / observedDays).clamp(0.0, 1.0);

    var sales = 0;
    var expenses = 0;
    final saleCategories = <TransactionCategory, int>{};
    for (final t in recent) {
      if (t.type == TransactionType.sale) {
        sales += t.amount;
        saleCategories.update(t.category, (n) => n + 1, ifAbsent: () => 1);
      } else {
        expenses += t.amount;
      }
    }
    final ratioScore = sales == 0
        ? 0.0
        : (1 - expenses / sales).clamp(0.0, 1.0);
    final frequency = (recent.length / observedDays / 2).clamp(0.0, 1.0);

    final score =
        (100 * (0.40 * regularity + 0.35 * ratioScore + 0.25 * frequency))
            .round()
            .clamp(0, 100);

    TransactionCategory? dominant;
    var best = 0;
    for (final MapEntry(:key, :value) in saleCategories.entries) {
      if (value > best) {
        best = value;
        dominant = key;
      }
    }

    return CreditScore(
      score: score,
      regularityPct: (regularity * 100).round(),
      expenseRatioScore: ratioScore,
      frequencyScore: frequency,
      monthsActive: first == null ? 0 : _monthsBetween(first, now),
      txCount90d: recent.length,
      dominantCategory: dominant,
      computedAt: now,
    );
  }

  /// Whitelisted payload — the only data that may ever leave the device.
  AggregatedCreditPayload buildAggregatedPayload(CreditScore score) =>
      AggregatedCreditPayload(
        score: score.score,
        businessCategory: switch (score.dominantCategory) {
          TransactionCategory.saleGoods => BusinessCategory.goods,
          TransactionCategory.saleDrinks => BusinessCategory.drinks,
          TransactionCategory.saleFood => BusinessCategory.food,
          _ => BusinessCategory.other,
        },
        monthsActive: score.monthsActive,
        // Rounded to 5 % to avoid fingerprinting.
        regularityPct: (score.regularityPct / 5).round() * 5,
        txCountBucket: TxCountBucket.of(score.txCount90d),
      );

  static int _monthsBetween(DateTime a, DateTime b) {
    final months = (b.year - a.year) * 12 + b.month - a.month;
    return b.day < a.day ? months - 1 : months;
  }
}
