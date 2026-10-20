// lib/features/transactions/presentation/widgets/transaction_form.dart
//
// Formulaire de validation : type, montant (clavier numérique, groupé
// FCFA), catégorie, transcription modifiable. Les valeurs sont remises à
// [onSubmit] ; la persistance est faite par le contrôleur.

import 'package:flutter/material.dart';
import 'package:yako/core/utils/fcfa_formatter.dart';
import 'package:yako/features/transactions/domain/entities/transaction.dart';
import 'package:yako/features/transactions/presentation/widgets/category_chips.dart';

/// Values submitted by [TransactionForm].
typedef TransactionFormValues = ({
  TransactionType type,
  int amount,
  TransactionCategory category,
  String transcript,
});

/// Transaction form.
class TransactionForm extends StatefulWidget {
  const TransactionForm({
    required this.onSubmit,
    this.initial,
    this.initialTranscript = '',
    this.busy = false,
    super.key,
  });

  final ValueChanged<TransactionFormValues> onSubmit;
  final Transaction? initial;
  final String initialTranscript;
  final bool busy;

  @override
  State<TransactionForm> createState() => _TransactionFormState();
}

class _TransactionFormState extends State<TransactionForm> {
  late final TextEditingController _amount;
  late final TextEditingController _transcript;
  late TransactionType _type;
  late TransactionCategory _category;

  @override
  void initState() {
    super.initState();
    final initial = widget.initial;
    _amount = TextEditingController(
      text: initial == null
          ? ''
          : FcfaInputFormatter.group(initial.amount.toString()),
    );
    _transcript = TextEditingController(
      text: initial?.transcriptFr ?? widget.initialTranscript,
    );
    _type = initial?.type ?? TransactionType.sale;
    _category = initial?.category ?? TransactionCategory.saleGoods;
  }

  @override
  void dispose() {
    _amount.dispose();
    _transcript.dispose();
    super.dispose();
  }

  void _setCategory(TransactionCategory category) => setState(() {
    _category = category;
    _type = category.impliedType ?? _type;
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SegmentedButton<TransactionType>(
          segments: [
            for (final type in TransactionType.values)
              ButtonSegment(value: type, label: Text(type.labelFr)),
          ],
          selected: {_type},
          onSelectionChanged: (s) => setState(() => _type = s.first),
        ),
        const SizedBox(height: 16),
        TextField(
          key: const ValueKey('form-amount'),
          controller: _amount,
          keyboardType: TextInputType.number,
          inputFormatters: const [FcfaInputFormatter()],
          style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
          decoration: const InputDecoration(
            labelText: 'Montant',
            suffixText: 'FCFA',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 16),
        CategoryChips(selected: _category, onChanged: _setCategory),
        const SizedBox(height: 16),
        TextField(
          key: const ValueKey('form-transcript'),
          controller: _transcript,
          maxLines: 2,
          decoration: const InputDecoration(
            labelText: 'Note (facultatif)',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 24),
        ValueListenableBuilder<TextEditingValue>(
          valueListenable: _amount,
          builder: (context, value, _) {
            final amount = FcfaInputFormatter.parse(value.text);
            return FilledButton.icon(
              key: const ValueKey('form-save'),
              onPressed: amount == null || widget.busy
                  ? null
                  : () => widget.onSubmit((
                      type: _type,
                      amount: amount,
                      category: _category,
                      transcript: _transcript.text,
                    )),
              icon: widget.busy
                  ? const SizedBox.square(
                      dimension: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.check),
              label: const Text('Enregistrer'),
            );
          },
        ),
      ],
    );
  }
}
