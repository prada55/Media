// lib/app.dart
//
// Racine de l'application : thème, aiguillage d'authentification et
// détection d'activité pour le verrouillage automatique.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/constants/app_strings.dart';
import 'package:yako/core/presentation/l10n.dart';
import 'package:yako/core/theme/app_theme.dart';
import 'package:yako/features/auth/presentation/providers/auth_providers.dart';
import 'package:yako/features/auth/presentation/screens/auth_gate.dart';
import 'package:yako/features/translation/presentation/providers/translation_providers.dart';

/// Root widget.
class YakoApp extends ConsumerWidget {
  const YakoApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final autoLock = ref.watch(autoLockServiceProvider);
    final language = ref.watch(currentLanguageProvider);
    final strings = ref.watch(localizationServiceProvider);
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) => autoLock.registerActivity(),
      child: MaterialApp(
        title: AppStrings.appName,
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        builder: (context, child) => L10nScope(
          language: language,
          service: strings,
          child: child ?? const SizedBox.shrink(),
        ),
        home: const AuthGate(),
      ),
    );
  }
}
