# Self-hosted Storage API

This service replaces the Firebase scene storage used by `excalidraw-app`.

It stores:

- room scenes as JSON files under `scenes/<roomId>.json`
- file URL mappings together with the scene payload

## Environment variables

```bash
PORT=3015
API_PREFIX=/api/v1
CORS_ORIGIN=https://whiteboard.example.com

STORAGE_DIR=/tmp/excalidraw-storage
```

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

Image/file uploads are expected to go directly to your external HTTP upload
service. The frontend variables for that are:

```bash
VITE_APP_FILE_UPLOAD_URL=http://school.rocpow.com:9081
VITE_APP_FILE_UPLOAD_PATH=/function/oss/upload/single/file
VITE_APP_FILE_UPLOAD_CODE=default
VITE_APP_FILE_UPLOAD_ASSET_PREFIX=http://school.rocpow.com:9000
```

## Docker Compose

The repository-level `docker-compose.yml` is set up for a same-origin HTTP stack:

- `excalidraw` serves the frontend on host port `13000`
- `/api/v1/*` is proxied to `storage-api`
- `/socket.io/*` is proxied to the collaboration server
- image/file uploads go directly to your external HTTP upload service
- `collab` is built from the vendored `vendor/excalidraw-room` source in this repository
- scene JSON files are persisted to the host directory `./data/storage`

Start the stack from the repo root:

```bash
docker compose up --build
```

Then open:

```text
http://localhost:13000
```

The collaboration service is built from vendored source, so `docker compose build`
does not need GitHub access for the `collab` image itself.

With the default compose setup, scene files are stored on the host at:

```text
./data/storage/scenes/<roomId>.json
```

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
