-- Leitura restrita para `pnpm metrics:funnel` (Fase 5a,
-- doc/plano-observabilidade-fase-5.md §2). Só as colunas que as consultas
-- usam, nenhuma escrita. Fora desta lista ficam, entre outras: senha/hash,
-- e-mail, nome de usuário, tokens, convites, `sheet_data`, nome da ficha,
-- notas, conteúdo de rolagem e `chronicle_audit.payload`.
--
-- 1. Crie o role por SQL, com a credencial administrativa (no Neon, pelo SQL
--    Editor ou psql: um role criado pelo Console ou pela API do Neon entra no
--    neon_superuser e lê tudo). Gere a senha, não reaproveite outra:
--      create role tms_metrics login password '<senha gerada>';
-- 2. Rode este arquivo com a mesma credencial administrativa. Pode rodar de
--    novo depois de uma migration: ele zera os grants e aplica só a lista:
--      psql "<url administrativa>" -f scripts/metrics-role.sql
-- 3. Ponha a URL do tms_metrics em METRICS_DATABASE_URL (nunca a DATABASE_URL).
--
-- O script confere o role antes de consultar e se recusa a rodar se ele ler
-- qualquer coluna fora desta lista, se faltar uma coluna dela ou se ele puder
-- escrever. A lista é a mesma de ALLOWED_COLUMNS em scripts/metrics-funnel.ts;
-- o teste aplica este arquivo e roda o relatório com o role.

-- Revogar a tabela também revoga os grants por coluna
revoke all on all tables in schema public from tms_metrics;
revoke create on schema public from tms_metrics;
grant usage on schema public to tms_metrics;

grant select (id, created_at) on users to tms_metrics;
grant select (id, system_id) on chronicles to tms_metrics;
grant select (id, family) on game_systems to tms_metrics;
grant select (chronicle_id, actor_id, action, target_character_id, target_user_id, created_at) on chronicle_audit to tms_metrics;
grant select (chronicle_id, user_id, joined_at) on chronicle_members to tms_metrics;
grant select (id, chronicle_id, user_id, system_id, kind, created_at) on characters to tms_metrics;
grant select (character_id, chronicle_id, created_by, created_at) on character_rolls to tms_metrics;
grant select (character_id, created_by, created_at) on character_batches to tms_metrics;

-- Valem a cada login do role (não num `set role`)
alter role tms_metrics set default_transaction_read_only = on;
alter role tms_metrics set statement_timeout = '60s';
