FROM node:20-bookworm AS builder
WORKDIR /indexer

COPY package.json pnpm-lock.yaml config.yaml schema.graphql ./
COPY src ./src

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm codegen
RUN cd generated && pnpm install --frozen-lockfile || pnpm install && pnpm build

FROM node:20-bookworm AS runner
WORKDIR /indexer

COPY --from=builder /indexer/generated ./generated
COPY --from=builder /indexer/config.yaml ./config.yaml
COPY --from=builder /indexer/schema.graphql ./schema.graphql
COPY --from=builder /indexer/src ./src
COPY package.json pnpm-lock.yaml ./

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

ENV TUI_OFF=true
ENV NODE_ENV=production

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["start"]
