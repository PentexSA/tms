import Constants from 'expo-constants'

// A versão do app, a do `version` do app.json. O `pnpm release` sobe esse número
// junto com o da raiz (scripts/release.sh). Um módulo só para isso: lib/http.ts
// precisa dela sem carregar o cache persistido.
export const APP_VERSION = Constants.expoConfig?.version ?? '0'
