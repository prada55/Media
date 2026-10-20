// lib/core/platform/app_directories.dart
//
// Abstraction de path_provider pour pouvoir la simuler en test.

import 'dart:io';

import 'package:path_provider/path_provider.dart';

/// Resolves application directories.
class AppDirectories {
  const AppDirectories();

  /// Private, non-backed-up documents directory of the app.
  Future<Directory> documents() => getApplicationDocumentsDirectory();
}
