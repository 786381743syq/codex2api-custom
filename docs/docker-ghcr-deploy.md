# Docker GHCR Deploy

This fork publishes Docker images to:

```text
ghcr.io/786381743syq/codex2api-custom
```

## Build and publish

GitHub Actions publishes the image when:

- `contribution-custom` is pushed, producing the `contribution-custom` and `latest` tags.
- a version tag such as `v1.0.0` is pushed, producing `1.0.0`, `1.0`, and `latest`.
- the `Build Docker Image` workflow is run manually.

For production, prefer a version tag instead of `latest`:

```bash
git tag v1.0.0
git push origin v1.0.0
```

## Server update

Set the image version in the server `.env`:

```env
CODEX_IMAGE=ghcr.io/786381743syq/codex2api-custom:1.0.0
```

Then update the service:

```bash
docker compose pull codex2api
docker compose up -d codex2api
docker compose logs -f codex2api
```

If the GHCR package is private, log in on the server first:

```bash
docker login ghcr.io
```

## Notes

- Do not commit `.env`, database files, or Docker volumes.
- Database schema migrations run when the backend starts, but admin settings stored in the database must exist on the server database.
- To roll back, set `CODEX_IMAGE` to the previous version tag and run `docker compose up -d codex2api`.