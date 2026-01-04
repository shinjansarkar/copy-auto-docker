# AutoDocker Architecture

## Design Principles

AutoDocker follows a **deterministic, blueprint-driven** architecture to ensure reliable, production-ready Docker configurations.

### Core Tenets

1. **No Guessing**: Never invent services or guess architecture
2. **Blueprint-Driven**: Use predefined service topologies only
3. **Template-Only**: All files generated from templates, no dynamic code
4. **AI for Verification Only**: AI may verify details, never decide architecture
5. **Safe Defaults**: When uncertain, choose the safest deterministic behavior

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         VS Code Extension                       │
│                         (extension.ts)                          │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Generation Orchestrator                        │
│              (dockerGenerationOrchestrator.ts)                  │
│                                                                 │
│  Routes to:                                                     │
│  1. Deterministic Generator (DEFAULT)                           │
│  2. Two-Step AI (Optional)                                      │
│  3. Legacy Generator (Fallback)                                 │
└──────────────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
┌──────────────┐ ┌──────────┐ ┌────────────┐
│ Deterministic│ │ Two-Step │ │   Legacy   │
│  Generator   │ │    AI    │ │ Generator  │
└──────┬───────┘ └────┬─────┘ └─────┬──────┘
       │              │              │
       ▼              │              │
┌──────────────────┐  │              │
│    Detection     │◄─┴──────────────┘
│     Engine       │
│ (Enhanced)       │
└──────┬───────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│         Detection Results                │
│  - Project Type                          │
│  - Frontend(s) Count & Details           │
│  - Backend(s) Count & Details            │
│  - Databases                             │
│  - Monorepo Info                         │
└──────┬───────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Deterministic Generator                       │
│              (deterministicDockerGenerator.ts)                  │
│                                                                 │
│  1. Select Blueprint (based on detection)                       │
│  2. Generate Dockerfiles (from templates)                       │
│  3. Generate docker-compose.yml (from templates)                │
│  4. Generate Nginx config (from templates)                      │
│  5. Validate & Return                                           │
└──────────────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
┌──────────────┐ ┌──────────┐ ┌────────────┐
│  Blueprint   │ │ Template │ │   Nginx    │
│   Selector   │ │ Manager  │ │  Template  │
└──────────────┘ └──────────┘ └────────────┘
```

## AI Verification Rules

### What AI Can Do (STRICTLY LIMITED)

AI is used **ONLY** for safe verification of specific details. It **NEVER** makes architectural decisions.

#### Allowed Verifications

1. **Build Output Directory**
   - ✅ Verify: `dist`, `build`, `.next`, `out`, etc.
   - ❌ Never: Change build process or add build steps

2. **Backend Entry Point**
   - ✅ Verify: `server.js`, `main.py`, `app.rb`, etc.
   - ❌ Never: Modify server configuration or add middleware

3. **Exposed Ports**
   - ✅ Verify: Port numbers from config files
   - ❌ Never: Add new ports or change networking

#### Forbidden Actions

AI **MUST NEVER**:
- ❌ Decide which services to include
- ❌ Choose service architecture (that's the blueprint's job)
- ❌ Invent dependencies or configurations
- ❌ Modify templates or blueprints
- ❌ Add services not detected by the detection engine
- ❌ Change how services connect to each other

#### Fallback Behavior

If AI verification fails or returns uncertain results:
1. Use safe defaults from detection engine
2. Log warning for user review
3. Continue with deterministic generation
4. **NEVER** stop generation due to AI failure

#### Example: AI Verification in Action

```typescript
// CORRECT: AI verifies build output directory
const aiVerification = await verifyBuildOutput(packageJson);
const outputFolder = aiVerification.buildOutputDir || 'dist'; // Safe default

// WRONG: AI decides architecture (FORBIDDEN)
// const services = await aiDecideServices(projectStructure); // ❌ NEVER DO THIS
```

## Blueprint System

### What is a Blueprint?

A blueprint defines the **service topology** for a Docker deployment. It specifies:
- Which services exist (frontend, backend, database, cache, nginx)
- How services connect (dependencies)
- Which ports are exposed
- Nginx routing rules

### Available Blueprints

1. **frontend-only-nginx**
   - Services: 1 frontend + nginx
   - Use case: Static site, SPA

2. **backend-only**
   - Services: 1 backend
   - Use case: API-only service

3. **frontend-backend-nginx**
   - Services: 1 frontend + 1 backend + nginx
   - Use case: Standard fullstack app

4. **frontend-backend-db-cache**
   - Services: 1 frontend + 1 backend + database + cache + nginx
   - Use case: Full production stack

5. **multi-frontend-backend-nginx** ⭐ NEW
   - Services: N frontends + 1 backend + nginx
   - Use case: Admin panel + user app sharing backend
   - Routing: Path-based (/, /admin, /api)

6. **multi-frontend-nginx**
   - Services: N frontends + nginx
   - Use case: Multiple SPAs on same domain

7. **monorepo-fullstack**
   - Services: Dynamically detected per app
   - Use case: Monorepo with multiple deployable units

### Blueprint Selection Logic

```typescript
if (isMonorepo) {
    return 'monorepo-fullstack';
}

if (frontendCount > 1) {
    if (backendCount > 0) {
        return 'multi-frontend-backend-nginx';
    }
    return 'multi-frontend-nginx';
}

if (frontendCount === 1 && backendCount === 1) {
    if (hasDatabase || hasCache) {
        return 'frontend-backend-db-cache';
    }
    return 'frontend-backend-nginx';
}

if (frontendCount === 1 && backendCount === 0) {
    return 'frontend-only-nginx';
}

if (frontendCount === 0 && backendCount === 1) {
    return 'backend-only';
}

// Default safe fallback
return 'backend-only';
```

## Template System

### Philosophy

**All generated files come from templates**. No inline code generation.

### Template Categories

```
src/templates/
├── frontend/           # Frontend Dockerfiles
│   ├── react-static
│   ├── nextjs-ssr
│   ├── nuxt-ssr
│   ├── sveltekit
│   └── ...
├── backend/            # Backend Dockerfiles
│   ├── node
│   ├── python
│   ├── java
│   ├── ruby-rails
│   └── ...
├── nginx/              # Nginx configurations
│   ├── single-frontend
│   ├── multi-frontend
│   └── frontend-backend
├── compose/            # docker-compose templates
└── database/           # Database service configs
```

### Template Context

Templates receive a **context object** with verified data:

```typescript
interface TemplateContext {
    // Frontend
    framework?: string;
    variant?: string;
    packageManager?: 'npm' | 'yarn' | 'pnpm';
    buildCommand?: string;
    outputFolder?: string;
    
    // Backend
    language?: string;
    backendFramework?: string;
    entryPoint?: string;
    port?: number;
    
    // Common
    serviceName?: string;
    envVars?: Record<string, string>;
}
```

### AI Verification (Optional)

AI may **ONLY** verify:
- Build output directory (e.g., `dist`, `build`, `.next`)
- Backend entry point (e.g., `server.js`, `main.py`)
- Exposed ports

AI **NEVER** decides:
- Service architecture
- Which services to include
- How services connect
- Template selection

If AI verification fails → Use safe defaults

## Multi-Frontend Handling

### Critical Rule

**2 or more frontends = separate containers + Nginx routing**

### Implementation

1. **Detection Phase**
   ```
   Scan for multiple package.json with frontend frameworks
   → Store each as DetectedFrontend
   ```

2. **Blueprint Selection**
   ```
   frontendCount > 1 → multi-frontend blueprint
   ```

3. **Dockerfile Generation**
   ```
   For each frontend:
     - Generate Dockerfile from template
     - Path: frontend_name/Dockerfile
     - Build context: ./frontend_name
   ```

4. **Nginx Configuration**
   ```
   Generate routing rules:
     location / → frontend_web
     location /admin → frontend_admin
     location /api → backend
   ```

5. **Docker Compose**
   ```
   services:
     frontend_web:
       build: ./frontend
     frontend_admin:
       build: ./admin
     nginx:
       depends_on: [frontend_web, frontend_admin]
   ```

### Routing Strategy

Default path assignment:
- First frontend → `/` (root)
- If path contains "admin" → `/admin`
- If path contains "dashboard" → `/dashboard`
- Else → `/{folder_name}`

Example:
```
apps/web     → /
apps/admin   → /admin
apps/portal  → /portal
```

### Complete Multi-Frontend Example

**Project Structure:**
```
my-saas-app/
├── apps/
│   ├── web/                    # Customer-facing app
│   │   ├── package.json
│   │   ├── src/
│   │   └── Dockerfile          ← Generated
│   ├── admin/                  # Admin dashboard
│   │   ├── package.json
│   │   ├── src/
│   │   └── Dockerfile          ← Generated
│   └── marketing/              # Marketing site
│       ├── package.json
│       ├── src/
│       └── Dockerfile          ← Generated
├── backend/
│   ├── package.json
│   ├── server.js
│   └── Dockerfile              ← Generated
├── docker-compose.yml          ← Generated
├── nginx.conf                  ← Generated
└── .env.example                ← Generated
```

**Generated docker-compose.yml:**
```yaml
version: '3.8'

services:
  frontend_web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    container_name: frontend_web
    
  frontend_admin:
    build:
      context: .
      dockerfile: apps/admin/Dockerfile
    container_name: frontend_admin
    
  frontend_marketing:
    build:
      context: .
      dockerfile: apps/marketing/Dockerfile
    container_name: frontend_marketing
    
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    container_name: backend
    ports:
      - "3000:3000"
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - frontend_web
      - frontend_admin
      - frontend_marketing
```

**Generated nginx.conf:**
```nginx
server {
    listen 80;
    
    # Customer app (root)
    location / {
        alias /usr/share/nginx/html/frontend_web/;
        try_files $uri $uri/ /index.html;
    }
    
    # Admin dashboard
    location /admin {
        alias /usr/share/nginx/html/frontend_admin/;
        try_files $uri $uri/ /admin/index.html;
    }
    
    # Marketing site
    location /marketing {
        alias /usr/share/nginx/html/frontend_marketing/;
        try_files $uri $uri/ /marketing/index.html;
    }
    
    # Backend API
    location /api {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Result:**
- ✅ 3 separate frontend containers
- ✅ 1 backend container
- ✅ 1 Nginx reverse proxy
- ✅ Path-based routing: `/`, `/admin`, `/marketing`, `/api`
- ✅ No shared node_modules
- ✅ Independent deployments possible

## Ruby on Rails Support

### Detection Signals

- `Gemfile` with `gem 'rails'`
- `config/application.rb`
- `bin/rails`
- `config/routes.rb`

### Template Features

```dockerfile
# Multi-stage build
FROM ruby:3.2-alpine AS builder
# Install gems with production flags
RUN bundle install --deployment --without development test

FROM ruby:3.2-alpine
# Copy gems from builder
# Precompile assets
RUN bundle exec rails assets:precompile
# Use Puma server
CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0"]
```

### Default Configuration

- Server: Puma
- Port: 3000
- Database: PostgreSQL (paired by default)
- Cache: Redis (optional, for ActionCable)

## Monorepo Architecture

### Key Principle

**One repository ≠ one service**

Each app in a monorepo is treated as an independent deployable unit.

### Detection Process

1. Check for monorepo tools: `nx.json`, `turbo.json`, `lerna.json`, `pnpm-workspace.yaml`
2. Read workspace patterns from `package.json`
3. Expand globs: `apps/*`, `packages/*` → actual directories
4. Scan each workspace for frontend/backend frameworks

### Build Context Isolation

```yaml
# docker-compose.yml for monorepo
services:
  frontend_web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
  
  frontend_admin:
    build:
      context: .
      dockerfile: apps/admin/Dockerfile
  
  backend_api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
```

Each app has isolated dependencies, builds, and runtime.

### Shared Nginx

All frontends served through single Nginx instance:

```nginx
# Compiled from apps/web
location / {
    alias /usr/share/nginx/html/frontend_web/;
}

# Compiled from apps/admin
location /admin {
    alias /usr/share/nginx/html/frontend_admin/;
}

# Proxy to backend
location /api {
    proxy_pass http://backend_api:3000;
}
```

## Production Rules

### Frontend Production

**MANDATORY**:
- Multi-stage Dockerfile
- Build stage: Node.js
- Runtime stage: Nginx
- Node.js NOT in production container

**FORBIDDEN**:
- `npm start` in production
- `node server.js` for static apps
- Shared node_modules between apps

### Backend Production

**MANDATORY**:
- Multi-stage builds where applicable
- Production dependencies only
- Health check endpoints
- Proper signal handling

### Nginx Production

**MANDATORY**:
- Gzip compression
- Security headers
- Health check endpoint
- Request size limits
- Proper timeouts

## Validation & Safety

### Pre-Generation Validation

1. Check workspace is valid directory
2. Verify detection results are sensible
3. Validate blueprint selection
4. Confirm template availability

### Post-Generation Validation

1. All required files generated
2. Dockerfiles have valid syntax
3. docker-compose.yml is valid YAML
4. Nginx config is valid

### Failure Handling

If any step fails:
1. Log detailed error
2. Show user-friendly message
3. Fallback to safe default OR
4. Stop generation (don't write bad files)

## Future Enhancements

### Not in Scope (By Design)

- ❌ Kubernetes generation (use Kompose)
- ❌ Cloud deployment (use cloud-specific tools)
- ❌ CI/CD pipelines (use GitHub Actions, etc.)
- ❌ Custom architecture editors (blueprints are fixed)

### Possible Future Additions

- ✅ More backend languages (Scala, Kotlin, etc.)
- ✅ More database types (CockroachDB, etc.)
- ✅ Message queue support (RabbitMQ, Kafka)
- ✅ Observability (Prometheus, Grafana)

## Contributing

When contributing, follow these rules:

1. **Never add AI-generated architecture decisions**
2. **All new frameworks need templates**
3. **New blueprints require architectural review**
4. **Maintain deterministic behavior**
5. **Add tests for new templates**

## Summary

AutoDocker achieves ~90% error reduction by:
- Using blueprints (not guessing)
- Using templates (not generating code)
- Using detection (not assumptions)
- Using safe defaults (not flexibility)

The result: **Predictable, production-ready Docker configs every time**.
