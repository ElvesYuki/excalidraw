FROM node:18-alpine AS build

WORKDIR /src

COPY vendor/excalidraw-room /src/app

WORKDIR /src/app

RUN yarn --network-timeout 600000
RUN yarn build

FROM node:18-alpine

WORKDIR /app

COPY --from=build /src/app/package.json ./package.json
COPY --from=build /src/app/yarn.lock ./yarn.lock
COPY --from=build /src/app/build ./build
COPY --from=build /src/app/public ./public
COPY --from=build /src/app/src ./src
COPY --from=build /src/app/.env.development ./.env.development
COPY --from=build /src/app/tsconfig.json ./tsconfig.json
COPY --from=build /src/app/.eslintrc.json ./.eslintrc.json
COPY --from=build /src/app/pm2.production.json ./pm2.production.json
COPY --from=build /src/app/pm2.json ./pm2.json

RUN yarn --production --network-timeout 600000

EXPOSE 80

CMD ["yarn", "start"]
