// lib/features/transactions/presentation/screens/home_menu.dart
//
// Menu de l'accueil (déconnexion, suppression du compte). Les réglages
// complets arrivent en Phase 5.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/presentation/l10n.dart';
import 'package:yako/features/auth/presentation/providers/auth_providers.dart';
import 'package:yako/features/auth/presentation/screens/delete_account_screen.dart';

/// Overflow menu of the home screen.
class HomeMenu extends ConsumerWidget {
  const HomeMenu({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return PopupMenuButton<String>(
      key: const ValueKey('home-menu'),
      onSelected: (value) {
        switch (value) {
          case 'logout':
            unawaited(ref.read(authStateProvider.notifier).logout());
          case 'delete':
            Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const DeleteAccountScreen(),
              ),
            );
        }
      },
      itemBuilder: (_) => const [
        PopupMenuItem(value: 'logout', child: Tr('menu.logout')),
        PopupMenuItem(value: 'delete', child: Tr('delete.title')),
      ],
    );
  }
}
