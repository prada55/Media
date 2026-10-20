// lib/data/local/tables/translations_cache_table.dart
//
// Cache des traductions déjà calculées (clé = empreinte du texte source).

import 'package:drift/drift.dart';

/// `translations_cache` table.
@DataClassName('TranslationCacheRow')
@TableIndex(
  name: 'idx_translations_cache_source_hash',
  columns: {#sourceTextHash},
)
class TranslationsCache extends Table {
  TextColumn get id => text()();

  /// SHA-256 (hex) du texte source normalisé.
  TextColumn get sourceTextHash => text()();

  TextColumn get sourceLang => text()();

  TextColumn get targetLang => text()();

  TextColumn get translatedText => text()();

  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}
