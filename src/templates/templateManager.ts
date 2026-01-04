/**
 * Template Manager
 * 
 * Manages all Dockerfile and configuration templates.
 * RULE: All generated files MUST come from templates - no dynamic generation.
 * Templates are production-ready and support multi-stage builds by default.
 */

export interface TemplateContext {
    // Frontend context
    framework?: string;
    variant?: string;
    packageManager?: 'npm' | 'yarn' | 'pnpm';
    buildCommand?: string;
    installCommand?: string;
    outputFolder?: string;
    port?: number;

    // Backend context
    language?: 'node' | 'python' | 'java' | 'go' | 'php' | 'dotnet' | 'ruby' | 'elixir' | 'rust' | 'haskell' | 'kotlin' | 'scala';
    backendFramework?: string;
    entryPoint?: string;

    // Common
    serviceName?: string;
    workingDir?: string;
    envVars?: Record<string, string>;
}

/**
 * Template Manager - Main Class
 */
export class TemplateManager {

    /**
     * Get frontend Dockerfile template
     * RULE: Templates only - no dynamic generation
     */
    static getFrontendTemplate(context: TemplateContext): string {
        const { framework, variant, packageManager = 'npm', outputFolder = 'dist' } = context;

        // Special SSR frameworks
        if (framework === 'nextjs' && variant === 'ssr') {
            return this.getNextJsSSRTemplate(context);
        }

        if (framework === 'nuxt') {
            return this.getNuxtSSRTemplate(context);
        }

        if (framework === 'sveltekit') {
            return this.getSvelteKitTemplate(context);
        }

        // Default static frontend template
        return this.getStaticFrontendTemplate(context);
    }

    /**
     * Get backend Dockerfile template
     */
    static getBackendTemplate(context: TemplateContext): string {
        const { language, backendFramework } = context;

        switch (language) {
            case 'node':
                return this.getNodeBackendTemplate(context);
            case 'python':
                return this.getPythonBackendTemplate(context);
            case 'java':
                return this.getJavaBackendTemplate(context);
            case 'go':
                return this.getGoBackendTemplate(context);
            case 'ruby':
                return this.getRubyBackendTemplate(context);
            case 'php':
                return this.getPhpBackendTemplate(context);
            case 'dotnet':
                return this.getDotnetBackendTemplate(context);
            case 'rust':
                return this.getRustBackendTemplate(context);
            case 'elixir':
                return this.getElixirBackendTemplate(context);
            default:
                throw new Error(`Unsupported backend language: ${language}`);
        }
    }

    /**
     * TEMPLATE: Static Frontend (React, Vue, Angular, etc.)
     */
    private static getStaticFrontendTemplate(context: TemplateContext): string {
        const { packageManager = 'npm', installCommand, buildCommand, outputFolder = 'dist' } = context;

        const packageFiles = packageManager === 'yarn' ? 'package.json yarn.lock' :
            packageManager === 'pnpm' ? 'package.json pnpm-lock.yaml' :
                'package*.json';

        const install = installCommand || `${packageManager} install`;
        const build = buildCommand || `${packageManager} run build`;

        return `# Multi-stage build for static frontend
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY ${packageFiles} ./

# Install dependencies
RUN ${install}

# Copy source code
COPY . .

# Build application
RUN ${build}

# Stage 2: Production with Nginx
FROM nginx:alpine

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder
COPY --from=builder /app/${outputFolder} /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \\
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
`;
    }

    /**
     * TEMPLATE: Next.js SSR
     */
    private static getNextJsSSRTemplate(context: TemplateContext): string {
        const { packageManager = 'npm', installCommand } = context;

        const packageFiles = packageManager === 'yarn' ? 'package.json yarn.lock' :
            packageManager === 'pnpm' ? 'package.json pnpm-lock.yaml' :
                'package*.json';

        const install = installCommand || `${packageManager} install`;

        return `# Multi-stage build for Next.js SSR
# Stage 1: Dependencies
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files
COPY ${packageFiles} ./

# Install dependencies
RUN ${install}

# Stage 2: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY . .

# Build Next.js application
RUN ${packageManager} run build

# Stage 3: Production
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \\
    CMD wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1

# Start application
CMD ["node", "server.js"]
`;
    }

    /**
     * TEMPLATE: Nuxt SSR
     */
    private static getNuxtSSRTemplate(context: TemplateContext): string {
        const { packageManager = 'npm', installCommand } = context;

        const packageFiles = packageManager === 'yarn' ? 'package.json yarn.lock' :
            packageManager === 'pnpm' ? 'package.json pnpm-lock.yaml' :
                'package*.json';

        const install = installCommand || `${packageManager} install`;

        return `# Multi-stage build for Nuxt SSR
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY ${packageFiles} ./

# Install dependencies
RUN ${install}

# Copy source
COPY . .

# Build Nuxt application
RUN ${packageManager} run build

# Production stage
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy built application
COPY --from=builder /app/.output ./

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \\
    CMD wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1

# Start Nuxt
CMD ["node", "server/index.mjs"]
`;
    }

    /**
     * TEMPLATE: SvelteKit
     */
    private static getSvelteKitTemplate(context: TemplateContext): string {
        const { packageManager = 'npm', installCommand } = context;

        const packageFiles = packageManager === 'yarn' ? 'package.json yarn.lock' :
            packageManager === 'pnpm' ? 'package.json pnpm-lock.yaml' :
                'package*.json';

        const install = installCommand || `${packageManager} install`;

        return `# Multi-stage build for SvelteKit
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY ${packageFiles} ./

# Install dependencies
RUN ${install}

# Copy source
COPY . .

# Build SvelteKit application
RUN ${packageManager} run build

# Production stage
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy built application
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \\
    CMD wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1

# Start SvelteKit
CMD ["node", "build"]
`;
    }

    /**
     * TEMPLATE: Node.js Backend
     */
    private static getNodeBackendTemplate(context: TemplateContext): string {
        const { packageManager = 'npm', installCommand, entryPoint = 'server.js', port = 3000 } = context;

        const packageFiles = packageManager === 'yarn' ? 'package.json yarn.lock' :
            packageManager === 'pnpm' ? 'package.json pnpm-lock.yaml' :
                'package*.json';

        const install = installCommand || `${packageManager} install --production`;

        return `# Multi-stage build for Node.js backend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY ${packageFiles} ./

# Install ALL dependencies (including dev for build)
RUN ${packageManager} install

# Copy source
COPY . .

# Build and prepare production files
RUN if [ -f "tsconfig.json" ]; then ${packageManager} run build || true; fi && \\
    mkdir -p /app/prod && \\
    (cp -r dist /app/prod/ 2>/dev/null || true) && \\
    (cp -r src /app/prod/ 2>/dev/null || true) && \\
    (cp *.js /app/prod/ 2>/dev/null || true) && \\
    (cp ${entryPoint} /app/prod/ 2>/dev/null || true)

# Production stage
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy package files
COPY ${packageFiles} ./

# Install production dependencies only
RUN ${install}

# Copy built files or source
COPY --from=builder /app/prod ./

# Expose port
EXPOSE ${port}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \\
    CMD wget --quiet --tries=1 --spider http://localhost:${port}/health || exit 1

# Start application
CMD ["node", "${entryPoint}"]
`;
    }

    /**
     * TEMPLATE: Python Backend
     */
    private static getPythonBackendTemplate(context: TemplateContext): string {
        const { backendFramework = 'fastapi', entryPoint = 'main.py', port = 8000 } = context;

        const command = backendFramework === 'django' ?
            'python manage.py runserver 0.0.0.0:8000' :
            backendFramework === 'flask' ?
                'python app.py' :
                'uvicorn main:app --host 0.0.0.0 --port 8000';

        return `# Multi-stage build for Python backend
FROM python:3.11-slim AS builder

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    gcc \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --user --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV PATH=/root/.local/bin:$PATH

# Copy installed packages from builder
COPY --from=builder /root/.local /root/.local

# Copy application code
COPY . .

# Expose port
EXPOSE ${port}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \\
    CMD wget --quiet --tries=1 --spider http://localhost:${port}/health || exit 1

# Start application
CMD ["${command}"]
`;
    }

    /**
     * TEMPLATE: Ruby Backend (Rails)
     */
    private static getRubyBackendTemplate(context: TemplateContext): string {
        const { backendFramework = 'rails', port = 3000 } = context;

        return `# Multi-stage build for Ruby backend
FROM ruby:3.2-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \\
    build-base \\
    postgresql-dev \\
    nodejs \\
    yarn

# Copy Gemfile
COPY Gemfile Gemfile.lock ./

# Install gems
RUN bundle config set --local deployment 'true' && \\
    bundle config set --local without 'development test' && \\
    bundle install

# Production stage
FROM ruby:3.2-alpine

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \\
    postgresql-client \\
    nodejs \\
    tzdata

# Copy installed gems from builder
COPY --from=builder /usr/local/bundle /usr/local/bundle

# Copy application code
COPY . .

# Precompile assets (Rails)
RUN if [ -f "bin/rails" ]; then \\
        RAILS_ENV=production bundle exec rails assets:precompile || true; \\
    fi

# Expose port
EXPOSE ${port}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \\
    CMD wget --quiet --tries=1 --spider http://localhost:${port}/ || exit 1

# Start Rails with Puma
CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0"]
`;
    }

    /**
     * TEMPLATE: Java Backend (Spring Boot)
     */
    private static getJavaBackendTemplate(context: TemplateContext): string {
        return `# Multi-stage build for Java backend
FROM maven:3.9-eclipse-temurin-17 AS builder

WORKDIR /app

# Copy pom.xml
COPY pom.xml .

# Download dependencies
RUN mvn dependency:go-offline

# Copy source
COPY src ./src

# Build application
RUN mvn clean package -DskipTests

# Production stage
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Copy JAR from builder
COPY --from=builder /app/target/*.jar app.jar

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \\
    CMD wget --quiet --tries=1 --spider http://localhost:8080/actuator/health || exit 1

# Start application
CMD ["java", "-jar", "app.jar"]
`;
    }

    /**
     * TEMPLATE: Go Backend
     */
    private static getGoBackendTemplate(context: TemplateContext): string {
        return `# Multi-stage build for Go backend
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source
COPY . .

# Build binary
RUN CGO_ENABLED=0 GOOS=linux go build -o main .

# Production stage
FROM alpine:latest

WORKDIR /app

# Install ca-certificates
RUN apk --no-cache add ca-certificates

# Copy binary from builder
COPY --from=builder /app/main .

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1

# Start application
CMD ["./main"]
`;
    }

    /**
     * TEMPLATE: PHP Backend (Laravel)
     */
    private static getPhpBackendTemplate(context: TemplateContext): string {
        return `# Multi-stage build for PHP backend
FROM php:8.2-fpm AS builder

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \\
    git \\
    curl \\
    libpng-dev \\
    libonig-dev \\
    libxml2-dev \\
    zip \\
    unzip

# Install PHP extensions
RUN docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Copy composer files
COPY composer.json composer.lock ./

# Install dependencies
RUN composer install --no-dev --optimize-autoloader

# Copy application
COPY . .

# Production stage
FROM php:8.2-fpm

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \\
    libpng-dev \\
    && docker-php-ext-install pdo_mysql

# Copy application from builder
COPY --from=builder /app ./

# Expose port
EXPOSE 9000

# Start PHP-FPM
CMD ["php-fpm"]
`;
    }

    /**
     * TEMPLATE: .NET Backend
     */
    private static getDotnetBackendTemplate(context: TemplateContext): string {
        return `# Multi-stage build for .NET backend
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS builder

WORKDIR /app

# Copy csproj and restore
COPY *.csproj ./
RUN dotnet restore

# Copy source and build
COPY . ./
RUN dotnet publish -c Release -o out

# Production stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0

WORKDIR /app

# Copy published app
COPY --from=builder /app/out .

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \\
    CMD curl --fail http://localhost/health || exit 1

# Start application
ENTRYPOINT ["dotnet", "app.dll"]
`;
    }

    /**
     * TEMPLATE: Rust Backend
     */
    private static getRustBackendTemplate(context: TemplateContext): string {
        return `# Multi-stage build for Rust backend
FROM rust:1.75-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache musl-dev

# Copy Cargo files
COPY Cargo.toml Cargo.lock ./

# Copy source
COPY src ./src

# Build release binary
RUN cargo build --release

# Production stage
FROM alpine:latest

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/target/release/app ./

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1

# Start application
CMD ["./app"]
`;
    }

    /**
     * TEMPLATE: Elixir Backend (Phoenix)
     */
    private static getElixirBackendTemplate(context: TemplateContext): string {
        return `# Multi-stage build for Elixir backend
FROM elixir:1.15-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN mix local.hex --force && \\
    mix local.rebar --force

# Copy mix files
COPY mix.exs mix.lock ./

# Install dependencies
RUN mix deps.get --only prod

# Copy source
COPY . .

# Compile and build release
RUN MIX_ENV=prod mix compile && \\
    MIX_ENV=prod mix release

# Production stage
FROM alpine:latest

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache openssl ncurses-libs

# Copy release from builder
COPY --from=builder /app/_build/prod/rel/app ./

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \\
    CMD wget --quiet --tries=1 --spider http://localhost:4000/health || exit 1

# Start application
CMD ["./bin/app", "start"]
`;
    }
}
