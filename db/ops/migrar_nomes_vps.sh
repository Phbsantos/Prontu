#!/bin/bash
# Migra a VPS para os identificadores atuais do repositório (banco, usuário do
# banco, credencial e ids dos workflows do n8n). Os nomes ANTIGOS entram só por
# variável de ambiente, para não ficarem escritos no repositório.
#
# NÃO FOI EXECUTADO. Rode primeiro em DRY_RUN (padrão) e leia o que seria feito.
# Execução de verdade: DRY_RUN=0 ./migrar_nomes_vps.sh
#
# Janela de manutenção: o app fica fora do ar durante a troca (workflows e
# credencial são recriados). As URLs dos webhooks NÃO mudam (os paths são os
# mesmos), então o frontend não precisa ser alterado.
#
# Variáveis obrigatórias (nomes antigos e containers):
#   OLD_DB, OLD_USER           banco e role do app em uso hoje
#   OLD_PREFIX                 prefixo antigo dos ids (credencial e workflows)
#   APP_DB_CONTAINER           container do Postgres do app
#   N8N_CONTAINER              container do n8n
#   PG_ADMIN_USER              superusuário do Postgres do app (ex.: postgres)
#   NEW_USER_PASSWORD          senha do role novo (renomear role apaga a senha md5)
# Opcionais (padrões = nomes atuais do repo):
#   NEW_DB=prontu_db  NEW_USER=prontu_user  NEW_PREFIX=prt
#   N8N_DB_CONTAINER=postgres_n8n  N8N_DB_USER=n8n_user  N8N_DB_NAME=n8n_db
#   BACKUP_DIR=./backup_$(date +%F)
set -euo pipefail

: "${OLD_DB:?}" "${OLD_USER:?}" "${OLD_PREFIX:?}" "${APP_DB_CONTAINER:?}"
: "${N8N_CONTAINER:?}" "${PG_ADMIN_USER:?}" "${NEW_USER_PASSWORD:?}"
NEW_DB="${NEW_DB:-prontu_db}"
NEW_USER="${NEW_USER:-prontu_user}"
NEW_PREFIX="${NEW_PREFIX:-prt}"
N8N_DB_CONTAINER="${N8N_DB_CONTAINER:-postgres_n8n}"
N8N_DB_USER="${N8N_DB_USER:-n8n_user}"
N8N_DB_NAME="${N8N_DB_NAME:-n8n_db}"
BACKUP_DIR="${BACKUP_DIR:-./backup_$(date +%F)}"
DRY_RUN="${DRY_RUN:-1}"

HERE="$(cd "$(dirname "$0")" && pwd)"
WF_DIR="$HERE/../n8n-workflows"
CRED_FILE="$WF_DIR/_reference/credential_postgres.json"   # arquivo REAL, só local (ignorado pelo git)

run() { echo "+ $*"; if [ "$DRY_RUN" = "0" ]; then "$@"; fi; }
psql_app() { docker exec -i "$APP_DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$PG_ADMIN_USER" -d postgres "$@"; }
psql_n8n() { docker exec -i "$N8N_DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$N8N_DB_USER" -d "$N8N_DB_NAME" "$@"; }

echo "== 0. Pré-requisitos"
# O Postgres não renomeia o role da própria sessão. Se o role do app também for o
# superusuário do container, crie um superusuário temporário e use-o aqui.
if [ "$PG_ADMIN_USER" = "$OLD_USER" ]; then
  echo "PG_ADMIN_USER não pode ser igual a OLD_USER (role da sessão não pode ser renomeado)."
  echo "Crie um superusuário temporário: CREATE ROLE tmp_admin SUPERUSER LOGIN PASSWORD '...';"
  exit 1
fi
falha() { echo "$1"; [ "$DRY_RUN" = "0" ] && exit 1; echo "(dry-run: seguindo mesmo assim)"; return 0; }
[ -f "$CRED_FILE" ] || falha "Falta $CRED_FILE (copie o .example, preencha a senha real e use database=$NEW_DB, user=$NEW_USER)."
[ ! -f "$CRED_FILE" ] || grep -q "\"database\": *\"$NEW_DB\"" "$CRED_FILE" || falha "$CRED_FILE precisa apontar para database=$NEW_DB"
echo "DRY_RUN=$DRY_RUN"

echo "== 1. Backup (obrigatório antes de qualquer alteração)"
run mkdir -p "$BACKUP_DIR"
if [ "$DRY_RUN" = "0" ]; then
  docker exec "$APP_DB_CONTAINER" pg_dump -U "$PG_ADMIN_USER" -Fc "$OLD_DB" > "$BACKUP_DIR/app.dump"
  docker exec "$N8N_DB_CONTAINER" pg_dump -U "$N8N_DB_USER" -Fc "$N8N_DB_NAME" > "$BACKUP_DIR/n8n.dump"
else
  echo "+ pg_dump do banco do app e do banco do n8n em $BACKUP_DIR"
fi

echo "== 2. Parar o n8n (sem conexões abertas no banco do app)"
run docker stop "$N8N_CONTAINER"

echo "== 3. Renomear banco e role do app"
if [ "$DRY_RUN" = "0" ]; then
  psql_app -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$OLD_DB';"
  psql_app -c "ALTER DATABASE \"$OLD_DB\" RENAME TO \"$NEW_DB\";"
  psql_app -c "ALTER ROLE \"$OLD_USER\" RENAME TO \"$NEW_USER\";"
  # Renomear role limpa senhas md5 (o nome é o salt): define de novo.
  psql_app -c "ALTER ROLE \"$NEW_USER\" PASSWORD '$NEW_USER_PASSWORD';"
else
  echo "+ ALTER DATABASE $OLD_DB RENAME TO $NEW_DB; ALTER ROLE $OLD_USER RENAME TO $NEW_USER; ALTER ROLE ... PASSWORD (senha vinda de NEW_USER_PASSWORD)"
fi
echo "   >> Manual: atualize POSTGRES_USER/POSTGRES_DB (e a senha) no docker-compose/.env do Postgres do app, se existirem."

echo "== 4. Remover workflows e credencial antigos do n8n"
if [ "$DRY_RUN" = "0" ]; then
  # Via stdin: o psql só interpola :'old' fora do -c. Tudo numa transação.
  psql_n8n -v old="$OLD_PREFIX" <<'SQL'
BEGIN;
DELETE FROM workflow_entity WHERE id LIKE :'old' || '%';
DELETE FROM credentials_entity WHERE id LIKE :'old' || '%';
COMMIT;
SQL
else
  echo "+ DELETE FROM workflow_entity / credentials_entity WHERE id LIKE '$OLD_PREFIX%'  (rodar numa transação, conferir antes com SELECT)"
fi

echo "== 5. Iniciar o n8n e importar credencial + workflows novos"
run docker start "$N8N_CONTAINER"
run docker cp "$CRED_FILE" "$N8N_CONTAINER:/tmp/credential_postgres.json"
run docker exec "$N8N_CONTAINER" n8n import:credentials --input=/tmp/credential_postgres.json
run docker exec "$N8N_CONTAINER" rm -f /tmp/credential_postgres.json
for f in "$WF_DIR"/[0-9][0-9]_*.json; do
  base="$(basename "$f")"
  run docker cp "$f" "$N8N_CONTAINER:/tmp/$base"
  run docker exec "$N8N_CONTAINER" n8n import:workflow --input="/tmp/$base"
  run docker exec "$N8N_CONTAINER" rm -f "/tmp/$base"
done

echo "== 6. Publicar (instância exige activeVersionId; ver _reference/activate.sh)"
for f in "$WF_DIR"/[0-9][0-9]_*.json; do
  # id do workflow = primeira chave "id" de nível raiz (sem depender de node na VPS)
  id="$(sed -n 's/^  "id": "\([^"]*\)".*/\1/p' "$f" | head -1)"
  [ -n "$id" ] || { echo "sem id em $f"; exit 1; }
  run bash "$WF_DIR/_reference/activate.sh" "$id"
done
run docker restart "$N8N_CONTAINER"

echo "== 7. Verificação sugerida"
echo "   curl -s -o /dev/null -w '%{http_code}\n' <API_BASE>/listar/equipes   # esperado 200"
echo "   Login no app e fluxo do checklist (docs/CHECKLIST_TESTES.md)."
echo "   Rollback: restaurar $BACKUP_DIR/app.dump e n8n.dump e reverter o compose."
