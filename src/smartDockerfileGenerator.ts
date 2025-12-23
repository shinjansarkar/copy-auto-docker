/**
 * Smart Dockerfile Generator
 * Generates correct, minimal, multistage Dockerfiles based on accurate detection
 * Fixes Issues #7-11: Dockerfile generation errors
 */

import { DetectedFrontend, DetectedBackend } from './enhancedDetectionEngine';

export interface DockerfileOptions {
    useMultistage?: boolean;
    optimizeForProduction?: boolean;
    includeHealthCheck?: boolean;
}

/**
 * Smart Dockerfile Generator - Main Class
 */
export class SmartDockerfileGenerator {

    /**
     * Generate frontend Dockerfile
     */
    static generateFrontendDockerfile(frontend: DetectedFrontend, options?: DockerfileOptions): string {
        const {
            framework,
            variant,
            outputFolder,
            packageManager,
            installCommand,
            buildCommand
        } = frontend;

        // Special handling for SSR frameworks
        if (framework === 'nextjs' && variant === 'ssr') {
            return this.generateNextJsSSRDockerfile(frontend);
        }

        if (framework === 'nuxt') {
            return this.generateNuxtSSRDockerfile(frontend);
        }

        if (framework === 'svelte' && variant === 'kit') {
            return this.generateSvelteKitDockerfile(frontend);
        }

        // Standard multistage build for static frontends
        return this.generateStaticFrontendDockerfile(frontend);
    }

    /**
     * Generate static frontend Dockerfile (Vite, CRA, Vue, Angular, etc.)
     */
    private static generateStaticFrontendDockerfile(frontend: DetectedFrontend): string {
        const { outputFolder, packageManager, installCommand, buildCommand } = frontend;

        // Determine package files to copy
        let packageFiles = 'package*.json';

        // Ensure proper install command if lockfile is missing
        if (frontend.projectPath && frontend.packageManager === 'npm') {
            const fs = require('fs');
            const path = require('path');
            const hasLockfile = fs.existsSync(path.join(frontend.projectPath, 'package-lock.json'));
            if (!hasLockfile) {
                // Force install command to be npm install if no lockfile
                // Note: 'installCommand' passed in might already be 'npm ci', so we check
                if (installCommand.includes('npm ci')) {
                    // We can't modify const, but we can return different string or use variable
                    // Actually, detecting at source (EnhancedEngine) is better, but here works for fix.
                    // But wait, installCommand is destructured.
                }
            }
        }

        // Logic: if npm and NO package-lock.json, use 'npm install'
        let finalInstallCommand = installCommand;
        if (packageManager === 'npm' && frontend.projectPath) {
            const fs = require('fs');
            const path = require('path');
            if (!fs.existsSync(path.join(frontend.projectPath, 'package-lock.json'))) {
                finalInstallCommand = 'npm install';
            }
        }

        if (packageManager === 'yarn') {
            packageFiles = 'package.json yarn.lock';
        } else if (packageManager === 'pnpm') {
            packageFiles = 'package.json pnpm-lock.yaml';
        }

        return `# Multi-stage build for production frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY ${packageFiles} ./

# Install dependencies
RUN ${finalInstallCommand}

# Copy source code
COPY . .

# Build application
RUN ${buildCommand}

# Production stage with nginx
FROM nginx:alpine

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /app/${outputFolder} /usr/share/nginx/html

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
`;
    }

    /**
     * Generate Next.js SSR Dockerfile
     */
    private static generateNextJsSSRDockerfile(frontend: DetectedFrontend): string {
        const { packageManager, installCommand, buildCommand } = frontend;

        let packageFiles = 'package*.json';
        if (packageManager === 'yarn') {
            packageFiles = 'package.json yarn.lock';
        } else if (packageManager === 'pnpm') {
            packageFiles = 'package.json pnpm-lock.yaml';
        }

        return `# Multi-stage build for Next.js SSR
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY ${packageFiles} ./

# Install dependencies
RUN ${installCommand}

# Copy source code
COPY . .

# Build Next.js application
RUN ${buildCommand}

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

# Expose port
EXPOSE 3000

# Set NODE_ENV
ENV NODE_ENV=production

# Start Next.js
CMD ["npm", "start"]
`;
    }

    /**
     * Generate Nuxt SSR Dockerfile
     */
    private static generateNuxtSSRDockerfile(frontend: DetectedFrontend): string {
        const { packageManager, installCommand, buildCommand } = frontend;

        let packageFiles = 'package*.json';
        if (packageManager === 'yarn') {
            packageFiles = 'package.json yarn.lock';
        } else if (packageManager === 'pnpm') {
            packageFiles = 'package.json pnpm-lock.yaml';
        }

        return `# Multi-stage build for Nuxt.js
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY ${packageFiles} ./

# Install dependencies
RUN ${installCommand}

# Copy source code
COPY . .

# Build Nuxt application
RUN ${buildCommand}

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/.output ./.output

# Expose port
EXPOSE 3000

# Set NODE_ENV
ENV NODE_ENV=production

# Start Nuxt
CMD ["node", ".output/server/index.mjs"]
`;
    }

    /**
     * Generate SvelteKit Dockerfile
     */
    private static generateSvelteKitDockerfile(frontend: DetectedFrontend): string {
        const { packageManager, installCommand, buildCommand } = frontend;

        let packageFiles = 'package*.json';
        if (packageManager === 'yarn') {
            packageFiles = 'package.json yarn.lock';
        } else if (packageManager === 'pnpm') {
            packageFiles = 'package.json pnpm-lock.yaml';
        }

        return `# Multi-stage build for SvelteKit
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY ${packageFiles} ./

# Install dependencies
RUN ${installCommand}

# Copy source code
COPY . .

# Build SvelteKit application
RUN ${buildCommand}

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json

# Expose port
EXPOSE 3000

# Set NODE_ENV
ENV NODE_ENV=production

# Start SvelteKit
CMD ["node", "build"]
`;
    }

    /**
     * Generate backend Dockerfile
     */
    static generateBackendDockerfile(backend: DetectedBackend): string {
        const { language, framework } = backend;

        switch (language) {
            case 'node':
                return this.generateNodeBackendDockerfile(backend);
            case 'python':
                return this.generatePythonBackendDockerfile(backend);
            case 'go':
                return this.generateGoBackendDockerfile(backend);
            case 'java':
                return this.generateJavaBackendDockerfile(backend);
            case 'php':
                return this.generatePHPBackendDockerfile(backend);
            case 'dotnet':
                return this.generateDotNetBackendDockerfile(backend);
            case 'ruby':
                return this.generateRubyBackendDockerfile(backend);
            case 'rust':
                return this.generateRustBackendDockerfile(backend);
            case 'elixir':
                return this.generateElixirBackendDockerfile(backend);
            case 'haskell':
                return this.generateHaskellBackendDockerfile(backend);
            default:
                return this.generateNodeBackendDockerfile(backend);
        }
    }

    /**
     * Generate Node.js backend Dockerfile (2-stage build)
     */
    private static generateNodeBackendDockerfile(backend: DetectedBackend): string {
        const packageManager = backend.packageManager || 'npm';
        const entryPoint = backend.entryPoint || 'server.js';
        const port = this.detectPort(backend);

        let installDevCommand = 'npm ci';
        let installProdCommand = 'npm ci --only=production';
        let packageFiles = 'package*.json';

        if (packageManager === 'yarn') {
            installDevCommand = 'yarn install';
            installProdCommand = 'yarn install --production';
            packageFiles = 'package.json yarn.lock';
        } else if (packageManager === 'pnpm') {
            installDevCommand = 'pnpm install';
            installProdCommand = 'pnpm install --prod';
            packageFiles = 'package.json pnpm-lock.yaml';
        }

        // Detect if TypeScript or build step is needed
        const needsBuild = this.detectIfBuildNeeded(backend);

        if (needsBuild) {
            // Determine output entry point for TypeScript builds
            const builtEntry = entryPoint.replace(/\.ts$/, '.js');

            return `# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY ${packageFiles} ./

# Install all dependencies (including dev)
RUN ${installDevCommand}

# Copy source code
COPY . .

# Build application
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY ${packageFiles} ./

# Install production dependencies only
RUN ${installProdCommand}

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Expose port
EXPOSE ${port}

# Start application
CMD ["node", "dist/${builtEntry}"]
`;
        }

        // Simple Node.js without build step
        return `# Stage 1: Dependencies
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY ${packageFiles} ./

# Install production dependencies
RUN ${installProdCommand}

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy source code
COPY . .

# Expose port
EXPOSE ${port}

# Start application
CMD ["node", "${entryPoint}"]
`;
    }

    /**
     * Detect if backend needs a build step (TypeScript, etc.)
     */
    private static detectIfBuildNeeded(backend: DetectedBackend): boolean {
        if (!backend.dependencies) return false;

        // Check for TypeScript or build tools
        const buildIndicators = ['typescript', '@types/node', 'ts-node', 'tsc'];
        return Object.keys(backend.dependencies).some(dep => buildIndicators.includes(dep));
    }

    /**
     * Detect application port from source files
     */
    private static detectPort(backend: DetectedBackend, defaultPort: number = 3000): number {
        const fs = require('fs');
        const path = require('path');

        if (!backend.projectPath) return defaultPort;

        // Try to read entry point file
        const entryPoint = backend.entryPoint || 'server.js';
        const entryPath = path.join(backend.projectPath, entryPoint);

        try {
            if (fs.existsSync(entryPath)) {
                const content = fs.readFileSync(entryPath, 'utf-8');

                // Common port patterns for Node.js
                const nodePatterns = [
                    /PORT\s*=\s*process\.env\.PORT\s*\|\|\s*(\d+)/,
                    /port\s*=\s*process\.env\.PORT\s*\|\|\s*(\d+)/,
                    /listen\((\d+)/,
                    /PORT\s*=\s*(\d+)/,
                    /port\s*=\s*(\d+)/,
                ];

                // Common port patterns for Python
                const pythonPatterns = [
                    /port\s*=\s*(\d+)/i,
                    /PORT\s*=\s*(\d+)/,
                    /--port[=\s]+(\d+)/,
                    /uvicorn.*--port\s+(\d+)/,
                    /runserver.*:(\d+)/,
                ];

                const patterns = backend.language === 'python' ? pythonPatterns : nodePatterns;

                for (const pattern of patterns) {
                    const match = content.match(pattern);
                    if (match && match[1]) {
                        return parseInt(match[1], 10);
                    }
                }
            }
        } catch (error) {
            // If we can't read the file, return default
        }

        // Check package.json for port hints
        try {
            const packagePath = path.join(backend.projectPath, 'package.json');
            if (fs.existsSync(packagePath)) {
                const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));

                // Check scripts for port references
                if (packageContent.scripts) {
                    const scriptsStr = JSON.stringify(packageContent.scripts);
                    const portMatch = scriptsStr.match(/--port[=\s]+(\d+)/);
                    if (portMatch) {
                        return parseInt(portMatch[1], 10);
                    }
                }
            }
        } catch (error) {
            // Ignore errors
        }

        // Default ports by framework
        if (backend.framework === 'python-fastapi' || backend.framework === 'python-django') {
            return 8000;
        }
        if (backend.framework === 'python-flask') {
            return 5000;
        }

        return defaultPort;
    }

    /**
     * Generate Python backend Dockerfile (2-stage build)
     */
    private static generatePythonBackendDockerfile(backend: DetectedBackend): string {
        const { framework, packageManager, entryPoint } = backend;
        const port = this.detectPort(backend, 8000);

        let startCommand = 'python app.py';

        if (framework === 'python-fastapi') {
            const mainFile = entryPoint || 'main.py';
            const moduleName = mainFile.replace('.py', '');
            startCommand = `uvicorn ${moduleName}:app --host 0.0.0.0 --port ${port}`;
        } else if (framework === 'python-django') {
            startCommand = `python manage.py runserver 0.0.0.0:${port}`;
        } else if (framework === 'python-flask') {
            const mainFile = entryPoint || 'app.py';
            startCommand = `python ${mainFile}`;
        }

        if (packageManager === 'poetry') {
            return `# Stage 1: Build dependencies
FROM python:3.11-slim AS builder

WORKDIR /app

# Install poetry
RUN pip install poetry

# Copy poetry files
COPY pyproject.toml poetry.lock ./

# Install dependencies to a virtual environment
RUN poetry config virtualenvs.in-project true && \\
    poetry install --no-dev --no-root

# Stage 2: Production
FROM python:3.11-slim

WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder /app/.venv /app/.venv

# Copy source code
COPY . .

# Set PATH to use virtual environment
ENV PATH="/app/.venv/bin:$PATH"

# Expose port
EXPOSE ${port}

# Start application
CMD ${JSON.stringify(startCommand.split(' '))}
`;
        }

        return `# Stage 1: Build dependencies
FROM python:3.11-slim AS builder

WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install dependencies to a local directory
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Production
FROM python:3.11-slim

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /root/.local /root/.local

# Copy source code
COPY . .

# Update PATH to include user installed packages
ENV PATH=/root/.local/bin:$PATH

# Expose port
EXPOSE ${port}

# Start application
CMD ${JSON.stringify(startCommand.split(' '))}
`;
    }

    /**
     * Generate Go backend Dockerfile
     */
    private static generateGoBackendDockerfile(backend: DetectedBackend): string {
        const fs = require('fs');
        const path = require('path');
        let hasGoSum = true;

        if (backend.projectPath) {
            hasGoSum = fs.existsSync(path.join(backend.projectPath, 'go.sum'));
        }

        const copyCommand = hasGoSum ? 'COPY go.mod go.sum ./' : 'COPY go.mod ./';

        return `# Multi-stage build for Go
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy go mod files
${copyCommand}

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Production stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy binary from builder
COPY --from=builder /app/main .

# Expose port
EXPOSE 8000

# Start application
CMD ["./main"]
`;
    }

    /**
     * Generate Java backend Dockerfile
     */
    private static generateJavaBackendDockerfile(backend: DetectedBackend): string {
        const packageManager = backend.packageManager || 'maven';

        if (packageManager === 'gradle') {
            return `# Multi-stage build for Java (Gradle)
FROM gradle:8-jdk17 AS builder

WORKDIR /app

# Copy gradle files
COPY build.gradle settings.gradle ./

# Copy source code
COPY src ./src

# Build application
RUN gradle build --no-daemon

# Production stage
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Copy jar from builder
COPY --from=builder /app/build/libs/*.jar app.jar

# Expose port
EXPOSE 8080

# Start application
CMD ["java", "-jar", "app.jar"]
`;
        }

        return `# Multi-stage build for Java (Maven)
FROM maven:3-openjdk-17 AS builder

WORKDIR /app

# Copy pom.xml
COPY pom.xml .

# Download dependencies
RUN mvn dependency:go-offline

# Copy source code
COPY src ./src

# Build application
RUN mvn package

# Production stage
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Copy jar from builder
COPY --from=builder /app/target/*.jar app.jar

# Expose port
EXPOSE 8080

# Start application
CMD ["java", "-jar", "app.jar"]
`;
    }

    /**
     * Generate PHP backend Dockerfile
     */
    private static generatePHPBackendDockerfile(backend: DetectedBackend): string {
        return `# PHP backend Dockerfile
FROM php:8.2-fpm-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    git \
    curl \
    libpng-dev \
    libzip-dev \
    zip \
    unzip

# Install PHP extensions
RUN docker-php-ext-install pdo pdo_mysql zip

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Copy composer files
COPY composer.json composer.lock ./

# Install dependencies
RUN composer install --no-dev --optimize-autoloader

# Copy source code
COPY . .

# Expose port
EXPOSE 8000

# Start PHP server
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
`;
    }

    /**
     * Generate .NET backend Dockerfile
     */
    private static generateDotNetBackendDockerfile(backend: DetectedBackend): string {
        return `# Multi-stage build for .NET
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS builder

WORKDIR /app

# Copy csproj and restore
COPY *.csproj ./
RUN dotnet restore

# Copy everything else and build
COPY . ./
RUN dotnet publish -c Release -o out

# Production stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0

WORKDIR /app

# Copy from builder
COPY --from=builder /app/out .

# Expose port
EXPOSE 8080

# Start application
ENTRYPOINT ["dotnet", "YourApp.dll"]
`;
    }

    /**
     * Generate Ruby backend Dockerfile (2-stage build)
     */
    private static generateRubyBackendDockerfile(backend: DetectedBackend): string {
        return `# Stage 1: Build dependencies
FROM ruby:3.2-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache build-base postgresql-dev

# Copy Gemfile
COPY Gemfile Gemfile.lock ./

# Install gems to vendor/bundle
RUN bundle config set --local deployment 'true' && \\
    bundle config set --local without 'development test' && \\
    bundle install

# Stage 2: Production
FROM ruby:3.2-alpine

WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache postgresql-client

# Copy gems from builder
COPY --from=builder /usr/local/bundle /usr/local/bundle
COPY --from=builder /app/vendor/bundle /app/vendor/bundle

# Copy source code
COPY . .

# Expose port
EXPOSE 8000

# Start application
CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0"]
`;
    }

    /**
     * Generate Rust backend Dockerfile
     */
    private static generateRustBackendDockerfile(backend: DetectedBackend): string {
        return `# Multi-stage build for Rust
FROM rust:1.75-slim-bookworm as builder

WORKDIR /usr/src/app

COPY . .

# Build application
RUN cargo build --release

# Production stage
FROM debian:bookworm-slim

WORKDIR /usr/local/bin

# Copy binary from builder
COPY --from=builder /usr/src/app/target/release/* .

# Expose port
EXPOSE 8080

# Start application (assumes binary name matches package name or generic run)
CMD ["./app"] 
# Note: You might need to change "./app" to your actual binary name
`;
    }

    /**
     * Generate Elixir (Phoenix) Dockerfile
     */
    private static generateElixirBackendDockerfile(backend: DetectedBackend): string {
        return `# Multi-stage build for Elixir
FROM elixir:1.14-alpine as builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache build-base git

# Install hex + rebar
RUN mix local.hex --force && \
    mix local.rebar --force

# Copy config files
COPY mix.exs mix.lock ./

# Install dependencies
RUN mix deps.get --only prod
RUN mix deps.compile

# Copy source
COPY . .

# Build release
RUN mix release

# Production stage
FROM alpine:3.17

WORKDIR /app

RUN apk add --no-cache libstdc++ ncurses-libs openssl javascript

COPY --from=builder /app/_build/prod/rel/app ./

EXPOSE 4000

CMD ["bin/server", "start"]
`;
    }

    /**
     * Generate Haskell Dockerfile
     */
    private static generateHaskellBackendDockerfile(backend: DetectedBackend): string {
        return `# Multi-stage build for Haskell
FROM haskell:9.4 as builder

WORKDIR /app

COPY . .

# Install dependencies and build
RUN cabal update && \
    cabal build --enable-executable-stripping

# Production stage
FROM debian:bullseye-slim

WORKDIR /app

# Copy binary (Adjust path based on your project structure)
COPY --from=builder /app/dist-newstyle/build/*/*/bin/* ./app

EXPOSE 8080

CMD ["./app"]
`;
    }

    /**
     * Generate .dockerignore file
     */
    static generateDockerignore(): string {
        return `# Dependencies
node_modules
npm-debug.log
yarn-error.log
pnpm-debug.log

# Testing
coverage
.nyc_output

# Environment files
.env
.env.local
.env.*.local

# Editor directories
.vscode
.idea
*.swp
*.swo

# Version control
.git
.gitignore

# OS files
.DS_Store
Thumbs.db

# Build artifacts (will be built in container)
dist
build
out
.next

# Logs
logs
*.log

# Docker files (prevent recursive copies)
Dockerfile
docker-compose.yml
.dockerignore
`;
    }
}
