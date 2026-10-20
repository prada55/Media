// lib/features/auth/domain/services/session_manager.dart
//
// État de session en mémoire : utilisateur, clé de données, heure de
// connexion et dernière activité. Verrouiller efface la clé de données ;
// rien de tout cela n'est persisté.

import 'dart:async';

import 'package:yako/features/auth/domain/entities/auth_session.dart';
import 'package:yako/features/auth/domain/entities/user.dart';

/// Session lifecycle.
enum SessionStatus { none, active, locked }

/// Immutable snapshot of the session.
final class SessionSnapshot {
  const SessionSnapshot._({
    required this.status,
    this.session,
    this.lockedUser,
    this.loginAt,
  });

  const SessionSnapshot.none() : this._(status: SessionStatus.none);

  final SessionStatus status;

  /// Present only while [status] is active.
  final AuthSession? session;

  /// User shown on the lock screen while [status] is locked.
  final User? lockedUser;

  final DateTime? loginAt;

  User? get user => session?.user ?? lockedUser;
}

/// Holds the unlocked session in memory.
class SessionManager {
  SessionManager({DateTime Function()? now}) : _now = now ?? DateTime.now;

  final DateTime Function() _now;
  final StreamController<SessionSnapshot> _controller =
      StreamController<SessionSnapshot>.broadcast();
  SessionSnapshot _snapshot = const SessionSnapshot.none();
  DateTime? _lastActivity;

  SessionSnapshot get current => _snapshot;

  /// Data key of the active session, `null` when locked or logged out.
  String? get dataKey => _snapshot.session?.dataKey;

  bool get isActive => _snapshot.status == SessionStatus.active;

  DateTime? get lastActivity => _lastActivity;

  /// Emits the current snapshot, then every change. Subscribes to changes
  /// synchronously on listen so no event can be missed.
  Stream<SessionSnapshot> watch() {
    StreamSubscription<SessionSnapshot>? changes;
    late final StreamController<SessionSnapshot> out;
    out = StreamController<SessionSnapshot>(
      onListen: () {
        out.add(_snapshot);
        changes = _controller.stream.listen(out.add);
      },
      onCancel: () => changes?.cancel(),
    );
    return out.stream;
  }

  void start(AuthSession session) {
    final now = _now();
    _lastActivity = now;
    _emit(
      SessionSnapshot._(
        status: SessionStatus.active,
        session: session,
        loginAt: now,
      ),
    );
  }

  /// Replaces the user (language / biometrics changes) keeping the key.
  void updateUser(User user) {
    final session = _snapshot.session;
    if (session == null) return;
    _emit(
      SessionSnapshot._(
        status: SessionStatus.active,
        session: session.copyWith(user: user),
        loginAt: _snapshot.loginAt,
      ),
    );
  }

  /// Records user activity (resets the inactivity timer).
  void touch() {
    if (isActive) _lastActivity = _now();
  }

  /// Auto-lock: drops the data key, keeps the user for the lock screen.
  void lock() {
    if (!isActive) return;
    _emit(
      SessionSnapshot._(
        status: SessionStatus.locked,
        lockedUser: _snapshot.session?.user,
      ),
    );
  }

  /// Logout / account deletion: forgets everything.
  void clear() {
    _lastActivity = null;
    _emit(const SessionSnapshot.none());
  }

  void _emit(SessionSnapshot snapshot) {
    _snapshot = snapshot;
    _controller.add(snapshot);
  }

  Future<void> dispose() => _controller.close();
}
