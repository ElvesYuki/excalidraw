# Self-hosted Storage API

This service replaces the Firebase scene and file storage used by `excalidraw-app`.

It stores:

- encrypted room scenes as JSON objects in S3 under `scenes/<roomId>.json`
- encrypted image/file blobs in S3 under `<prefix>/<fileId>`

## Environment variables

```bash
PORT=3015
API_PREFIX=/api/v1
CORS_ORIGIN=https://whiteboard.example.com

S3_BUCKET=excalidraw
S3_REGION=us-east-1
S3_ENDPOINT=
S3_FORCE_PATH_STYLE=false
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
```

`S3_ENDPOINT` and `S3_FORCE_PATH_STYLE=true` are useful for MinIO and other S3-compatible storage.

## Run locally

```bash
cd selfhosted-storage-api
npm install
npm start
```

## Frontend configuration

Set the frontend storage backend URL to this service:

```bash
VITE_APP_STORAGE_BACKEND_URL=http://localhost:3015
```

If you reverse proxy the API under the same origin as the frontend, you can leave
`VITE_APP_STORAGE_BACKEND_URL` unset and route `/api/v1/*` to this service.

## Example Nginx routing

```nginx
location /api/v1/ {
  proxy_pass http://127.0.0.1:3015/api/v1/;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```
