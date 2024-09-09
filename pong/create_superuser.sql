-- create_superuser.sql
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT
      FROM   pg_catalog.pg_user
      WHERE  usename = '${POSTGRES_SUPERUSER}'
   ) THEN
      CREATE ROLE ${POSTGRES_SUPERUSER} WITH LOGIN SUPERUSER PASSWORD '${POSTGRES_SUPERUSER_PASSWORD}';
   END IF;
END
$do$;
