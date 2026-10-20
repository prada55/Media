// test/features/auth/auto_lock_service_test.dart

import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yako/features/auth/domain/entities/auth_session.dart';
import 'package:yako/features/auth/domain/entities/user.dart';
import 'package:yako/features/auth/domain/services/auto_lock_service.dart';
import 'package:yako/features/auth/domain/services/session_manager.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';

class _FakeTimer implements Timer {
  _FakeTimer(this.duration, this.callback);

  final Duration duration;
  final void Function() callback;
  bool cancelled = false;

  void fire() {
    if (!cancelled) callback();
  }

  @override
  void cancel() => cancelled = true;

  @override
  bool get isActive => !cancelled;

  @override
  int get tick => 0;
}

final _session = AuthSession(
  user: User(
    id: 'u1',
    phoneHash: 'h',
    language: LanguageCode.fr,
    biometricEnabled: false,
    createdAt: DateTime(2026),
  ),
  dataKey: 'k',
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late SessionManager session;
  late AutoLockService service;
  late List<_FakeTimer> timers;
  late DateTime now;

  setUp(() {
    now = DateTime(2026, 10, 20, 9);
    timers = [];
    session = SessionManager(now: () => now);
    service = AutoLockService(
      session,
      now: () => now,
      timerFactory: (d, cb) {
        final t = _FakeTimer(d, cb);
        timers.add(t);
        return t;
      },
    )..start();
  });

  tearDown(() => service.dispose());

  Future<void> startSession() async {
    session.start(_session);
    await Future<void>.delayed(Duration.zero);
  }

  test('arms a 2 minute timer when the session starts', () async {
    await startSession();
    expect(timers.last.duration, const Duration(minutes: 2));
    expect(timers.last.isActive, isTrue);
  });

  test('inactivity timer locks the session and drops the key', () async {
    await startSession();
    timers.last.fire();
    expect(session.current.status, SessionStatus.locked);
    expect(session.dataKey, isNull);
    expect(session.current.lockedUser?.id, 'u1');
  });

  test('activity re-arms the timer', () async {
    await startSession();
    final first = timers.last;
    service.registerActivity();
    expect(first.cancelled, isTrue);
    expect(timers.last, isNot(same(first)));
    first.fire();
    expect(session.isActive, isTrue);
  });

  test('background > 30 s locks on resume', () async {
    await startSession();
    service.didChangeAppLifecycleState(AppLifecycleState.paused);
    now = now.add(const Duration(seconds: 31));
    service.didChangeAppLifecycleState(AppLifecycleState.resumed);
    expect(session.current.status, SessionStatus.locked);
  });

  test('background < 30 s keeps the session', () async {
    await startSession();
    service
      ..didChangeAppLifecycleState(AppLifecycleState.hidden)
      ..didChangeAppLifecycleState(AppLifecycleState.paused);
    now = now.add(const Duration(seconds: 20));
    service.didChangeAppLifecycleState(AppLifecycleState.resumed);
    expect(session.isActive, isTrue);
  });

  test('no timer when there is no session', () async {
    service.registerActivity();
    expect(timers, isEmpty);
  });

  test('clear forgets the user entirely', () async {
    await startSession();
    session.clear();
    await Future<void>.delayed(Duration.zero);
    expect(session.current.user, isNull);
    expect(timers.last.cancelled, isTrue);
  });
}
