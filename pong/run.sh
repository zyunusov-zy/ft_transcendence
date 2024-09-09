#!/bin/bash

# Ensure the static files directory exists
mkdir -p /app/staticfiles

# Run migrations
python manage.py makemigrations
python manage.py migrate

# Collect static files
python manage.py collectstatic --noinput

# Start the server with Daphne
daphne -u /app/daphne.sock pong.asgi:application
