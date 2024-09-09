#!/bin/bash
set -e

# Create the superuser and grant permissions
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  ALTER ROLE $POSTGRES_USER WITH SUPERUSER;
EOSQL
