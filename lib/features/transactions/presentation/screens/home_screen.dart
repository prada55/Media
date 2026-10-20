// lib/features/transactions/presentation/screens/home_screen.dart
//
// Accueil (Phase 2 : coquille avec menu de session). Le fil des
// transactions arrive en Phase 3.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/constants/app_strings.dart';
import 'package:yako/features/auth/presentation/providers/auth_providers.dart';
import 'package:yako/features/auth/presentation/screens/delete_account_screen.dart';

/// Home screen.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.read(authStateProvider.notifier);
    return Scaffold(
      appBar: AppBar(
        title: const Text(AppStrings.appName),
        actions: [
          IconButton(
            key: const ValueKey('home-lock'),
            tooltip: 'Verrouiller',
            icon: const Icon(Icons.lock_outline),
            onPressed: controller.lock,
          ),
          PopupMenuButton<String>(
            key: const ValueKey('home-menu'),
            onSelected: (value) {
              if (value == 'logout') unawaited(controller.logout());
              if (value == 'delete') {
                Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const DeleteAccountScreen(),
                  ),
                );
              }
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'logout', child: Text('Se déconnecter')),
              PopupMenuItem(
                value: 'delete',
                child: Text('Supprimer mon compte'),
              ),
            ],
          ),
        ],
      ),
      body: const Center(child: Text('Aucune transaction pour le moment.')),
    );
  }
}
