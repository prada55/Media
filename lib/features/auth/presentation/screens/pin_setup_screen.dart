// lib/features/auth/presentation/screens/pin_setup_screen.dart
//
// Création du code PIN : saisie puis confirmation. Les codes triviaux ou
// tirés du numéro sont refusés avant la confirmation.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/presentation/failure_snackbar.dart';
import 'package:yako/core/utils/pin_validator.dart';
import 'package:yako/features/auth/presentation/providers/auth_providers.dart';
import 'package:yako/features/auth/presentation/providers/registration_providers.dart';
import 'package:yako/features/auth/presentation/widgets/pin_entry.dart';

/// PIN creation step of the registration.
class PinSetupScreen extends ConsumerStatefulWidget {
  const PinSetupScreen({super.key});

  @override
  ConsumerState<PinSetupScreen> createState() => _PinSetupScreenState();
}

class _PinSetupScreenState extends ConsumerState<PinSetupScreen> {
  String? _firstPin;
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final confirming = _firstPin != null;
    return Scaffold(
      appBar: AppBar(title: const Text('Code secret')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                Text(
                  confirming
                      ? 'Tapez encore le même code'
                      : 'Choisissez un code de 6 chiffres',
                  key: const ValueKey('pin-setup-title'),
                  style: Theme.of(context).textTheme.titleLarge,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),
                if (_busy)
                  const Padding(
                    padding: EdgeInsets.all(48),
                    child: CircularProgressIndicator(),
                  )
                else
                  PinEntry(
                    key: ValueKey(confirming),
                    onCompleted: confirming ? _onConfirm : _onFirst,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _onFirst(String pin) {
    final phone = ref.read(registrationDraftProvider).phone;
    final result = PinValidator.validate(pin, nationalPhone: phone);
    final failure = result.getFailureOrNull();
    if (failure != null) {
      showFailure(context, failure);
      return;
    }
    setState(() => _firstPin = pin);
  }

  Future<void> _onConfirm(String pin) async {
    if (pin != _firstPin) {
      setState(() => _firstPin = null);
      showFailure(
        context,
        const ValidationFailure(
          technicalMessage: 'PIN confirmation mismatch',
          userMessageFr: 'Les deux codes sont différents. Recommencez.',
        ),
      );
      return;
    }
    final draft = ref.read(registrationDraftProvider);
    setState(() => _busy = true);
    final result = await ref
        .read(authStateProvider.notifier)
        .register(phone: draft.phone ?? '', pin: pin, language: draft.language);
    if (!mounted) return;
    switch (result.getFailureOrNull()) {
      case final Failure failure:
        setState(() {
          _busy = false;
          _firstPin = null;
        });
        showFailure(context, failure);
      case null:
        ref.read(registrationDraftProvider.notifier).clear();
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        Navigator.of(context).popUntil((route) => route.isFirst);
    }
  }
}
