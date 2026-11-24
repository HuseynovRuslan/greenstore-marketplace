#!/usr/bin/env bash
# Update the GreenStore API on the VPS: pull, build, migrate, restart, wait for /health/ready (README.md).
# Usage: backend/deploy/deploy.sh            (from anywhere; works in its own folder)
#        SKIP_PULL=1 backend/deploy/deploy.sh  (deploy the commit that is already checked out)
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "backend/deploy/.env is missing (names: .env.server.example)" >&2
  exit 1
fi

# The server's peak hours (Asia/Baku): no image builds 07:30-09:30 and 17:00-19:00.
now=$((10#$(TZ=Asia/Baku date +%H%M)))
if { [ "$now" -ge 730 ] && [ "$now" -lt 930 ]; } || { [ "$now" -ge 1700 ] && [ "$now" -lt 1900 ]; }; then
  echo "Peak hours (07:30-09:30, 17:00-19:00 Baku): no builds now." >&2
  exit 1
fi

if [ "${SKIP_PULL:-0}" != 1 ]; then
  git pull --ff-only
fi
rev=$(git rev-parse --short HEAD)
echo "== Deploying $rev"

docker compose build greenstore-api
docker tag greenstore-api:latest "greenstore-api:$rev"

# Migrations and the seed (Seed__Reference, Seed__Demo) in a one-shot container; starts greenstore-db if needed.
docker compose run --rm greenstore-api migrate

docker compose up -d --remove-orphans

echo "== Waiting for /health/ready"
for _ in $(seq 1 60); do
  code=$(docker run --rm --network greenstore-net curlimages/curl -s -o /dev/null -w '%{http_code}' \
    http://greenstore-api:8080/health/ready || true)
  if [ "$code" = 200 ]; then
    echo "== $rev is ready"
    exit 0
  fi
  sleep 2
done
echo "/health/ready did not return 200 (last: ${code:-none}). Logs: docker compose logs --tail 100 greenstore-api" >&2
exit 1
