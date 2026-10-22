# Smoke nativo com Maestro

Roda antes de cada release, num **dev build** (não no Expo Go: o SQLCipher e o
`appId` `com.tms.app` só existem no binário gerado com os plugins do
`app.json`). Cobre o que o E2E do web não alcança: Keychain/Keystore, banco
SQLCipher, dock com toque longo e modo avião.

| Fluxo | O que prova |
|---|---|
| `01-login` | o app abre e entra (sessão no SecureStore) |
| `02-open-sheet` | a ficha abre em Jogo com o dock e "Salvo" |
| `03-spend-blood` | toque longo no Sangue, aviso com Desfazer, fila confirma |
| `04-airplane-mode` | gastar offline, reiniciar sem rede (dados do banco cifrado) e sincronizar ao voltar (só Android) |
| `05-mage-wheel` | a roda do Mago no dock: Paradoxo +1 pela regra e Desfazer (v1) |
| `06-werewolf-form` | a Forma do Lobisomem no dock: Crinos com a mudança instantânea e Desfazer (v2) |
| `07-storyteller-table` | Mesa do narrador: dano e Nova noite em duas fichas, prévia e reversão no servidor (v3) |

## Preparar

1. Uma conta de teste **num servidor de homologação**, nunca com dados de
   produção, com uma crônica de Vampiro e uma ficha da própria conta. O Sangue
   precisa estar acima de 0. Cada rodada do `04` gasta 1. Para o `05`, uma
   crônica de Mago com uma ficha da conta e menos de 20 de Paradoxo na roda
   (o Desfazer devolve o que a rodada tirou).
   Para o `07`, a conta também narra uma crônica de Vampiro com duas fichas
   capazes de levar 1 nível letal; ambas devem estar em criação ou ativas.
2. O dev build apontando para esse servidor:

   ```bash
   cd apps/frontend
   EXPO_PUBLIC_API_URL=https://<homologacao> npx expo run:android   # ou run:ios
   ```

## Rodar

As credenciais vão por `-e` e nunca ficam no repositório:

```bash
maestro test apps/frontend/.maestro \
  -e EMAIL=<conta de teste> -e PASSWORD=<senha> \
  -e CHRONICLE="<nome da crônica>" -e CHARACTER="<nome da ficha>" \
  -e CHARACTER_ID=<uuid da ficha> \
  -e MAGE_CHRONICLE="<crônica de Mago>" -e MAGE_CHARACTER="<ficha de Mago>" \
  -e WEREWOLF_CHRONICLE="<crônica de Lobisomem>" \
  -e WEREWOLF_CHARACTER="<ficha de Lobisomem fora de Crinos>" \
  -e STORYTELLER_CHRONICLE="<crônica narrada pela conta>" \
  -e STORYTELLER_CHARACTER_A="<nome da primeira ficha>" \
  -e STORYTELLER_CHARACTER_B="<nome da segunda ficha>"
```

No iOS, exclua o fluxo de modo avião: `--exclude-tags android`.

## Roteiro manual no aparelho (iOS e Android)

O Maestro não liga o modo avião no simulador do iOS, e só um aparelho de
verdade mostra o banco cifrado. Antes do release:

1. Instale o build de release e entre. Abra a ficha (o dono abre em Jogo).
2. Ligue o modo avião. Aparece "Sem conexão" e o indicador mostra "Offline".
3. Gaste Sangue pelo dock (toque longo) e leve 1 de dano letal pelo sheet da
   Vitalidade. O indicador mostra "Offline · 2 pendentes".
4. Feche o app à força e abra de novo, ainda no modo avião. A ficha abre do
   aparelho com os valores novos e os 2 pendentes.
5. Desligue o modo avião. Em segundos o indicador mostra "Salvo"; em outro
   aparelho (ou no web), a ficha tem os mesmos valores.
6. Saia da conta. Abra o app sem rede: ele pede login, sem ficha em cache.

Para conferir a cifra num Android de desenvolvimento, copie
`/data/data/com.tms.app/files/SQLite/tms-offline.db` com `adb exec-out run-as
com.tms.app cat files/SQLite/tms-offline.db > /tmp/x.db`. O arquivo não pode
abrir no `sqlite3` comum ("file is not a database") nem conter o texto da ficha
(`strings /tmp/x.db | grep -i sangue` não acha nada).

O fechamento da v3 e os resultados da rodada estão em [validacao-v3.md](../../../doc/validacao-v3.md) e no [PR #31](https://github.com/PentexSA/tms/pull/31). A execução iOS permanece pendente por decisão do usuário.
