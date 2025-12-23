# Changelog

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
