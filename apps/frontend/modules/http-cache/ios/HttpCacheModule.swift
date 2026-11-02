import ExpoModulesCore

// purgeHttpCache() do JS: o app chama a cada logout.
public class HttpCacheModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TmsHttpCache")

    AsyncFunction("purge") {
      HttpCache.purge()
    }
  }
}
