// lib/features/monetization/data/monetization_module.dart
//
// Enregistrements DI : consentement, score, API (MOCK par défaut), export.
// L'API HTTP réelle (credit_score_api_http.dart) n'est volontairement PAS
// enregistrée.

import 'package:injectable/injectable.dart';
import 'package:yako/core/platform/app_directories.dart';
import 'package:yako/core/security/encryption_service.dart';
import 'package:yako/data/local/database_manager.dart';
import 'package:yako/features/consent/data/repositories/consent_repository_impl.dart';
import 'package:yako/features/consent/domain/repositories/consent_repository.dart';
import 'package:yako/features/monetization/data/services/credit_score_api_mock.dart';
import 'package:yako/features/monetization/domain/services/connectivity_checker.dart';
import 'package:yako/features/monetization/domain/services/credit_score_api.dart';
import 'package:yako/features/monetization/domain/services/credit_score_service.dart';
import 'package:yako/features/settings/data/services/export_service.dart';
import 'package:yako/features/transactions/domain/repositories/transaction_repository.dart';

/// Monetization, consent and export registrations.
@module
abstract class MonetizationModule {
  @lazySingleton
  ConsentRepository consentRepository(DatabaseManager databaseManager) =>
      ConsentRepositoryImpl(databaseManager: databaseManager);

  @lazySingleton
  CreditScoreService creditScoreService(TransactionRepository transactions) =>
      CreditScoreService(transactions);

  @lazySingleton
  CreditScoreApi get creditScoreApi => CreditScoreApiMock();

  @lazySingleton
  ConnectivityChecker get connectivity => const OfflineConnectivityChecker();

  @lazySingleton
  ExportService exportService(
    TransactionRepository transactions,
    EncryptionService encryption,
    AppDirectories directories,
  ) => ExportService(
    transactions: transactions,
    encryption: encryption,
    directories: directories,
  );
}
