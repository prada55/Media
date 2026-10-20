// lib/core/di/injection.dart
//
// Conteneur d'injection (get_it + injectable). Riverpod lit les services
// depuis ce conteneur ; les tests remplacent les providers Riverpod.

import 'package:get_it/get_it.dart';
import 'package:injectable/injectable.dart';
import 'package:yako/core/di/injection.config.dart';

/// Global service locator.
final GetIt getIt = GetIt.instance;

/// Registers every injectable service. Call once from `main()`.
@InjectableInit()
void configureDependencies() => getIt.init();
