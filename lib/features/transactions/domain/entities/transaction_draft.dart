// lib/features/transactions/domain/entities/transaction_draft.dart
//
// Saisie utilisateur avant création (pas encore d'identifiant).

import 'package:yako/features/transactions/domain/entities/transaction.dart';

/// Values entered in the record form.
final class TransactionDraft {
  const TransactionDraft({
    required this.type,
    required this.amount,
    required this.category,
    this.transcriptFr = '',
    this.transcriptLocal,
    this.audioPath,
  });

  final TransactionType type;
  final int amount;
  final TransactionCategory category;
  final String transcriptFr;
  final String? transcriptLocal;

  /// Chemin relatif d'un audio déjà chiffré par AudioStorageService.
  final String? audioPath;
}
