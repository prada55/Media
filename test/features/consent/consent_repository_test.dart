// test/features/consent/consent_repository_test.dart

import 'package:flutter_test/flutter_test.dart';
import 'package:yako/features/consent/data/repositories/consent_repository_impl.dart';
import 'package:yako/features/consent/domain/entities/consent_state.dart';

import '../../helpers/auth_harness.dart';

void main() {
  late AuthHarness h;
  late ConsentRepositoryImpl repo;

  setUp(() async {
    h = await AuthHarness.create();
    repo = ConsentRepositoryImpl(databaseManager: h.databaseManager);
  });
  tearDown(() => h.dispose());

  test('everything is OFF by default', () async {
    final state = (await repo.getConsentState()).getOrNull()!;
    expect(state, const ConsentState());
    expect(state.anyGranted, isFalse);
  });

  test('the three consents are independent', () async {
    await repo.setPromotions(value: true);
    var state = (await repo.getConsentState()).getOrNull()!;
    expect(state.promotions, isTrue);
    expect(state.creditScoreSharing, isFalse);
    expect(state.diagnostics, isFalse);

    await repo.setCreditScoreSharing(value: true);
    await repo.setDiagnostics(value: true);
    await repo.setPromotions(value: false);
    state = (await repo.getConsentState()).getOrNull()!;
    expect(state.creditScoreSharing, isTrue);
    expect(state.diagnostics, isTrue);
    expect(state.promotions, isFalse);
  });

  test('revokeAll turns everything off in one call', () async {
    await repo.setCreditScoreSharing(value: true);
    await repo.setPromotions(value: true);
    final state = (await repo.revokeAll()).getOrNull()!;
    expect(state.anyGranted, isFalse);
  });

  test('changes are audited without personal data', () async {
    await repo.setCreditScoreSharing(value: true);
    await repo.revokeAll();
    final db = (await h.databaseManager.open()).getOrNull()!;
    final events = (await db.select(db.auditLog).get())
        .map((e) => e.eventType)
        .toList();
    expect(events, contains('consent_credit_score_sharing_granted'));
    expect(events, contains('consent_credit_score_sharing_revoked'));
    expect(events, contains('consent_promotions_revoked'));
  });

  test('watch emits updates', () async {
    final states = <ConsentState>[];
    final sub = repo.watch().listen(states.add);
    await Future<void>.delayed(const Duration(milliseconds: 50));
    await repo.setDiagnostics(value: true);
    await Future<void>.delayed(const Duration(milliseconds: 50));
    await sub.cancel();
    expect(states.first.diagnostics, isFalse);
    expect(states.last.diagnostics, isTrue);
  });
}
