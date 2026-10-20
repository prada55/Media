#!/usr/bin/env python3
"""Signe (ou vérifie) un JSON Yako avec HMAC-SHA256.

Même canonicalisation que lib/core/config/config_signature.dart :
clés triées récursivement, séparateurs compacts, UTF-8 non échappé,
champ « config_signature » exclu du calcul.

Usage :
  YAKO_CONFIG_HMAC_KEY=... python3 scripts/sign_json.py fichier.json          # signe
  YAKO_CONFIG_HMAC_KEY=... python3 scripts/sign_json.py --verify fichier.json # vérifie
"""
import hashlib
import hmac
import json
import os
import sys

FIELD = "config_signature"


def signature(data: dict, key: str) -> str:
    unsigned = {k: v for k, v in data.items() if k != FIELD}
    canonical = json.dumps(unsigned, sort_keys=True, separators=(",", ":"),
                           ensure_ascii=False)
    return hmac.new(key.encode("utf-8"), canonical.encode("utf-8"),
                    hashlib.sha256).hexdigest()


def main() -> int:
    args = sys.argv[1:]
    verify = "--verify" in args
    paths = [a for a in args if a != "--verify"]
    key = os.environ.get("YAKO_CONFIG_HMAC_KEY")
    if len(paths) != 1 or not key:
        print(__doc__)
        return 2
    with open(paths[0], encoding="utf-8") as f:
        data = json.load(f)
    expected = signature(data, key)
    if verify:
        ok = hmac.compare_digest(data.get(FIELD, ""), expected)
        print("Signature valide." if ok else "Signature INVALIDE.")
        return 0 if ok else 1
    data[FIELD] = expected
    with open(paths[0], "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"{paths[0]} signé.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
