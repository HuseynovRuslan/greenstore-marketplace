# GreenStore API: VPS deploy

API və baza QRLog-un serverində (Ubuntu 24.04, Docker) iki konteynerdə işləyir. Ümumi təsvir, risklər və geri qaytarma: [docs/handoff/deploy.md](../../docs/handoff/deploy.md).

| Hissə | Ad |
|---|---|
| Compose layihəsi | `greenstore` |
| Konteynerlər | `greenstore-api` (port 8080, xaricə açılmır), `greenstore-db` (PostgreSQL 16) |
| Şəbəkələr | `greenstore-net` (öz şəbəkəmiz), `attendanceqr_default` (Caddy-nin şəbəkəsi, yalnız `greenstore-api` qoşulur) |
| Volume-lar | `greenstore_pgdata` (baza), `greenstore_media` (yüklənən şəkillər) |
| Gizli dəyərlər | serverdə `backend/deploy/.env` (chmod 600), adlar [.env.server.example](.env.server.example)-da |

## Server qaydaları

Bu server QRLog-undur. Admin şərtləri:

- Adlar unikaldır: `greenstore-*`. Paylaşılan şəbəkədə `db`, `api`, `web` artıq başqalarınındır.
- `ports:` yoxdur, `127.0.0.1` də yox. Domeni və HTTPS-i QRLog-un Caddy-si verir.
- Caddy-yə, Caddyfile-a, `/opt/attendanceqr`-a, `attendanceqr-*` konteynerlərinə toxunmuruq.
- Limitlər: `greenstore-api` 1 CPU, 768 MB; `greenstore-db` 0.5 CPU, 512 MB.
- Image build-i 07:30–09:30 və 17:00–19:00 (Bakı) etmirik: `deploy.sh` bu saatlarda dayanır.

Caddy bloku (adminin Caddyfile-ında, bizdə yox):

```
greenstore-api.qrlog.az {
    reverse_proxy greenstore-api:8080
}
```

## Yeniləmə

```bash
cd /opt/greenstore && backend/deploy/deploy.sh
```

`git pull` → image build → `migrate` (miqrasiya və seed) → `docker compose up -d` → `/health/ready` 200 gözləyir. Hər build həm `greenstore-api:latest`, həm `greenstore-api:<commit>` adını alır.

## Vəziyyət və loqlar

```bash
cd /opt/greenstore/backend/deploy
docker compose ps
docker compose logs -f --tail 100 greenstore-api
docker run --rm --network greenstore-net curlimages/curl -s http://greenstore-api:8080/health/ready
```

SMS kodu (Staging-də `Sms__Provider=log`, kod yalnız loqdadır):

```bash
docker logs --since 15m greenstore-api 2>&1 | grep 'SMS not sent'
```

Baza:

```bash
docker exec -it greenstore-db psql -U greenstore -d greenstore
```

## Əvvəlki versiyaya qayıtmaq

```bash
docker image ls greenstore-api                      # commit adları
docker tag greenstore-api:<commit> greenstore-api:latest
cd /opt/greenstore/backend/deploy && docker compose up -d --force-recreate greenstore-api
```

Miqrasiyalar geri qaytarılmır: köhnə image yeni sxemlə işləməyə bilər. Sxem dəyişibsə, bazanı backup-dan qaytarmaq lazımdır.

## GreenStore-u tam silmək (QRLog-a toxunmadan)

1. Admindən Caddyfile-dakı `greenstore-api.qrlog.az` blokunu silməsini istəyin.
2. Serverdə:

```bash
cd /opt/greenstore/backend/deploy
docker compose down -v          # greenstore-api, greenstore-db, greenstore-net, greenstore_* volume-lar
docker image ls greenstore-api --format '{{.Repository}}:{{.Tag}}' | xargs -r docker image rm
sudo rm -rf /opt/greenstore
```

`attendanceqr_default` şəbəkəsi `external`-dır: `docker compose down` onu silmir. `postgres:16` və `curlimages/curl` image-ləri qalır; başqa heç kim işlətmirsə, `docker image rm postgres:16 curlimages/curl` ilə silinir.
