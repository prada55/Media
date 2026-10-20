// lib/features/consent/data/repositories/consent_repository_impl.dart
//
// Consentements persistés dans la base chiffrée ; chaque changement est
// tracé dans audit_log (type d'événement seulement, jamais de PII).

import 'package:uuid/uuid.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/data/local/database.dart';
import 'package:yako/data/local/database_manager.dart';
import 'package:yako/features/consent/domain/entities/consent_state.dart';
import 'package:yako/features/consent/domain/repositories/consent_repository.dart';

/// Drift-backed [ConsentRepository].
class ConsentRepositoryImpl implements ConsentRepository {
  ConsentRepositoryImpl({
    required DatabaseManager databaseManager,
    DateTime Function()? now,
    this._uuid = const Uuid(),
  }) : _db = databaseManager,
       _now = now ?? DateTime.now;

  final DatabaseManager _db;
  final DateTime Function() _now;
  final Uuid _uuid;

  @override
  Future<Result<ConsentState>> getConsentState() => _run(_read);

  @override
  Future<Result<ConsentState>> setCreditScoreSharing({required bool value}) =>
      _set({ConsentKey.creditScoreSharing: value});

  @override
  Future<Result<ConsentState>> setPromotions({required bool value}) =>
      _set({ConsentKey.promotions: value});

  @override
  Future<Result<ConsentState>> setDiagnostics({required bool value}) =>
      _set({ConsentKey.diagnostics: value});

  @override
  Future<Result<ConsentState>> revokeAll() =>
      _set({for (final key in ConsentKey.values) key: false});

  @override
  Stream<ConsentState> watch() async* {
    final db = (await _db.open()).getOrNull();
    if (db == null) {
      yield const ConsentState();
      return;
    }
    yield* db.select(db.consent).watch().map(_fromRows);
  }

  Future<Result<ConsentState>> _set(Map<ConsentKey, bool> values) =>
      _run((db) async {
        final now = _now();
        await db.transaction(() async {
          for (final MapEntry(:key, :value) in values.entries) {
            await db
                .into(db.consent)
                .insertOnConflictUpdate(
                  ConsentRow(key: key.code, value: value, updatedAt: now),
                );
            await db
                .into(db.auditLog)
                .insert(
                  AuditLogCompanion.insert(
                    id: _uuid.v4(),
                    eventType:
                        'consent_${key.code}_${value ? 'granted' : 'revoked'}',
                    createdAt: now,
                  ),
                );
          }
        });
        return await _read(db);
      });

  Future<ConsentState> _read(AppDatabase db) async =>
      _fromRows(await db.select(db.consent).get());

  static ConsentState _fromRows(List<ConsentRow> rows) {
    bool value(ConsentKey key) =>
        rows.where((r) => r.key == key.code).firstOrNull?.value ?? false;
    return ConsentState(
      creditScoreSharing: value(ConsentKey.creditScoreSharing),
      promotions: value(ConsentKey.promotions),
      diagnostics: value(ConsentKey.diagnostics),
    );
  }

  Future<Result<T>> _run<T>(Future<T> Function(AppDatabase db) action) async {
    final opened = await _db.open();
    final db = opened.getOrNull();
    if (db == null) return FailureResult(opened.getFailureOrNull()!);
    try {
      return Success(await action(db));
    } on Object catch (e, st) {
      return FailureResult(
        DatabaseFailure(
          technicalMessage: 'Consent storage failed',
          cause: e,
          stackTrace: st,
        ),
      );
    }
  }
}
