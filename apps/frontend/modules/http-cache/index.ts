import { requireOptionalNativeModule } from 'expo'

// Cache HTTP do aparelho (T-13). O fetch do React Native grava as respostas
// em disco, em claro: no iOS, o NSURLCache (Library/Caches/<app>/Cache.db);
// no Android, o OkHttp (cache/http-cache). Com tokens e dados ocultos, isso
// sobrevivia ao logout. A API já manda no-store, mas o que foi gravado antes
// continua lá. Este módulo local (sem pacote de terceiros):
// - na abertura, antes do JS, desliga o cache em disco e apaga o que houver;
// - purgeHttpCache() apaga de novo (o app chama a cada logout).
// No web, no Expo Go e no Jest o módulo nativo não existe: tudo vira no-op.

interface HttpCacheNative {
  purge(): Promise<void>
}

const native = requireOptionalNativeModule<HttpCacheNative>('TmsHttpCache')

/** O módulo nativo está no binário (build de desenvolvimento ou de loja). */
export const hasNativeHttpCache = native !== null

/** Apaga as respostas HTTP gravadas no aparelho. Nunca lança. */
export async function purgeHttpCache(): Promise<void> {
  await native?.purge().catch(() => undefined)
}
