// lib/features/auth/presentation/screens/login_screen.dart
//
// Connexion : numéro + code PIN, lien biométrie si activée, compte à
// rebours de verrouillage.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/presentation/failure_snackbar.dart';
import 'package:yako/core/presentation/l10n.dart';
import 'package:yako/features/auth/presentation/providers/auth_providers.dart';
import 'package:yako/features/auth/presentation/screens/biometric_prompt_screen.dart';
import 'package:yako/features/auth/presentation/widgets/lockout_banner.dart';
import 'package:yako/features/auth/presentation/widgets/pin_entry.dart';

/// Phone + PIN login.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final TextEditingController _phone = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final locked = ref.watch(lockoutRemainingProvider).value != null;
    final user = ref.watch(registeredUserProvider).value;
    return Scaffold(
      appBar: AppBar(title: const Tr('login.title')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const LockoutBanner(),
              const SizedBox(height: 16),
              TextField(
                key: const ValueKey('login-phone'),
                controller: _phone,
                keyboardType: TextInputType.phone,
                style: const TextStyle(fontSize: 22),
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(10),
                ],
                decoration: const InputDecoration(
                  prefixText: '+225 ',
                  labelText: 'Numéro',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'Code secret',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 16),
              if (_busy)
                const Padding(
                  padding: EdgeInsets.all(48),
                  child: CircularProgressIndicator(),
                )
              else
                PinEntry(enabled: !locked, onCompleted: _login),
              if (user?.biometricEnabled ?? false)
                TextButton.icon(
                  key: const ValueKey('login-biometric'),
                  onPressed: _busy ? null : _loginWithBiometrics,
                  icon: const Icon(Icons.fingerprint, size: 32),
                  label: const Tr('auth.use_biometrics'),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _login(String pin) async {
    setState(() => _busy = true);
    final result = await ref
        .read(authStateProvider.notifier)
        .login(phone: _phone.text, pin: pin);
    _afterAttempt(result.getFailureOrNull());
  }

  Future<void> _loginWithBiometrics() async {
    setState(() => _busy = true);
    final result = await ref
        .read(authStateProvider.notifier)
        .loginWithBiometrics(reason: BiometricPromptScreen.reason);
    _afterAttempt(result.getFailureOrNull());
  }

  void _afterAttempt(Failure? failure) {
    if (!mounted) return;
    setState(() => _busy = false);
    ref.invalidate(lockoutRemainingProvider);
    if (failure != null) showFailure(context, failure);
  }
}
