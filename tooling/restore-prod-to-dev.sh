#!/bin/sh
# Downloads the production database and restores it into the local Docker
# dev environment, renaming the guild schema to match the dev server ID.
#
# Usage: ./tooling/restore-prod-to-dev.sh
#
# Requires: heroku CLI (logged in), docker compose running

set -e

DEV_GUILD_ID="${COMMAND_INSTALLATION_SERVER_ID:-1481312707750920303}"
DEV_DB_URL="postgresql://xpholder:xpholder@localhost:5432/xpholder"
DB_CONTAINER="xpholder-db-1"

echo "==> Capturing fresh prod backup..."
heroku pg:backups:capture --app xpholder 2>&1 | tail -3

echo "==> Downloading backup..."
BACKUP_URL=$(heroku pg:backups:url --app xpholder)
curl -sf -o /tmp/prod-backup.dump "$BACKUP_URL"
echo "    Downloaded $(du -h /tmp/prod-backup.dump | cut -f1)"

echo "==> Copying into DB container..."
docker cp /tmp/prod-backup.dump "$DB_CONTAINER":/tmp/prod-backup.dump

echo "==> Dropping existing guild schemas..."
docker compose exec -T db psql -U xpholder -d xpholder -c "
  DO \$\$
  DECLARE s TEXT;
  BEGIN
    FOR s IN SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'guild%'
    LOOP
      EXECUTE 'DROP SCHEMA ' || quote_ident(s) || ' CASCADE';
      RAISE NOTICE 'Dropped %', s;
    END LOOP;
  END \$\$;
"

echo "==> Restoring prod backup..."
docker compose exec -T db pg_restore --no-owner --no-acl -U xpholder -d xpholder /tmp/prod-backup.dump 2>&1 | grep -v "already exists" || true

echo "==> Finding prod guild schema..."
PROD_SCHEMA=$(docker compose exec -T db psql -U xpholder -d xpholder -t -c "
  SELECT schema_name FROM information_schema.schemata
  WHERE schema_name LIKE 'guild%'
  ORDER BY schema_name LIMIT 1;
" | tr -d '[:space:]')

DEV_SCHEMA="guild${DEV_GUILD_ID}"

if [ "$PROD_SCHEMA" = "$DEV_SCHEMA" ]; then
  echo "==> Schema already matches dev guild ID ($DEV_GUILD_ID)"
elif [ -n "$PROD_SCHEMA" ]; then
  echo "==> Renaming $PROD_SCHEMA -> $DEV_SCHEMA"
  docker compose exec -T db psql -U xpholder -d xpholder -c "ALTER SCHEMA $PROD_SCHEMA RENAME TO $DEV_SCHEMA;"
else
  echo "!!! No guild schema found in backup"
  exit 1
fi

echo "==> Marking all players as active members (dev has no Discord sync)..."
docker compose exec -T db psql -U xpholder -d xpholder -c "UPDATE ${DEV_SCHEMA}.players SET is_member = TRUE, inactive_days = NULL;"

echo "==> Clearing dashboard sessions (forces re-login)..."
docker compose exec -T db psql -U xpholder -d xpholder -c "DELETE FROM public.session;" 2>/dev/null || true

echo "==> Restarting containers..."
docker compose restart bot dashboard 2>&1 | tail -2

echo ""
echo "Done! Prod data is now available under guild $DEV_GUILD_ID."
echo "Log in at http://localhost:3000"
