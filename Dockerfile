FROM node:20-alpine

RUN corepack enable

USER node

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

ENV NAME dinubot

CMD ["pnpm", "start"]