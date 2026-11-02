package expo.modules.tmshttpcache

import android.content.Context
import com.facebook.react.modules.network.OkHttpClientProvider
import java.io.File

// O NetworkingModule do React Native monta o OkHttp com um Cache em
// cache/http-cache (10 MB), em claro. Com tokens e dados ocultos, isso
// sobrevivia ao logout (T-13; MASVS-STORAGE).
object HttpCache {
  // O construtor sem Context não põe Cache e mantém o ReactCookieJarContainer.
  // Precisa rodar antes do NetworkingModule criar o cliente.
  fun disableDiskCache() {
    OkHttpClientProvider.setOkHttpClientFactory {
      OkHttpClientProvider.createClientBuilder().build()
    }
  }

  fun purge(context: Context) {
    File(context.cacheDir, "http-cache").deleteRecursively()
  }
}
