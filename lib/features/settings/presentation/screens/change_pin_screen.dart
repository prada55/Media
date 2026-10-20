// lib/features/settings/presentation/screens/change_pin_screen.dart
//
// Changement de code : actuel → nouveau → confirmation.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/presentation/failure_snackbar.dart';
import 'package:yako/core/presentation/l10n.dart';
import 'package:yako/features/auth/presentation/providers/auth_providers.dart';
import 'package:yako/features/auth/presentation/widgets/pin_entry.dart';

/// PIN change flow.
class ChangePinScreen extends ConsumerStatefulWidget {
  const ChangePinScreen({super.key});

  @override
  ConsumerState<ChangePinScreen> createState() => _ChangePinScreenState();
}

class _ChangePinScreenState extends ConsumerState<ChangePinScreen> {
  String? _current;
  String? _next;
  bool _busy = false;

  String get _stepKey => _current == null
      ? 'change_pin.current'
      : _next == null
      ? 'change_pin.new'
      : 'change_pin.confirm';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Tr('settings.change_pin')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              Tr(_stepKey, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 24),
              if (_busy)
                const CircularProgressIndicator()
              else
                PinEntry(key: ValueKey(_stepKey), onCompleted: _onPin),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _onPin(String pin) async {
    if (_current == null) return setState(() => _current = pin);
    if (_next == null) return setState(() => _next = pin);
    if (pin != _next) {
      setState(() => _next = null);
      return;
    }
    setState(() => _busy = true);
    final result = await ref
        .read(authStateProvider.notifier)
        .changePin(currentPin: _current!, newPin: pin);
    if (!mounted) return;
    final failure = result.getFailureOrNull();
    if (failure != null) {
      setState(() {
        _busy = false;
        _current = null;
        _next = null;
      });
      showFailure(context, failure);
      return;
    }
    final done = context.tr('change_pin.done');
    final messenger = ScaffoldMessenger.of(context);
    Navigator.of(context).pop();
    messenger.showSnackBar(SnackBar(content: Text(done)));
  }
}
