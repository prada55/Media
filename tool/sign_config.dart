// tool/sign_config.dart
//
// Signe assets/config.json (HMAC-SHA256) avec la clé passée en argument
// ou via la variable d'environnement YAKO_CONFIG_HMAC_KEY.
// Usage : dart run tool/sign_config.dart [cle]

import 'dart:convert';
import 'dart:io';

import 'package:yako/core/config/config_signature.dart';

void main(List<String> args) {
  final key = args.isNotEmpty
      ? args.first
      : Platform.environment['YAKO_CONFIG_HMAC_KEY'] ?? kConfigHmacKey;
  final file = File('assets/config.json');
  final json = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
  json[kSignatureField] = computeJsonSignature(json, hmacKey: key);
  file.writeAsStringSync(
    '${const JsonEncoder.withIndent('  ').convert(json)}\n',
  );
  stdout.writeln('assets/config.json signed.');
}
