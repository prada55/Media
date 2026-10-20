// lib/features/transactions/data/repositories/transaction_repository_impl.dart
//
// Chiffrement applicatif AVANT insertion : montant, transcription FR et
// transcription locale sont scellés AES-256-GCM avec la clé de données de
// la session. Totaux et recherche se font en mémoire après déchiffrement,
// JAMAIS en SQL sur des colonnes chiffrées. Seuls `type` et `created_at`
// restent exploitables en SQL (filtres, tri), la base entière étant de
// toute façon chiffrée par SQLCipher.

import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/core/security/encryption_service.dart';
import 'package:yako/data/local/database.dart';
import 'package:yako/data/local/database_manager.dart';
import 'package:yako/features/transactions/data/services/audio_storage_service_impl.dart';
import 'package:yako/features/transactions/domain/entities/transaction.dart';
import 'package:yako/features/transactions/domain/entities/transaction_draft.dart';
import 'package:yako/features/transactions/domain/repositories/transaction_repository.dart';
import 'package:yako/features/transactions/domain/services/audio_storage_service.dart';
import 'package:yako/features/transactions/domain/value_objects/transaction_filter.dart';
import 'package:yako/features/transactions/domain/value_objects/transaction_totals.dart';

/// Default [TransactionRepository].
class TransactionRepositoryImpl implements TransactionRepository {
  TransactionRepositoryImpl({
    required DatabaseManager databaseManager,
    required this._encryption,
    required this._audioStorage,
    required this._dataKey,
    DateTime Function()? now,
    this._uuid = const Uuid(),
  }) : _db = databaseManager,
       _now = now ?? DateTime.now;

  /// Rows decrypted per batch when scanning (search, totals).
  static const int scanPageSize = 500;

  final DatabaseManager _db;
  final EncryptionService _encryption;
  final AudioStorageService _audioStorage;
  final DataKeyReader _dataKey;
  final DateTime Function() _now;
  final Uuid _uuid;

  @override
  Future<Result<Transaction>> create(TransactionDraft draft) =>
      _run((db, key) async {
        final validation = _validate(draft.amount);
        if (validation != null) return FailureResult(validation);
        final now = _now();
        final transaction = Transaction(
          id: _uuid.v4(),
          type: draft.type,
          amount: draft.amount,
          category: draft.category,
          transcriptFr: draft.transcriptFr,
          transcriptLocal: draft.transcriptLocal,
          audioPath: draft.audioPath,
          createdAt: now,
          updatedAt: now,
        );
        await db.into(db.transactions).insert(await _seal(transaction, key));
        return Success(transaction);
      });

  @override
  Future<Result<List<Transaction>>> getAll({
    TransactionFilter filter = const TransactionFilter(),
    int limit = 50,
    int offset = 0,
  }) => _run((db, key) async {
    final rows = await (_filtered(
      db,
      filter,
    )..limit(limit, offset: offset)).get();
    return Success(await _openAll(rows, key));
  });

  @override
  Future<Result<Transaction?>> getById(String id) => _run((db, key) async {
    final row = await (db.select(
      db.transactions,
    )..where((t) => t.id.equals(id))).getSingleOrNull();
    return Success(row == null ? null : await _open(row, key));
  });

  @override
  Future<Result<Transaction>> update(Transaction transaction) =>
      _run((db, key) async {
        final validation = _validate(transaction.amount);
        if (validation != null) return FailureResult(validation);
        final updated = transaction.copyWith(updatedAt: _now());
        final count =
            await (db.update(db.transactions)
                  ..where((t) => t.id.equals(transaction.id)))
                .write(await _seal(updated, key));
        if (count == 0) return FailureResult(_notFound());
        return Success(updated);
      });

  @override
  Future<Result<void>> delete(String id) => _run((db, key) async {
    final row = await (db.select(
      db.transactions,
    )..where((t) => t.id.equals(id))).getSingleOrNull();
    if (row == null) return FailureResult(_notFound());
    await (db.delete(db.transactions)..where((t) => t.id.equals(id))).go();
    final audio = row.audioPath;
    if (audio != null) await _audioStorage.delete(audio);
    return const Success(null);
  });

  @override
  Future<Result<TransactionTotals>> computeTotals(TransactionFilter filter) =>
      _run((db, key) async {
        final all = <Transaction>[];
        await _scan(db, filter, key, (page) {
          all.addAll(page);
          return true;
        });
        return Success(TransactionTotals.of(all));
      });

  @override
  Stream<Result<List<Transaction>>> watchRecent({int limit = 50}) async* {
    final opened = await _db.open();
    final db = opened.getOrNull();
    if (db == null) {
      yield FailureResult(opened.getFailureOrNull()!);
      return;
    }
    final query = _filtered(db, const TransactionFilter())..limit(limit);
    yield* query.watch().asyncMap((rows) async {
      final key = _dataKey();
      if (key == null) return FailureResult(_locked());
      try {
        return Success(await _openAll(rows, key));
      } on Object catch (e, st) {
        return FailureResult(_decryptFailure(e, st));
      }
    });
  }

  @override
  Future<Result<List<Transaction>>> search(
    String query, {
    TransactionFilter filter = const TransactionFilter(),
    int limit = 50,
  }) => _run((db, key) async {
    final needle = _normalize(query);
    if (needle.isEmpty) {
      final rows = await (_filtered(db, filter)..limit(limit)).get();
      return Success(await _openAll(rows, key));
    }
    final found = <Transaction>[];
    await _scan(db, filter, key, (page) {
      for (final t in page) {
        if (_matches(t, needle)) found.add(t);
        if (found.length >= limit) return false;
      }
      return true;
    });
    return Success(found);
  });

  // ---------------------------------------------------------------------

  Future<Result<T>> _run<T>(
    Future<Result<T>> Function(AppDatabase db, String key) action,
  ) async {
    final key = _dataKey();
    if (key == null) return FailureResult(_locked());
    final opened = await _db.open();
    final db = opened.getOrNull();
    if (db == null) return FailureResult(opened.getFailureOrNull()!);
    try {
      return await action(db, key);
    } on _SealFailure catch (e) {
      return FailureResult(e.failure);
    } on Object catch (e, st) {
      return FailureResult(
        DatabaseFailure(
          technicalMessage: 'Transaction storage failed',
          cause: e,
          stackTrace: st,
        ),
      );
    }
  }

  SimpleSelectStatement<$TransactionsTable, TransactionRow> _filtered(
    AppDatabase db,
    TransactionFilter filter,
  ) {
    final from = filter.period.startFrom(_now());
    final type = filter.type;
    final query = db.select(db.transactions)
      ..orderBy([
        (t) => OrderingTerm(expression: t.createdAt, mode: OrderingMode.desc),
      ]);
    if (from != null) {
      query.where((t) => t.createdAt.isBiggerOrEqualValue(from));
    }
    if (type != null) query.where((t) => t.type.equals(type.code));
    return query;
  }

  /// Decrypts [filter] matches page by page; [onPage] returns `false` to stop.
  Future<void> _scan(
    AppDatabase db,
    TransactionFilter filter,
    String key,
    bool Function(List<Transaction> page) onPage,
  ) async {
    var offset = 0;
    while (true) {
      final rows = await (_filtered(
        db,
        filter,
      )..limit(scanPageSize, offset: offset)).get();
      if (rows.isEmpty) return;
      if (!onPage(await _openAll(rows, key))) return;
      if (rows.length < scanPageSize) return;
      offset += scanPageSize;
    }
  }

  Future<TransactionsCompanion> _seal(Transaction t, String key) async {
    final local = t.transcriptLocal;
    return TransactionsCompanion(
      id: Value(t.id),
      type: Value(t.type.code),
      amount: Value(await _encrypt(t.amount.toString(), key)),
      category: Value(t.category.code),
      transcriptFr: Value(await _encrypt(t.transcriptFr, key)),
      transcriptLocal: Value(local == null ? null : await _encrypt(local, key)),
      audioPath: Value(t.audioPath),
      createdAt: Value(t.createdAt),
      updatedAt: Value(t.updatedAt),
    );
  }

  Future<List<Transaction>> _openAll(List<TransactionRow> rows, String key) =>
      Future.wait(rows.map((r) => _open(r, key)));

  Future<Transaction> _open(TransactionRow row, String key) async {
    final local = row.transcriptLocal;
    return Transaction(
      id: row.id,
      type: TransactionType.fromCode(row.type),
      amount: int.parse(await _decrypt(row.amount, key)),
      category: TransactionCategory.fromCode(row.category),
      transcriptFr: await _decrypt(row.transcriptFr, key),
      transcriptLocal: local == null ? null : await _decrypt(local, key),
      audioPath: row.audioPath,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    );
  }

  Future<String> _encrypt(String value, String key) async =>
      switch (await _encryption.encryptAesGcm(value, key)) {
        Success(:final value) => value,
        FailureResult(:final failure) => throw _SealFailure(failure),
      };

  Future<String> _decrypt(String value, String key) async =>
      switch (await _encryption.decryptAesGcm(value, key)) {
        Success(:final value) => value,
        FailureResult(:final failure) => throw _SealFailure(failure),
      };

  static String _normalize(String s) => s.trim().toLowerCase();

  static bool _matches(Transaction t, String needle) {
    final digits = needle.replaceAll(RegExp(r'\s'), '');
    return _normalize(t.transcriptFr).contains(needle) ||
        _normalize(t.transcriptLocal ?? '').contains(needle) ||
        _normalize(t.category.labelFr).contains(needle) ||
        (digits.isNotEmpty && t.amount.toString().contains(digits));
  }

  static Failure? _validate(int amount) => amount <= 0 || amount > 1000000000
      ? const ValidationFailure(
          technicalMessage: 'Amount out of range',
          userMessageFr: 'Le montant doit être supérieur à 0.',
        )
      : null;

  static Failure _locked() => const EncryptionFailure(
    technicalMessage: 'Session locked: no data key',
    userMessageFr: 'Yako est verrouillé. Tapez votre code.',
  );

  static Failure _notFound() => const DatabaseFailure(
    technicalMessage: 'Transaction not found',
    userMessageFr: 'Cette opération n’existe plus.',
  );

  static Failure _decryptFailure(Object e, StackTrace st) => EncryptionFailure(
    technicalMessage: 'Transaction decryption failed',
    cause: e,
    stackTrace: st,
  );
}

final class _SealFailure implements Exception {
  const _SealFailure(this.failure);

  final Failure failure;
}
