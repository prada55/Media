// lib/core/utils/secure_file.dart
//
// Effacement « best effort » : écrase le contenu par de l'aléatoire avant
// suppression. Sur mémoire flash (wear leveling), l'écrasement n'est pas
// garanti au niveau physique : la vraie protection reste le chiffrement.

import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

/// Overwrites [file] with random bytes, then deletes it. No-op if absent.
Future<void> overwriteAndDelete(File file, {Random? random}) async {
  if (!file.existsSync()) return;
  final rng = random ?? Random.secure();
  final length = await file.length();
  final raf = await file.open(mode: FileMode.writeOnly);
  try {
    const chunk = 64 * 1024;
    final buffer = Uint8List(chunk);
    var written = 0;
    while (written < length) {
      final size = min(chunk, length - written);
      for (var i = 0; i < size; i++) {
        buffer[i] = rng.nextInt(256);
      }
      await raf.writeFrom(buffer, 0, size);
      written += size;
    }
    await raf.flush();
  } finally {
    await raf.close();
  }
  await file.delete();
}
