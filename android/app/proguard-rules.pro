# Yako — règles R8.
# SQLCipher (via package:sqlite3, chargé par FFI) : ne pas renommer les
# classes natives éventuellement référencées.
-keep class net.zetetic.** { *; }
# Biometric / local_auth.
-keep class androidx.biometric.** { *; }
