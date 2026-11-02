import Foundation

// O NSURLSession do React Native (RCTHTTPRequestHandler) é criado sob
// demanda com a configuração padrão, que usa o URLCache.shared: gravado em
// Library/Caches/<bundle>/Cache.db, em claro. Trocar o URLCache.shared por um
// sem capacidade antes da primeira requisição deixa a sessão sem cache em
// disco; apagar o que já existe tira tokens e dados ocultos de versões
// anteriores do app (T-13; MASVS-STORAGE).
enum HttpCache {
  static func disableAndPurge() {
    URLCache.shared.removeAllCachedResponses()
    URLCache.shared = URLCache(memoryCapacity: 0, diskCapacity: 0, directory: nil)
  }

  static func purge() {
    URLCache.shared.removeAllCachedResponses()
  }
}
