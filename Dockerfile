FROM node:14-alpine

WORKDIR /app

COPY . /app

RUN yarn install

ENV NAME dinubot

CMD ["npm", "start"]