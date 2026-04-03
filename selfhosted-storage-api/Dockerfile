FROM node:20-alpine

WORKDIR /app

COPY package.json ./

RUN npm install --omit=dev

COPY server.mjs ./

EXPOSE 3015

CMD ["npm", "start"]
