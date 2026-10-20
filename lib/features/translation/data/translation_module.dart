// lib/features/translation/data/translation_module.dart
//
// Enregistrements DI de la feature traduction.

import 'package:injectable/injectable.dart';
import 'package:yako/core/security/encryption_service.dart';
import 'package:yako/data/local/database_manager.dart';
import 'package:yako/features/auth/domain/services/session_manager.dart';
import 'package:yako/features/translation/data/datasources/dictionary_datasource.dart';
import 'package:yako/features/translation/data/datasources/translation_cache_datasource.dart';
import 'package:yako/features/translation/data/engines/stub_translation_engine.dart';
import 'package:yako/features/translation/data/services/translation_service_impl.dart';
import 'package:yako/features/translation/domain/services/translation_service.dart';

/// Translation registrations.
@module
abstract class TranslationModule {
  @lazySingleton
  DictionaryDatasource get dictionary => DictionaryDatasource();

  @lazySingleton
  TranslationService translationService(
    DictionaryDatasource dictionary,
    DatabaseManager databaseManager,
    EncryptionService encryption,
    SessionManager session,
  ) => TranslationServiceImpl(
    dictionary: dictionary,
    cache: TranslationCacheDatasource(
      db: databaseManager,
      encryption: encryption,
      dataKey: () => session.dataKey,
    ),
    // Aucun modèle NLLB embarqué : voir docs/translation-rd.md.
    engine: const StubTranslationEngine(),
  );
}
