#!/usr/bin/env python3
"""Déchiffre un export Yako (.yako) vers un CSV.

Format : b"YAKO1" | sel (32 o) | 0x01 | nonce (12 o) | chiffré | tag (16 o)
Clé    : PBKDF2-HMAC-SHA256(mot de passe, sel, 100 000 itérations, 32 o)
Algo   : AES-256-GCM

Usage  : python3 decrypt_export.py yako_export_20261020.yako sortie.csv
Dépendance : pip install cryptography
"""
import getpass
import hashlib
import sys

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

MAGIC = b"YAKO1"
SALT_LEN = 32
NONCE_LEN = 12
ITERATIONS = 100_000


def decrypt(data: bytes, password: str) -> bytes:
    if not data.startswith(MAGIC):
        raise ValueError("Ce fichier n'est pas un export Yako.")
    salt = data[len(MAGIC):len(MAGIC) + SALT_LEN]
    body = data[len(MAGIC) + SALT_LEN:]
    if body[0] != 0x01:
        raise ValueError("Version de format inconnue.")
    nonce = body[1:1 + NONCE_LEN]
    ciphertext_and_tag = body[1 + NONCE_LEN:]
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt,
                              ITERATIONS, 32)
    return AESGCM(key).decrypt(nonce, ciphertext_and_tag, None)


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    with open(sys.argv[1], "rb") as f:
        data = f.read()
    password = getpass.getpass("Mot de passe de l'export : ")
    try:
        csv = decrypt(data, password)
    except Exception:  # noqa: BLE001 - message volontairement générique
        print("Échec : mot de passe incorrect ou fichier abîmé.")
        return 1
    with open(sys.argv[2], "wb") as f:
        f.write(csv)
    print(f"CSV écrit dans {sys.argv[2]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
