# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json prisma ./
RUN npm ci && npm run prisma:generate
COPY . .
RUN npm run build && npm prune --production

# Production stage
FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 nodejs && adduser -u 1001 -S nodejs
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
RUN mkdir -p uploads && chown nodejs:nodejs uploads
USER nodejs
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health/live',r=>process.exit(r.statusCode===200?0:1))"
CMD ["node", "dist/index.js"]

