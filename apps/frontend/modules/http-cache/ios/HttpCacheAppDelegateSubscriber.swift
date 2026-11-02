import ExpoModulesCore

// Roda na abertura, antes do JS e da primeira requisição: nenhuma resposta
// vai para o disco, e o que uma versão anterior gravou é apagado.
public class HttpCacheAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    HttpCache.disableAndPurge()
    return true
  }
}
