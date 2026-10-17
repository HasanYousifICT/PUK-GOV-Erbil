# Deploy OpenRecruitOS to a server (HTTPS)

1. Get a small Linux VPS (1 GB RAM is enough) and a domain; point an A record (e.g. `ats.example.com`) to the VPS IP.
2. On the server: install Docker (`curl -fsSL https://get.docker.com | sh`).
3. Copy this project to the server (`git clone <your repo>` or `scp`).
4. `cp deploy/.env.prod.example .env`, then edit `.env`: set `DOMAIN` and `JWT_SECRET` (`openssl rand -hex 32`).
5. `docker compose -f docker-compose.prod.yml up -d --build`
6. Open `https://your-domain`. The first visit asks you to create the admin account. After that sign-up is closed.

## Adding more users
Sign-up closes after the first account. To let a colleague register, set `ALLOW_SIGNUP=true` in `.env`, run `docker compose -f docker-compose.prod.yml up -d`, let them register, then set it back to `false`.

## Update
`git pull && docker compose -f docker-compose.prod.yml up -d --build` (the database schema syncs on start).

## Backup (do this regularly)
```
docker run --rm -v openrecruitos_app-db:/db -v openrecruitos_app-uploads:/up -v $PWD:/out alpine tar czf /out/backup-$(date +%F).tgz /db /up
```
(Volume names are prefixed with the project folder name; check with `docker volume ls`.)
