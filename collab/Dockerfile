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
COPY --from=build /src/app/dist ./dist

RUN yarn --production --network-timeout 600000

EXPOSE 80

CMD ["yarn", "start"]
