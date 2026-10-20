// lib/features/transactions/presentation/screens/record_screen.dart
//
// Appui long = enregistrer, relâcher = arrêter. Onde en direct, indicateur
// de transcription, puis formulaire de validation. Si la transcription
// est indisponible, saisie manuelle avec l'audio conservé (chiffré).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/core/presentation/failure_snackbar.dart';
import 'package:yako/features/transactions/domain/services/microphone_permission.dart';
import 'package:yako/features/transactions/presentation/providers/record_controller.dart';
import 'package:yako/features/transactions/presentation/widgets/mic_permission_banner.dart';
import 'package:yako/features/transactions/presentation/widgets/micro_fab.dart';
import 'package:yako/features/transactions/presentation/widgets/record_waveform.dart';
import 'package:yako/features/transactions/presentation/widgets/transaction_form.dart';

/// Voice capture + validation form.
class RecordScreen extends ConsumerWidget {
  const RecordScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(recordControllerProvider);
    final controller = ref.read(recordControllerProvider.notifier);
    final recording = state.phase == RecordPhase.recording;
    final denied =
        state.permission == MicPermission.denied ||
        state.permission == MicPermission.permanentlyDenied;
    return Scaffold(
      appBar: AppBar(title: const Text('Nouvelle opération')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (denied)
              MicPermissionBanner(onOpenSettings: controller.openSettings),
            if (state.phase != RecordPhase.review) ...[
              const SizedBox(height: 24),
              Text(
                recording
                    ? 'Je vous écoute… Relâchez pour terminer.'
                    : 'Restez appuyé sur le micro et dites : '
                          '« J’ai vendu 3 sacs de riz à 25 000 ».',
                key: const ValueKey('record-instructions'),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 24),
              if (recording) const RecordWaveform(),
              if (state.phase == RecordPhase.transcribing)
                const Center(
                  key: ValueKey('transcribing'),
                  child: Column(
                    children: [
                      CircularProgressIndicator(),
                      SizedBox(height: 8),
                      Text('Yako écrit ce que vous avez dit…'),
                    ],
                  ),
                ),
              const SizedBox(height: 24),
              Center(
                child: MicroFab(
                  recording: recording,
                  onLongPressStart: controller.startRecording,
                  onLongPressEnd: controller.stopRecording,
                ),
              ),
              const SizedBox(height: 24),
              TextButton(
                key: const ValueKey('type-manually'),
                onPressed: controller.typeManually,
                child: const Text('Écrire sans parler'),
              ),
            ] else
              _Review(state: state),
          ],
        ),
      ),
    );
  }
}

class _Review extends ConsumerWidget {
  const _Review({required this.state});

  final RecordUiState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notice = state.notice;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (notice != null)
          Card(
            key: const ValueKey('record-notice'),
            child: ListTile(
              leading: const Icon(Icons.info_outline),
              title: Text(notice),
            ),
          ),
        if (state.hasAudio)
          const ListTile(
            leading: Icon(Icons.graphic_eq),
            title: Text('Votre voix sera gardée, chiffrée, pour la réécoute.'),
          ),
        const SizedBox(height: 8),
        TransactionForm(
          initialTranscript: state.transcript,
          busy: state.saving,
          onSubmit: (values) => _save(context, ref, values),
        ),
      ],
    );
  }

  Future<void> _save(
    BuildContext context,
    WidgetRef ref,
    TransactionFormValues values,
  ) async {
    final result = await ref
        .read(recordControllerProvider.notifier)
        .save(
          type: values.type,
          amount: values.amount,
          category: values.category,
          transcript: values.transcript,
        );
    if (!context.mounted) return;
    final failure = result.getFailureOrNull();
    if (failure != null) {
      showFailure(context, failure);
      return;
    }
    final messenger = ScaffoldMessenger.of(context);
    Navigator.of(context).pop();
    messenger.showSnackBar(
      const SnackBar(content: Text('Opération enregistrée ✓')),
    );
  }
}
