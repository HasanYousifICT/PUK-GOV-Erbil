# Deploy on Vercel

Vercel has no permanent disk, so you need two external services (both have free tiers):
1. **PostgreSQL** (Neon, Supabase, or Vercel Storage → Neon)
2. **S3-compatible storage** for CVs/attachments (Cloudflare R2, Supabase Storage, AWS S3)

## Vercel project settings
- Framework: Next.js. Leave Build Command **empty** (the repo's `vercel-build` script is used automatically).
- Environment Variables (Production):
  - `DATABASE_URL` = Postgres connection string (pooled/"-pooler" one if provided)
  - `DIRECT_URL` = direct (non-pooled) Postgres connection string (if your provider gives only one, set both to it)
  - `JWT_SECRET` = long random text (`openssl rand -hex 32`)
  - `SEED_DEMO_DATA` = `false`
  - `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION` (`auto` for R2), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
    (Supabase Storage: also set `S3_FORCE_PATH_STYLE=true`)
- Redeploy. The build creates the tables automatically.

## Limits on Vercel
- Uploads go through the server, and Vercel limits a request to about 4.5 MB, so CVs/attachments larger than that fail. For bigger files use the VPS setup (DEPLOY.md).
