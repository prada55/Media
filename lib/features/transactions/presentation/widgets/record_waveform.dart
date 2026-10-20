// lib/features/transactions/presentation/widgets/record_waveform.dart
//
// Onde sonore en temps réel (niveau d'entrée du micro).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yako/features/transactions/presentation/providers/transaction_providers.dart';

/// Live input level bars.
class RecordWaveform extends ConsumerStatefulWidget {
  const RecordWaveform({super.key});

  static const int bars = 32;

  @override
  ConsumerState<RecordWaveform> createState() => _RecordWaveformState();
}

class _RecordWaveformState extends ConsumerState<RecordWaveform> {
  final List<double> _levels = List.filled(RecordWaveform.bars, 0);

  @override
  Widget build(BuildContext context) {
    ref.listen(amplitudeProvider, (_, next) {
      final level = next.value;
      if (level == null) return;
      // Pure UI state: scrolling history of the input level.
      setState(() {
        _levels
          ..removeAt(0)
          ..add(level);
      });
    });
    final color = Theme.of(context).colorScheme.error;
    return SizedBox(
      height: 80,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          for (final level in _levels)
            Container(
              width: 5,
              height: 6 + level * 70,
              margin: const EdgeInsets.symmetric(horizontal: 2),
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(3),
              ),
            ),
        ],
      ),
    );
  }
}
