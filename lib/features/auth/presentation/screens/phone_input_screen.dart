// lib/features/auth/presentation/screens/phone_input_screen.dart
//
// Saisie du numéro : préfixe +225 figé, 10 chiffres, validation en direct.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/utils/phone_validator.dart';
import 'package:yako/features/auth/presentation/providers/registration_providers.dart';
import 'package:yako/features/auth/presentation/screens/pin_setup_screen.dart';

/// Phone number step of the registration.
class PhoneInputScreen extends ConsumerStatefulWidget {
  const PhoneInputScreen({super.key});

  @override
  ConsumerState<PhoneInputScreen> createState() => _PhoneInputScreenState();
}

class _PhoneInputScreenState extends ConsumerState<PhoneInputScreen> {
  final TextEditingController _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Votre numéro')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: ValueListenableBuilder<TextEditingValue>(
            valueListenable: _controller,
            builder: (context, value, _) {
              final result = PhoneValidator.normalize(value.text);
              final showError = value.text.length >= 10 && result.isFailure;
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextField(
                    key: const ValueKey('phone-field'),
                    controller: _controller,
                    autofocus: true,
                    keyboardType: TextInputType.phone,
                    style: const TextStyle(fontSize: 24, letterSpacing: 2),
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(10),
                    ],
                    decoration: InputDecoration(
                      prefixText: '+225 ',
                      hintText: '07 00 00 00 00',
                      border: const OutlineInputBorder(),
                      errorText: showError
                          ? result.getFailureOrNull()!.userMessageFr
                          : null,
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Votre numéro reste sur ce téléphone. '
                    'Yako ne garde qu’une empreinte secrète.',
                  ),
                  const Spacer(),
                  FilledButton(
                    key: const ValueKey('phone-continue'),
                    onPressed: result.isSuccess
                        ? () => _continue(result.getOrNull()!)
                        : null,
                    child: const Text('Continuer'),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  void _continue(String nationalPhone) {
    ref.read(registrationDraftProvider.notifier).setPhone(nationalPhone);
    Navigator.of(context)
        .push(MaterialPageRoute<void>(builder: (_) => const PinSetupScreen()));
  }
}
