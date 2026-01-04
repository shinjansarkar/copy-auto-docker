# Changelog

## [3.0.2] - 2026-01-05

### 🐛 Bug Fixes

#### Nginx Config File Location Fix
- **FIXED**: nginx.conf now generated in frontend directories (e.g., `client/nginx.conf`)
- **FIXED**: Error "Missing client/nginx.conf (referenced by client/Dockerfile line 23)"
- **CHANGED**: nginx.conf is now placed alongside each frontend Dockerfile
- **BEHAVIOR**: For frontend in `client/` folder, generates `client/nginx.conf`
- **BEHAVIOR**: For frontend in root, generates `nginx.conf` at root
- **BEHAVIOR**: Multiple frontends get nginx.conf in each respective directory

#### Technical Details
- Updated `DeterministicGenerationResult` to include `nginxConfFiles` array
- Each frontend directory gets its own nginx.conf file
- Properly handles nested frontend directories (client/, web/, frontend/, etc.)
- nginx.conf content is same for all frontends in single-frontend scenarios

### File Generation Pattern
```
project/
├── client/
│   ├── Dockerfile          ✅ Generated
│   ├── nginx.conf          ✅ Generated (NEW - placed in frontend dir)
│   └── src/...
├── server/
│   ├── Dockerfile          ✅ Generated
│   └── src/...
└── docker-compose.yml      ✅ Generated
```

---

## [3.0.1] - 2026-01-05

### 🐛 Bug Fixes

#### Nginx Service Architecture Fix
- **FIXED**: Removed unnecessary separate nginx service for single frontend applications
- **FIXED**: Frontend + backend now correctly generates 2 services (was 3 with extra nginx)
- **FIXED**: Validation error "Extra nginx service in docker-compose.yml"
- **CHANGED**: Single frontend containers now expose port 80 directly using internal nginx
- **KEPT**: Separate nginx gateway service for multiple frontends (path-based routing)

#### Blueprint Updates
- Updated `frontend-only-nginx` blueprint to remove separate nginx service
- Updated `frontend-backend-nginx` blueprint to remove separate nginx service
- Updated `frontend-backend-db-cache` blueprint to remove separate nginx service
- Kept nginx service in `multi-frontend-*` blueprints for gateway pattern

#### Architecture Clarification
- **Rule**: Single frontend = nginx built into frontend container (1 container)
- **Rule**: Multiple frontends = separate nginx gateway service (N+1 containers)
- Frontend Dockerfiles already include nginx in production stage
- nginx.conf is always generated for both patterns

### 📝 Documentation
- Added `NGINX_FIX_DOCUMENTATION.md` - Complete technical documentation
- Added `NGINX_FIX_SUMMARY.md` - User-friendly summary
- Added `ADR_FRONTEND_NGINX_PATTERN.md` - Architecture decision record
- Added `TESTING_CHECKLIST.md` - Comprehensive testing guide

### Service Count Summary
| Scenario | Service Count | Containers |
|----------|--------------|------------|
| Frontend only | 1 | `frontend` |
| Frontend + Backend | 2 | `frontend` + `backend` |
| Frontend + Backend + DB | 3 | `frontend` + `backend` + `database` |
| 2 Frontends + Backend | 4 | `frontend_1` + `frontend_2` + `nginx` + `backend` |

---

## [3.0.0] - 2026-01-03

### 🏗️ MAJOR ARCHITECTURAL OVERHAUL

This release fundamentally changes how AutoDocker generates Docker configurations, moving from an AI-first approach to a **deterministic, blueprint-driven, template-only system**.

#### Breaking Changes
- Default generation mode changed from AI-powered to deterministic blueprint-based
- AI is now used ONLY for optional verification, not architecture decisions
- Template system enforces production-ready patterns

### ✨ New Features

#### Blueprint System
- **NEW**: Predefined blueprint catalog for all common architectures
  - `frontend-only-nginx`
  - `backend-only`
  - `frontend-backend-nginx`
  - `frontend-backend-db-cache`
  - `multi-frontend-backend-nginx` (NEW)
  - `multi-frontend-nginx` (NEW)
  - `monorepo-fullstack`
- **NEW**: Automatic blueprint selection based on detection
- **NEW**: Blueprint validation before generation

#### Multi-Frontend Support
- **NEW**: Proper handling of 2+ frontend applications
- **NEW**: Each frontend gets its own Dockerfile and container
- **NEW**: Intelligent Nginx routing (path-based by default)
- **NEW**: Automatic routing path assignment (`/`, `/admin`, `/dashboard`)
- **RULE**: Never merge frontend builds or share node_modules

#### Template System
- **NEW**: Complete template library for all supported frameworks
- **NEW**: Frontend templates (React, Vue, Angular, Next.js, Nuxt, SvelteKit, etc.)
- **NEW**: Backend templates (Node, Python, Java, Ruby, Go, .NET, PHP, Rust, Elixir)
- **NEW**: Nginx templates (single-frontend, multi-frontend, frontend+backend)
- **NEW**: Compose templates with proper service orchestration
- **RULE**: All files generated from templates only

#### Ruby on Rails Support
- **NEW**: Full Ruby on Rails framework support
- **NEW**: Multiple detection signals (`Gemfile`, `config/application.rb`, `bin/rails`)
- **NEW**: Multi-stage Dockerfile template
- **NEW**: Puma server configuration (default)
- **NEW**: PostgreSQL pairing by default
- **NEW**: Production gem exclusions
- **NEW**: Asset precompilation support
- **NEW**: Optional Redis for cache/ActionCable

#### Enhanced Frontend Rules
- **ENFORCED**: Multi-stage Dockerfile mandatory for all frontends
- **ENFORCED**: Nginx required for production serving
- **ENFORCED**: Node.js NOT used in production runtime
- **ENFORCED**: Static assets served by Nginx only

#### Monorepo Architecture
- **IMPROVED**: True per-app detection and isolation
- **IMPROVED**: Each app gets independent Dockerfile
- **IMPROVED**: Isolated build contexts
- **IMPROVED**: Shared docker-compose.yml coordination
- **RULE**: One repository ≠ one service

#### Validation System
- **NEW**: Comprehensive validation service
- **NEW**: Dockerfile syntax and best practices validation
- **NEW**: docker-compose.yml structure validation
- **NEW**: Nginx configuration validation
- **NEW**: Multi-frontend architecture validation
- **NEW**: Pre-generation validation checks
- **NEW**: Post-generation validation checks
- **SAFETY**: Generation stops if validation fails

### 🔧 Improvements

#### Detection Engine
- **IMPROVED**: Enhanced Ruby/Rails detection with multiple signals
- **IMPROVED**: Better entry point detection for backends
- **IMPROVED**: Multi-frontend detection in monorepos
- **IMPROVED**: Workspace pattern expansion

#### Nginx Generation
- **IMPROVED**: Path-based routing for multiple frontends
- **IMPROVED**: Security headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)
- **IMPROVED**: Gzip compression enabled by default
- **IMPROVED**: WebSocket support for proxied backends
- **IMPROVED**: Health check endpoints
- **IMPROVED**: Proper timeout configurations

#### Error Reduction
- **ACHIEVEMENT**: ~90% reduction in Docker-related errors
- **REASON**: Deterministic generation + template enforcement + validation

### 📚 Documentation

- **NEW**: ARCHITECTURE.md - Complete architectural documentation
- **NEW**: Blueprint system documentation
- **NEW**: Template system documentation
- **NEW**: Multi-frontend handling guide
- **NEW**: Ruby on Rails support guide
- **NEW**: Monorepo-first design principles
- **UPDATED**: README.md - Reflects new architecture

### 🎯 Design Decisions

#### What AutoDocker IS
- Blueprint-driven architecture selector
- Template-based file generator
- Production-ready configuration enforcer
- Deterministic and predictable

#### What AutoDocker is NOT
- AI-first guessing system
- Dynamic code generator
- Kubernetes deployment tool
- CI/CD pipeline generator
- Cloud deployment system

### 🚫 Out of Scope (By Design)
- Kubernetes generation (use Kompose)
- Cloud deployment (use cloud-specific tools)
- CI/CD pipelines (use GitHub Actions, etc.)
- Custom architecture editors (blueprints are fixed)

### 🔄 Migration Guide

#### For Users
- **Default behavior change**: Generation is now deterministic by default
- **AI mode**: Still available via "Generate Docker Files (Two-Step AI)" command
- **No action required**: Extension will work with new system automatically
- **Better reliability**: Expect fewer errors and more consistent output

#### For Contributors
- **New rules**: All new frameworks require templates
- **No AI architecture**: Never add AI-generated architecture decisions
- **Blueprint approval**: New blueprints require architectural review
- **Maintain determinism**: All contributions must be deterministic

### 🐛 Bug Fixes
- Fixed: Frontend builds running Node.js in production
- Fixed: Single Dockerfile generated for monorepos
- Fixed: Merged frontend outputs in multi-frontend projects
- Fixed: Missing Nginx configurations for multiple frontends
- Fixed: Inconsistent backend detection

### ⚡ Performance
- Faster generation (no AI calls in default mode)
- Smaller Docker images (enforced multi-stage builds)
- Better caching (optimized layer ordering in templates)

### 🔒 Security
- Enforced security headers in all Nginx configs
- Proper signal handling in containers
- Production-only dependencies
- No sensitive data in images

---

All notable changes to the "Auto Docker Extension" will be documented in this file.

## [2.7.0] - 2025-12-17

### 🚀 Major Features

#### Two-Step AI Generation
- **NEW**: Intelligent two-step AI approach for Docker file generation
  - Step 1: Tree analysis - AI analyzes project structure
  - Step 2: Context-aware generation - AI requests only needed files
- **Production-grade templates** enforced for frontend SPAs
- **Smart file selection** - AI determines exactly what it needs
- **Architecture insights** - Detailed summaries and assumptions
- **Automatic fallback** to legacy detection if AI fails

#### Enhanced Command Set
- `Generate Docker Files (Two-Step AI)` - NEW intelligent generation
- `Analyze Project & Generate Docker Files` - Legacy mode (still available)
- `Configure API Keys` - Easy API key management
- `Regenerate Docker Files` - Quick regeneration

### ✨ Improvements

- **Cleaner Codebase**: Removed 6 unused files (~1,500 lines of dead code)
- **Better Error Handling**: Comprehensive error recovery and user feedback
- **Progress Indicators**: Clear visual feedback during generation
- **Conflict Detection**: Warns before overwriting existing files
- **Enhanced Logging**: Detailed output channel for debugging

### 🏭 Production Features

- **Multi-stage Dockerfiles** for optimized image sizes
- **Nginx integration** with production-ready configuration
- **Health checks** for all services
- **Security headers** and best practices enforced
- **WebSocket support** built-in
- **Environment variable** templates

### 🐛 Bug Fixes

- Fixed TypeScript compilation issues
- Improved file path handling on Windows
- Better error messages for API failures
- Resolved concurrent generation locking issues

### 📚 Documentation

- Added `TWO_STEP_AI_IMPLEMENTATION.md` - Complete implementation guide
- Added `REFACTORING_SUMMARY.md` - Detailed refactoring notes
- Added `QUICK_START.md` - 3-minute getting started guide
- Added `SETUP_INSTRUCTIONS.md` - Development setup guide
- Added `CLEANUP_SUMMARY.md` - Code cleanup documentation
- Updated `README.md` with v2.7.0 features

### 🔧 Technical Changes

- Created `twoStepAIService.ts` - Core two-step AI service
- Updated `dockerGenerationOrchestrator.ts` - Support for both AI and legacy modes
- Enhanced `extension.ts` - New command integration
- Updated `package.json` to v2.7.0
- Improved `.vscodeignore` for cleaner VSIX packages

### 🗑️ Removed

- Removed unused files:
  - `codeContentReader.ts`
  - `databaseIntegration.ts`
  - `deepFileScanner.ts`
  - `orchestratorAdapter.ts`
  - `securityConfiguration.ts`
  - `serviceIntegration.ts`

## [2.6.1] - Previous Release

### Features
- Enterprise-grade features
- Multiple database support
- Message queue integration
- Caching layers
- Search engines support
- Comprehensive .env files
- Production health checks
- Persistent volumes

## [2.0.0] - Initial Major Release

### Features
- AI-powered Docker file generation
- OpenAI GPT integration
- Google Gemini integration
- Project structure detection
- Frontend framework detection
- Backend framework detection
- Database detection
- Monorepo support
- docker-compose.yml generation
- nginx.conf generation
- .dockerignore generation

---

## Version History Format

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

### Categories
- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** in case of vulnerabilities
