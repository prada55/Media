// lib/features/transactions/presentation/widgets/category_chips.dart
//
// Puces de catégorie (Vente marchandise/boisson/alimentaire, Dépense
// stock/transport, Autre).

import 'package:flutter/material.dart';
import 'package:yako/features/transactions/domain/entities/transaction.dart';

/// Category picker.
class CategoryChips extends StatelessWidget {
  const CategoryChips({
    required this.selected,
    required this.onChanged,
    super.key,
  });

  final TransactionCategory selected;
  final ValueChanged<TransactionCategory> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final category in TransactionCategory.values)
          ChoiceChip(
            key: ValueKey('category-${category.code}'),
            label: Text(category.labelFr, style: const TextStyle(fontSize: 16)),
            selected: category == selected,
            onSelected: (_) => onChanged(category),
          ),
      ],
    );
  }
}
