// lib/core/config/config_signature.dart
//
// Signature HMAC-SHA256 des fichiers JSON embarqués/téléchargés (config,
// dictionnaires, promotions). Pur Dart : utilisable par tool/sign_config.dart
// sans moteur Flutter.

import 'dart:convert';

import 'package:crypto/crypto.dart';

/// Placeholder HMAC key, overridden at build time with
/// `--dart-define=YAKO_CONFIG_HMAC_KEY=...` (see docs/ota.md).
const String kConfigHmacKey = String.fromEnvironment(
  'YAKO_CONFIG_HMAC_KEY',
  defaultValue: 'yako-dev-config-hmac-key-change-me',
);

/// Name of the field carrying the signature.
const String kSignatureField = 'config_signature';

/// HMAC-SHA256 (hex) of the canonical JSON of [json] without
/// [kSignatureField]. Keys are sorted recursively.
String computeJsonSignature(
  Map<String, dynamic> json, {
  String hmacKey = kConfigHmacKey,
}) {
  final unsigned = Map<String, dynamic>.of(json)..remove(kSignatureField);
  final canonical = jsonEncode(_canonicalize(unsigned));
  final hmac = Hmac(sha256, utf8.encode(hmacKey));
  return hmac.convert(utf8.encode(canonical)).toString();
}

/// Whether [json] carries a valid signature for [hmacKey].
bool hasValidJsonSignature(
  Map<String, dynamic> json, {
  String hmacKey = kConfigHmacKey,
}) {
  final signature = json[kSignatureField];
  if (signature is! String) return false;
  return constantTimeEquals(
    signature,
    computeJsonSignature(json, hmacKey: hmacKey),
  );
}

/// Compares two strings in constant time (relative to their length).
bool constantTimeEquals(String a, String b) {
  if (a.length != b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) {
    diff |= a.codeUnitAt(i) ^ b.codeUnitAt(i);
  }
  return diff == 0;
}

Object? _canonicalize(Object? value) {
  if (value is Map) {
    final keys = value.keys.map((k) => k.toString()).toList()..sort();
    return {for (final k in keys) k: _canonicalize(value[k])};
  }
  if (value is List) return value.map(_canonicalize).toList();
  return value;
}
