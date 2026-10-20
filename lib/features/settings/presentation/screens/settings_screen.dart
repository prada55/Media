// lib/features/settings/presentation/screens/settings_screen.dart
//
// Réglages : Profil → Confidentialité & consentement → Données → À propos.

import 'package:flutter/material.dart';
import 'package:yako/core/presentation/l10n.dart';
import 'package:yako/features/settings/presentation/widgets/settings_about_section.dart';
import 'package:yako/features/settings/presentation/widgets/settings_data_section.dart';
import 'package:yako/features/settings/presentation/widgets/settings_privacy_section.dart';
import 'package:yako/features/settings/presentation/widgets/settings_profile_section.dart';

/// Settings screen.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Tr('settings.title')),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 32),
        children: const [
          SettingsProfileSection(),
          SettingsPrivacySection(),
          SettingsDataSection(),
          SettingsAboutSection(),
        ],
      ),
    );
  }
}
