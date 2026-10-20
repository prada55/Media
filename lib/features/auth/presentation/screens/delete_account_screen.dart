// lib/features/auth/presentation/screens/delete_account_screen.dart
//
// Suppression définitive du compte : explication, code PIN, puis double
// confirmation. Efface la base, les clés et la biométrie.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/presentation/failure_snackbar.dart';
import 'package:yako/features/auth/presentation/providers/auth_providers.dart';
import 'package:yako/features/auth/presentation/widgets/pin_entry.dart';

/// Irreversible account deletion.
class DeleteAccountScreen extends ConsumerStatefulWidget {
  const DeleteAccountScreen({super.key});

  @override
  ConsumerState<DeleteAccountScreen> createState() =>
      _DeleteAccountScreenState();
}

class _DeleteAccountScreenState extends ConsumerState<DeleteAccountScreen> {
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Supprimer mon compte')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              Icon(Icons.warning_amber, size: 72, color: scheme.error),
              const SizedBox(height: 12),
              const Text(
                'Toutes vos ventes, dépenses et enregistrements seront '
                'effacés de ce téléphone. Personne ne pourra les récupérer, '
                'pas même Yako.',
                style: TextStyle(fontSize: 18),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              const Text('Tapez votre code secret pour continuer'),
              const SizedBox(height: 16),
              if (_busy)
                const CircularProgressIndicator()
              else
                PinEntry(onCompleted: _onPin),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _onPin(String pin) async {
    final first = await _confirm(
      'Effacer toutes vos données ?',
      'Cette action est définitive.',
      'Continuer',
    );
    if (!first || !mounted) return;
    final second = await _confirm(
      'Dernière confirmation',
      'Supprimer définitivement votre compte Yako ?',
      'Supprimer',
    );
    if (!second || !mounted) return;
    setState(() => _busy = true);
    final result = await ref
        .read(authStateProvider.notifier)
        .deleteAccount(pin: pin);
    if (!mounted) return;
    final failure = result.getFailureOrNull();
    if (failure != null) {
      setState(() => _busy = false);
      showFailure(context, failure);
      return;
    }
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  Future<bool> _confirm(String title, String body, String action) async {
    final answer = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            key: ValueKey('confirm-$action'),
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(action),
          ),
        ],
      ),
    );
    return answer ?? false;
  }
}
