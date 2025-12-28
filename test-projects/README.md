# Auto-Docker Extension Test Suite

This directory contains 50 diverse test projects to comprehensively test the Auto-Docker extension.

## 🚀 Quick Start

### 1. Check Your Environment
```bash
./check-environment.sh
```
This will verify:
- Docker is installed and running
- Required tools (jq, curl) are available
- Sufficient disk space
- How many projects have Dockerfiles

### 2. Run Comprehensive Tests
```bash
./comprehensive-test.sh
```
This will:
- Test all 50 projects (frontend, backend, fullstack)
- Build Docker images
- Run containers and check health
- Test endpoints
- Log everything to a single file
- Generate JSON and CSV reports

### 3. View Results
```bash
./view-results.sh
```
Interactive menu to:
- View test summary
- See failed/passed tests
- Analyze build times
- Export reports

**See [TESTING-GUIDE.md](TESTING-GUIDE.md) for detailed documentation.**

## Project Structure

```
test-projects/
├── frontend/           # 15 Frontend Projects
├── backend/            # 15 Backend Projects
├── fullstack/          # 20 Full-Stack & Monorepo Projects
└── scripts/            # Test automation scripts
```

## Projects Overview

### Frontend Projects (15)
1. **01-react-vite** - React with Vite
2. **02-react-cra** - Create React App
3. **03-vue3-vite** - Vue 3 with Vite
4. **04-angular** - Angular 17
5. **05-nextjs** - Next.js 14
6. **06-svelte-vite** - Svelte with Vite
7. **07-nuxt** - Nuxt 3
8. **08-gatsby** - Gatsby
9. **09-solid-vite** - Solid.js with Vite
10. **10-preact-vite** - Preact with Vite
11. **11-remix** - Remix
12. **12-ember** - Ember.js
13. **13-static-html** - Static HTML/CSS/JS
14. **14-webpack-react** - React with Webpack
15. **15-astro** - Astro

### Backend Projects (15)
1. **01-node-express** - Node.js with Express
2. **02-fastapi-python** - Python FastAPI
3. **03-flask-python** - Python Flask
4. **04-django-python** - Python Django
5. **05-go-gin** - Go with Gin
6. **06-spring-boot-java** - Java Spring Boot
7. **07-nestjs** - NestJS (TypeScript)
8. **08-ruby-rails** - Ruby on Rails
9. **09-rust-actix** - Rust with Actix-web
10. **10-php-laravel** - PHP Laravel
11. **11-dotnet-api** - .NET 8 API
12. **12-kotlin-ktor** - Kotlin Ktor
13. **13-elixir-phoenix** - Elixir Phoenix
14. **14-scala-play** - Scala Play Framework
15. **15-haskell-servant** - Haskell Servant

### Full-Stack & Monorepo Projects (20)
1. **01-mern-stack** - MongoDB + Express + React + Node
2. **02-mean-stack** - MongoDB + Express + Angular + Node
3. **03-turborepo-monorepo** - Turborepo monorepo
4. **04-nx-monorepo** - Nx monorepo
5. **05-t3-stack** - T3 Stack (Next.js + tRPC)
6. **06-lerna-monorepo** - Lerna monorepo
7. **07-nextjs-postgres** - Next.js + PostgreSQL + Prisma
8. **08-django-react** - Django + React
9. **09-spring-react** - Spring Boot + React
10. **10-vue-express** - Vue + Express
11. **11-angular-nest** - Angular + NestJS
12. **12-svelte-fastapi** - Svelte + FastAPI
13. **13-remix-prisma** - Remix + Prisma + PostgreSQL
14. **14-go-react** - Go + React
15. **15-rust-react** - Rust + React
16. **16-pnpm-workspace** - PNPM workspace monorepo
17. **17-yarn-workspaces** - Yarn workspaces monorepo
18. **18-nuxt-supabase** - Nuxt + Supabase
19. **19-sveltekit-postgres** - SvelteKit + PostgreSQL
20. **20-solidstart** - SolidStart

## Testing Workflow

### Step 1: Generate Dockerfiles

Run the generation helper script:
```powershell
.\generate-dockerfiles.ps1
```

This script will help you:
- Open each project in VS Code
- Remind you to run the Auto-Docker extension
- Track progress through all 50 projects

**OR** manually:
1. Open each project folder in VS Code
2. Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac)
3. Run: "Auto-Docker: Generate Dockerfile"
4. Wait for generation to complete
5. Repeat for all projects

### Step 2: Validate Dockerfiles

Quick validation of generated Dockerfiles:
```powershell
# Validate all projects
.\validate-docker.ps1

# Validate single project
.\validate-docker.ps1 -ProjectPath ".\frontend\01-react-vite"

# Validate and cleanup images
.\validate-docker.ps1 -CleanupImages
```

### Step 3: Run Full Test Suite

Execute comprehensive tests:
```powershell
.\run-tests.ps1
```

This will:
- Check if Dockerfiles were generated
- Build Docker images for each project
- Run containers to verify functionality
- Generate detailed test reports
- Provide success/failure statistics

## Test Reports

After running tests, you'll find:

- **test-results.json** - Detailed JSON report with all test data
- **test-results.csv** - CSV format for spreadsheet analysis
- Console output with real-time progress and summary

## Success Criteria

A project passes if:
1. ✅ Dockerfile is generated
2. ✅ Docker image builds successfully
3. ✅ Container starts without errors
4. ✅ Container runs for at least 5 seconds

## Requirements

- **VS Code** with Auto-Docker extension installed
- **Docker Desktop** installed and running
- **PowerShell** 5.1 or later
- **Disk Space**: ~10-20GB for building all images

## Tips

1. **Run tests in batches** if disk space is limited
2. **Clean up images** between test runs using:
   ```powershell
   docker system prune -a --volumes -f
   ```
3. **Check individual failures** using the detailed JSON report
4. **Test categories separately** by modifying scripts to focus on frontend, backend, or fullstack

## Troubleshooting

**Issue**: Docker build fails
- Check if Docker Desktop is running
- Verify disk space availability
- Check project-specific requirements (Node.js, Python, etc.)

**Issue**: Extension doesn't generate Dockerfile
- Verify extension is installed and activated
- Check extension logs in VS Code Output panel
- Ensure project structure is recognized

**Issue**: Container fails to start
- Check container logs: `docker logs <container-name>`
- Verify port conflicts
- Check if project requires environment variables

## Expected Results

Based on the extension's capabilities, you should expect:
- **Dockerfile Generation**: 95-100% success rate
- **Docker Build**: 85-95% success rate
- **Container Run**: 80-90% success rate

Some projects may require additional configuration (environment variables, databases, etc.) to run successfully.

## Contributing

To add more test projects:
1. Create project directory in appropriate category folder
2. Add minimal working code
3. Update this README with project details
4. Test with the extension

## License

These test projects are for testing purposes only. Each technology has its own license.
