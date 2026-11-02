package expo.modules.tmshttpcache

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// purgeHttpCache() do JS: o app chama a cada logout.
class HttpCacheModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TmsHttpCache")

    AsyncFunction("purge") {
      appContext.reactContext?.let { HttpCache.purge(it) }
      Unit
    }
  }
}
