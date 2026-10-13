#!/bin/sh
# Start both nginx and Node.js server.js for Cloud Run

# Start nginx in background
nginx -g "daemon off;" &

# Start Node.js server on port 8081 (proxied by nginx on 8080)
export PORT=8081
exec node server.js