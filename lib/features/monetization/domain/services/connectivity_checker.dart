// lib/features/monetization/domain/services/connectivity_checker.dart
//
// Détection de connectivité. Yako ne déclare ni INTERNET ni
// ACCESS_NETWORK_STATE (Phase 6) : l'implémentation livrée répond toujours
// « hors ligne ».

/// Network reachability.
abstract interface class ConnectivityChecker {
  Future<bool> isOnline();
}

/// Build without network permission: always offline.
class OfflineConnectivityChecker implements ConnectivityChecker {
  const OfflineConnectivityChecker();

  @override
  Future<bool> isOnline() async => false;
}
