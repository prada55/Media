// lib/features/auth/presentation/screens/lock_screen.dart
//
// Écran de verrouillage (après auto-verrouillage ou au démarrage si la
// biométrie est active) : code PIN seul, ou biométrie.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/presentation/failure_snackbar.dart';
import 'package:yako/features/auth/domain/entities/user.dart';
import 'package:yako/features/auth/presentation/providers/auth_providers.dart';
import 'package:yako/features/auth/presentation/screens/biometric_prompt_screen.dart';
import 'package:yako/features/auth/presentation/widgets/lockout_banner.dart';
import 'package:yako/features/auth/presentation/widgets/pin_entry.dart';

/// Unlock screen.
class LockScreen extends ConsumerStatefulWidget {
  const LockScreen({required this.user, this.autoBiometric = false, super.key});

  final User user;

  /// Opens the biometric prompt as soon as the screen appears.
  final bool autoBiometric;

  @override
  ConsumerState<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends ConsumerState<LockScreen> {
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    if (widget.autoBiometric && widget.user.biometricEnabled) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _biometric());
    }
  }

  @override
  Widget build(BuildContext context) {
    final locked = ref.watch(lockoutRemainingProvider).value != null;
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                const LockoutBanner(),
                Icon(Icons.lock, size: 72, color: theme.colorScheme.primary),
                const SizedBox(height: 12),
                Text(
                  'Yako est verrouillé',
                  style: theme.textTheme.headlineMedium,
                ),
                const SizedBox(height: 8),
                const Text('Tapez votre code secret'),
                const SizedBox(height: 24),
                if (_busy)
                  const Padding(
                    padding: EdgeInsets.all(48),
                    child: CircularProgressIndicator(),
                  )
                else
                  PinEntry(enabled: !locked, onCompleted: _unlock),
                if (widget.user.biometricEnabled)
                  TextButton.icon(
                    key: const ValueKey('lock-biometric'),
                    onPressed: _busy ? null : _biometric,
                    icon: const Icon(Icons.fingerprint, size: 32),
                    label: const Text('Utiliser mon empreinte'),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _unlock(String pin) async {
    setState(() => _busy = true);
    final result = await ref
        .read(authStateProvider.notifier)
        .unlockWithPin(pin);
    _after(result.getFailureOrNull());
  }

  Future<void> _biometric() async {
    setState(() => _busy = true);
    final result = await ref
        .read(authStateProvider.notifier)
        .loginWithBiometrics(reason: BiometricPromptScreen.reason);
    _after(result.getFailureOrNull());
  }

  void _after(Failure? failure) {
    if (!mounted) return;
    setState(() => _busy = false);
    ref.invalidate(lockoutRemainingProvider);
    if (failure != null) showFailure(context, failure);
  }
}
