// NÃO REORDENE: a leitura do convite (P12, D-14) roda antes do roteador e do
// error tracking. No web, ela tira o código do fragmento de /join#… antes
// que o Expo Router o ponha nos parâmetros da rota e antes de qualquer
// breadcrumb. O teste app/__tests__/entry.test.ts prende esta ordem.
import './lib/invite/capture'
import 'expo-router/entry'
