// lib/features/transactions/domain/value_objects/transaction_filter.dart
//
// Filtre du journal : période + type.

import 'package:flutter/foundation.dart' show immutable;
import 'package:yako/features/transactions/domain/entities/transaction.dart';

/// Période de filtrage.
enum TransactionPeriod {
  today('Aujourd’hui'),
  week('7 jours'),
  month('30 jours'),
  all('Tout');

  TransactionPeriod(this.labelFr);

  final String labelFr;

  /// Inclusive lower bound for [now], `null` for [all].
  DateTime? startFrom(DateTime now) => switch (this) {
    today => DateTime(now.year, now.month, now.day),
    week => now.subtract(const Duration(days: 7)),
    month => now.subtract(const Duration(days: 30)),
    all => null,
  };
}

/// Journal filter.
@immutable
final class TransactionFilter {
  const TransactionFilter({this.period = TransactionPeriod.all, this.type});

  final TransactionPeriod period;

  /// `null` = ventes et dépenses.
  final TransactionType? type;

  TransactionFilter copyWith({
    TransactionPeriod? period,
    TransactionType? Function()? type,
  }) => TransactionFilter(
    period: period ?? this.period,
    type: type == null ? this.type : type(),
  );

  @override
  bool operator ==(Object other) =>
      other is TransactionFilter &&
      other.period == period &&
      other.type == type;

  @override
  int get hashCode => Object.hash(period, type);
}
