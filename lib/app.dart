// lib/app.dart
//
// Racine de l'application. En Phase 1, affiche uniquement l'écran de
// démarrage ; le routage d'authentification arrive en Phase 2.

import 'package:flutter/material.dart';
import 'package:yako/core/constants/app_strings.dart';
import 'package:yako/core/theme/app_theme.dart';

/// Root widget.
class YakoApp extends StatelessWidget {
  const YakoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppStrings.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      home: const Scaffold(
        body: Center(child: Text(AppStrings.appName)),
      ),
    );
  }
}
