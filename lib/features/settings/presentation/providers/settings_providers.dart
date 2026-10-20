// lib/features/settings/presentation/providers/settings_providers.dart
//
// Réglages : numéro masqué (déchiffré à la volée) et export.

import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import 'package:yako/core/di/injection.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/core/security/encryption_service.dart';
import 'package:yako/core/security/key_vault.dart';
import 'package:yako/core/utils/secure_file.dart';
import 'package:yako/features/auth/presentation/providers/auth_providers.dart';
import 'package:yako/features/settings/data/services/export_service.dart';

final exportServiceProvider = Provider<ExportService>(
  (ref) => getIt<ExportService>(),
);

final keyVaultProvider = Provider<KeyVault>((ref) => getIt<KeyVault>());

final encryptionServiceProvider = Provider<EncryptionService>(
  (ref) => getIt<EncryptionService>(),
);

/// « 01••••••45 », or `null` when unavailable.
final FutureProvider<String?> maskedPhoneProvider =
    FutureProvider.autoDispose<String?>((ref) async {
      ref.watch(currentUserProvider.select((u) => u.value?.id));
      final key = ref.watch(sessionManagerProvider).dataKey;
      if (key == null) return null;
      final sealed =
          (await ref.watch(keyVaultProvider).read(KeyVault.phoneHint))
              .getOrNull();
      if (sealed == null) return null;
      final clear = await ref
          .watch(encryptionServiceProvider)
          .decryptAesGcm(sealed, key);
      return clear.getOrNull();
    });

/// Hands a file to the OS share sheet (overridable in tests).
typedef FileSharer = Future<void> Function(File file);

final fileSharerProvider = Provider<FileSharer>(
  (ref) => (file) async {
    await SharePlus.instance.share(
      ShareParams(files: [XFile(file.path)], title: 'Yako export'),
    );
  },
);

final exportActionsProvider = Provider<ExportActions>(ExportActions.new);

/// Export use case: encrypt, share, then wipe the temporary file.
class ExportActions {
  ExportActions(this._ref);

  final Ref _ref;

  Future<Result<void>> exportAndShare(String password) async {
    final exported = await _ref
        .read(exportServiceProvider)
        .exportToFile(password);
    final file = exported.getOrNull();
    if (file == null) return FailureResult(exported.getFailureOrNull()!);
    try {
      await _ref.read(fileSharerProvider)(file);
      return const Success(null);
    } on Object catch (e, st) {
      return FailureResult(
        UnknownFailure(
          technicalMessage: 'Share failed',
          userMessageFr: 'Partage impossible.',
          cause: e,
          stackTrace: st,
        ),
      );
    } finally {
      await overwriteAndDelete(file);
    }
  }
}
