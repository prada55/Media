// lib/features/auth/domain/services/lockout_policy.dart
//
// Verrouillage progressif : à partir du 5e échec consécutif, blocage de
// 30 s, puis 1 min, 5 min, 15 min et 30 min (plafond).

/// Progressive lockout schedule.
abstract final class LockoutPolicy {
  static const int maxFreeAttempts = 5;

  static const List<Duration> steps = [
    Duration(seconds: 30),
    Duration(minutes: 1),
    Duration(minutes: 5),
    Duration(minutes: 15),
    Duration(minutes: 30),
  ];

  /// Lock duration after [failedAttempts] consecutive failures.
  static Duration? lockDurationFor(int failedAttempts) {
    if (failedAttempts < maxFreeAttempts) return null;
    final index = failedAttempts - maxFreeAttempts;
    return steps[index < steps.length ? index : steps.length - 1];
  }

  /// Attempts left before the first lock.
  static int remainingBeforeLock(int failedAttempts) {
    final left = maxFreeAttempts - failedAttempts;
    return left < 0 ? 0 : left;
  }
}
