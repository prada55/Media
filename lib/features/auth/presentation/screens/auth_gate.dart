// lib/features/auth/presentation/screens/auth_gate.dart
//
// Aiguillage racine selon l'état d'authentification.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/features/auth/domain/entities/auth_state.dart';
import 'package:yako/features/auth/presentation/providers/auth_providers.dart';
import 'package:yako/features/auth/presentation/screens/biometric_prompt_screen.dart';
import 'package:yako/features/auth/presentation/screens/lock_screen.dart';
import 'package:yako/features/auth/presentation/screens/login_screen.dart';
import 'package:yako/features/auth/presentation/screens/onboarding_screen.dart';
import 'package:yako/features/transactions/presentation/screens/home_screen.dart';

/// Root screen switcher.
class AuthGate extends ConsumerWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return switch (ref.watch(authStateProvider)) {
      AuthLoading() => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      ),
      AuthUnauthenticated(hasAccount: false) => const OnboardingScreen(),
      AuthUnauthenticated() => const LoginScreen(),
      AuthBiometricRequired(:final user) => LockScreen(
        user: user,
        autoBiometric: true,
      ),
      AuthLocked(:final user) => LockScreen(user: user),
      AuthAuthenticated(offerBiometrics: true) => const BiometricPromptScreen(),
      AuthAuthenticated() => const HomeScreen(),
    };
  }
}
