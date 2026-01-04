# Multi-stage build for Node.js backend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev for build)
RUN npm install

# Copy source
COPY . .

# Build if needed (TypeScript, etc.)
RUN if [ -f "tsconfig.json" ]; then npm run build || true; fi

# Production stage
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --production

# Copy built files or source (using shell to handle optional files)
RUN --mount=type=bind,from=builder,source=/app,target=/tmp/app \
    cp -r /tmp/app/dist ./dist 2>/dev/null || true && \
    cp /tmp/app/server.js ./ 2>/dev/null || true && \
    cp -r /tmp/app/src ./src 2>/dev/null || true

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:8000/health || exit 1

# Start application
CMD ["node", "server.js"]
