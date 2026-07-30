FROM node:22-alpine

RUN apk add --no-cache python3 make g++

RUN corepack enable

WORKDIR /app
RUN chown node:node /app

USER node

COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

COPY --chown=node:node . .

ENV NAME=dinubot

CMD ["pnpm", "start"]
