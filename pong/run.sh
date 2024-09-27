#!/bin/bash

OS="$(uname)"

# Detect the appropriate network interface and get the IP address
if [[ "$OS" == "Darwin" ]]; then
    IP_ADDRESS=$(ifconfig en0 | grep 'inet ' | awk '{print $2}')
else
    # Use a more reliable method to get the IP address for Linux
    IP_ADDRESS=$(hostname -I | awk '{print $1}')
fi

# Check if IP_ADDRESS was correctly set
if [[ -z "$IP_ADDRESS" ]]; then
    echo "Failed to retrieve IP address. Exiting."
    exit 1
fi

# Backup the existing .env file
ENV_FILE=".env"
cp $ENV_FILE "${ENV_FILE}.bak"

# Update the .env file with the new IP address
if [[ "$OS" == "Darwin" ]]; then
    sed -i "" "s|^FORTYTWO_THING=.*|FORTYTWO_THING='https://${IP_ADDRESS}/auth42/'|" $ENV_FILE
    sed -i "" "s|^CSRF_TR_OR=.*|CSRF_TR_OR='https://${IP_ADDRESS}/'|" $ENV_FILE
else
    sed -i "s|^FORTYTWO_THING=.*|FORTYTWO_THING='https://${IP_ADDRESS}/auth42/'|" $ENV_FILE
    sed -i "s|^CSRF_TR_OR=.*|CSRF_TR_OR='https://${IP_ADDRESS}/'|" $ENV_FILE
fi

rm -rf staticfiles; docker compose down -v; docker compose up --build
