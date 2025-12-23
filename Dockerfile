# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies including devDependencies (needed for build)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the project (generates dist/extension.js)
RUN npm run package

# Stage 2: Runtime
FROM node:20-alpine

WORKDIR /app

# Security: Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
# Copy package.json to manage versions/metadata if typically needed (optional here but good practice)
COPY --from=builder /app/package.json ./

# Set ownership to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Start the application
# Note: As this is a VS Code extension, it requires the VS Code host environment to run fully.
CMD ["node", "dist/extension.js"]
