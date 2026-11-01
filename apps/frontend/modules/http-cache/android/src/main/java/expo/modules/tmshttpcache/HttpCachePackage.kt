package expo.modules.tmshttpcache

import android.app.Application
import android.content.Context
import expo.modules.core.interfaces.ApplicationLifecycleListener
import expo.modules.core.interfaces.Package

// Na abertura (Application.onCreate), antes do JS e do NetworkingModule:
// nenhuma resposta vai para o disco, e o que uma versão anterior gravou é
// apagado.
class HttpCachePackage : Package {
  override fun createApplicationLifecycleListeners(
    context: Context
  ): List<ApplicationLifecycleListener> =
    listOf(
      object : ApplicationLifecycleListener {
        override fun onCreate(application: Application) {
          HttpCache.disableDiskCache()
          HttpCache.purge(application)
        }
      }
    )
}
