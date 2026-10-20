// lib/core/presentation/failure_snackbar.dart
//
// Affichage uniforme des échecs : message FR simple, jamais de détail
// technique.

import 'package:flutter/material.dart';
import 'package:yako/core/error/failure.dart';

/// User-facing French message for [failure].
String failureMessageFr(Failure failure) => switch (failure) {
  LockedOutFailure(:final remaining) =>
    'Trop d’essais. Réessayez dans ${_format(remaining)}.',
  AuthenticationFailure(remainingAttempts: final int left) when left > 0 =>
    '${failure.userMessageFr} Il reste $left essai${left > 1 ? 's' : ''}.',
  _ => failure.userMessageFr,
};

/// Shows [failure] in a SnackBar.
void showFailure(BuildContext context, Failure failure) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(
          failureMessageFr(failure),
          style: const TextStyle(fontSize: 16),
        ),
      ),
    );
}

String _format(Duration d) {
  final minutes = d.inMinutes.toString().padLeft(2, '0');
  final seconds = (d.inSeconds % 60).toString().padLeft(2, '0');
  return '$minutes:$seconds';
}
