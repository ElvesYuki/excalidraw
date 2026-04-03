FROM --platform=${BUILDPLATFORM} node:18 AS build

WORKDIR /opt/node_app

COPY . .

# do not ignore optional dependencies:
# Error: Cannot find module @rollup/rollup-linux-x64-gnu
RUN --mount=type=cache,target=/root/.cache/yarn \
    npm_config_target_arch=${TARGETARCH} yarn --network-timeout 600000

ARG NODE_ENV=production
ARG VITE_APP_WS_SERVER_URL=
ARG VITE_APP_STORAGE_BACKEND_URL=
ARG VITE_APP_FILE_UPLOAD_URL=
ARG VITE_APP_FILE_UPLOAD_PATH=
ARG VITE_APP_FILE_UPLOAD_CODE=default
ARG VITE_APP_FILE_UPLOAD_ASSET_PREFIX=

ENV NODE_ENV=${NODE_ENV}
ENV VITE_APP_WS_SERVER_URL=${VITE_APP_WS_SERVER_URL}
ENV VITE_APP_STORAGE_BACKEND_URL=${VITE_APP_STORAGE_BACKEND_URL}
ENV VITE_APP_FILE_UPLOAD_URL=${VITE_APP_FILE_UPLOAD_URL}
ENV VITE_APP_FILE_UPLOAD_PATH=${VITE_APP_FILE_UPLOAD_PATH}
ENV VITE_APP_FILE_UPLOAD_CODE=${VITE_APP_FILE_UPLOAD_CODE}
ENV VITE_APP_FILE_UPLOAD_ASSET_PREFIX=${VITE_APP_FILE_UPLOAD_ASSET_PREFIX}

RUN npm_config_target_arch=${TARGETARCH} yarn build:app:docker

FROM --platform=${TARGETPLATFORM} nginx:1.27-alpine

COPY --from=build /opt/node_app/excalidraw-app/build /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

HEALTHCHECK CMD wget -q -O /dev/null http://localhost || exit 1
