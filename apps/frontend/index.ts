// NÃO REORDENE: a leitura do convite (P12, D-14) roda antes do roteador e do
// error tracking. No web, ela tira o código do fragmento de /join#… antes
// que o Expo Router o ponha nos parâmetros da rota e antes de qualquer
// breadcrumb. Depois dela, e ainda antes do roteador, o filtro dos avisos
// de dev de terceiros (lib/devLogs.ts). O teste app/__tests__/entry.test.ts
// prende esta ordem.
import './lib/invite/capture'
import './lib/devLogs'
import 'expo-router/entry'
