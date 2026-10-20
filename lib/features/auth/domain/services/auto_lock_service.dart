// lib/features/auth/domain/services/auto_lock_service.dart
//
// Verrouillage automatique :
// - 2 minutes sans interaction ;
// - retour au premier plan après plus de 30 s en arrière-plan.
// Les captures d'écran sont bloquées nativement (FLAG_SECURE Android,
// voile flouté iOS) : voir MainActivity.kt et SceneDelegate.swift.

import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:yako/features/auth/domain/services/session_manager.dart';

/// Creates a one-shot timer (injectable for tests).
typedef TimerFactory = Timer Function(Duration duration, void Function() cb);

/// Locks the session on inactivity or long backgrounding.
class AutoLockService with WidgetsBindingObserver {
  AutoLockService(
    this._session, {
    this.inactivityTimeout = const Duration(minutes: 2),
    this.backgroundTimeout = const Duration(seconds: 30),
    DateTime Function()? now,
    TimerFactory? timerFactory,
  }) : _now = now ?? DateTime.now,
       _timerFactory = timerFactory ?? Timer.new;

  final SessionManager _session;
  final Duration inactivityTimeout;
  final Duration backgroundTimeout;
  final DateTime Function() _now;
  final TimerFactory _timerFactory;

  Timer? _timer;
  DateTime? _backgroundedAt;
  StreamSubscription<SessionSnapshot>? _subscription;
  WidgetsBinding? _binding;

  /// Starts observing the app lifecycle and the session.
  void start([WidgetsBinding? binding]) {
    _binding = binding ?? WidgetsBinding.instance;
    _binding!.addObserver(this);
    _subscription = _session.watch().listen((snapshot) {
      if (snapshot.status == SessionStatus.active) {
        _restartTimer();
      } else {
        _cancelTimer();
      }
    });
  }

  /// Call on every user interaction.
  void registerActivity() {
    if (!_session.isActive) return;
    _session.touch();
    _restartTimer();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.paused:
      case AppLifecycleState.hidden:
        _backgroundedAt ??= _now();
      case AppLifecycleState.resumed:
        final since = _backgroundedAt;
        _backgroundedAt = null;
        if (since != null && _now().difference(since) > backgroundTimeout) {
          _lock();
        } else if (_session.isActive) {
          _restartTimer();
        }
      case AppLifecycleState.inactive:
      case AppLifecycleState.detached:
        break;
    }
  }

  void _restartTimer() {
    _cancelTimer();
    if (_session.isActive) _timer = _timerFactory(inactivityTimeout, _lock);
  }

  void _cancelTimer() {
    _timer?.cancel();
    _timer = null;
  }

  void _lock() {
    _cancelTimer();
    _session.lock();
  }

  Future<void> dispose() async {
    _cancelTimer();
    _binding?.removeObserver(this);
    await _subscription?.cancel();
  }
}
