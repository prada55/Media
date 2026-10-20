// lib/features/settings/presentation/screens/export_screen.dart
//
// Export chiffré : mot de passe + confirmation, puis partage.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/presentation/failure_snackbar.dart';
import 'package:yako/core/presentation/l10n.dart';
import 'package:yako/features/settings/data/services/export_service.dart';
import 'package:yako/features/settings/presentation/providers/settings_providers.dart';

/// Encrypted CSV export.
class ExportScreen extends ConsumerStatefulWidget {
  const ExportScreen({super.key});

  @override
  ConsumerState<ExportScreen> createState() => _ExportScreenState();
}

class _ExportScreenState extends ConsumerState<ExportScreen> {
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Tr('export.title')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const Tr('export.intro', style: TextStyle(fontSize: 16)),
          const SizedBox(height: 24),
          TextField(
            key: const ValueKey('export-password'),
            controller: _password,
            obscureText: true,
            decoration: InputDecoration(
              labelText: context.tr('export.password'),
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            key: const ValueKey('export-confirm'),
            controller: _confirm,
            obscureText: true,
            decoration: InputDecoration(
              labelText: context.tr('export.confirm'),
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 24),
          FilledButton.icon(
            key: const ValueKey('export-action'),
            onPressed: _busy ? null : _export,
            icon: _busy
                ? const SizedBox.square(
                    dimension: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.ios_share),
            label: const Tr('export.action'),
          ),
        ],
      ),
    );
  }

  Future<void> _export() async {
    final messenger = ScaffoldMessenger.of(context);
    if (_password.text != _confirm.text) {
      messenger.showSnackBar(
        SnackBar(content: Text(context.tr('export.mismatch'))),
      );
      return;
    }
    final invalid = ExportService.validatePassword(_password.text);
    if (invalid != null) {
      showFailure(context, invalid);
      return;
    }
    setState(() => _busy = true);
    final result = await ref
        .read(exportActionsProvider)
        .exportAndShare(_password.text);
    if (!mounted) return;
    setState(() => _busy = false);
    final failure = result.getFailureOrNull();
    if (failure != null) {
      showFailure(context, failure);
    } else {
      Navigator.of(context).pop();
    }
  }
}
