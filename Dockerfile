FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 ROCKIEOS_STANDALONE=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN groupadd --gid 10001 rockieos && useradd --uid 10001 --gid rockieos --create-home rockieos
COPY --from=builder --chown=rockieos:rockieos /app/.next/standalone ./
COPY --from=builder --chown=rockieos:rockieos /app/.next/static ./.next/static
COPY --from=builder --chown=rockieos:rockieos /app/public ./public
USER rockieos
EXPOSE 3000
CMD ["node", "server.js"]
