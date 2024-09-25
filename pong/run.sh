#!/bin/bash

OS="$(uname)"

if [[ "$OS" == "Darwin" ]]; then
    IP_ADDRESS=$(ifconfig en0 | grep 'inet ' | awk '{print $2}')
else
    IP_ADDRESS=$(ip -4 addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}')
fi

ENV_FILE=".env"

cp $ENV_FILE "${ENV_FILE}.bak"

if [[ "$OS" == "Darwin" ]]; then
    sed -i "" "s|^FORTYTWO_THING=.*|FORTYTWO_THING='https://${IP_ADDRESS}/auth42/'|" $ENV_FILE
    sed -i "" "s|^CSRF_TR_OR=.*|CSRF_TR_OR='https://${IP_ADDRESS}/'|" $ENV_FILE
else
    sed -i "s|^FORTYTWO_THING=.*|FORTYTWO_THING='https://${IP_ADDRESS}/auth42/'|" $ENV_FILE
    sed -i "s|^CSRF_TR_OR=.*|CSRF_TR_OR='https://${IP_ADDRESS}/'|" $ENV_FILE
fi

rm -rf staticfiles; docker compose down -v; docker compose up --build
