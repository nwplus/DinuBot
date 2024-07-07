FROM node:20-alpine

USER node

WORKDIR /app

COPY package*.json ./

RUN yarn install

COPY . .

ENV NAME dinubot

CMD ["npm", "start"]