// lib/features/translation/data/datasources/text_normalizer.dart
//
// Normalisation pour la recherche : minuscules, apostrophes unifiées,
// ponctuation retirée, espaces compactés. Les accents sont conservés
// (ils portent du sens en dioula et en baoulé).

/// Normalizes [input] for dictionary matching.
String normalizePhrase(String input) => input
    .toLowerCase()
    .replaceAll(RegExp('[’`´]'), "'")
    .replaceAll(RegExp(r"[^\p{L}\p{N}' ]", unicode: true), ' ')
    .replaceAll(RegExp(r'\s+'), ' ')
    .trim();

/// Levenshtein distance, aborting early once it exceeds [max].
int levenshtein(String a, String b, {int max = 1 << 30}) {
  if ((a.length - b.length).abs() > max) return max + 1;
  var previous = List<int>.generate(b.length + 1, (i) => i);
  for (var i = 1; i <= a.length; i++) {
    final current = List<int>.filled(b.length + 1, 0)..[0] = i;
    var rowMin = current[0];
    for (var j = 1; j <= b.length; j++) {
      final cost = a.codeUnitAt(i - 1) == b.codeUnitAt(j - 1) ? 0 : 1;
      final v = [
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      ].reduce((x, y) => x < y ? x : y);
      current[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    previous = current;
  }
  return previous[b.length];
}
