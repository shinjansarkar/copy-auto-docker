# AutoDocker Extension - Fullstack Projects Test Suite

This directory contains automated testing scripts for the AutoDocker extension across all 20 fullstack test projects.

## Test Scripts

### 1. Interactive Test Script (Recommended)
**File**: `test-fullstack-interactive.sh`

This is a semi-automated script that handles building, running, and testing, but pauses for you to manually trigger the extension.

#### Usage:
```bash
./test-fullstack-interactive.sh
```

#### How It Works:
1. **For each project** (all 20 sequentially):
   - Cleans up any existing Docker files
   - Opens the project in VS Code
   - **PAUSES** and prompts you to:
     - Press `Ctrl+Shift+P`
     - Run: `Auto Docker: Generate Docker Files (Direct Mode)`
     - Press ENTER when complete
   - Automatically verifies generated files
   - Builds Docker images
   - Starts containers with `docker-compose up -d`
   - Checks if containers are running
   - Shows container status
   - Stops and cleans up containers
   - Moves to next project

2. **Final Summary**:
   - Shows passed/failed counts
   - Lists all results
   - Saves detailed logs

#### Features:
- ✅ Colored output for easy reading
- ✅ Detailed logging for each project
- ✅ Automatic cleanup between tests
- ✅ Container health verification
- ✅ Error logs captured
- ✅ Success rate calculation

### 2. Sequential Test Script (Advanced)
**File**: `test-fullstack-sequential.sh`

Fully automated but requires manual triggering for each project.

## Test Results

All test results are saved to: `test-results/`

### Log Files Created:
- `test_run_YYYYMMDD_HHMMSS.log` - Main test log
- `{project-name}_build.log` - Docker build output
- `{project-name}_start.log` - Container startup output
- `{project-name}_status.log` - Container status
- `{project-name}_error.log` - Error logs if failed

## Prerequisites

1. **Extension Installed**:
   ```bash
   code --install-extension auto-docker-extension-2.7.0.vsix --force
   ```

2. **Docker Running**:
   ```bash
   docker --version
   docker-compose --version
   ```

3. **VS Code Installed**:
   ```bash
   code --version
   ```

## Test Projects

The script tests all 20 fullstack projects:

1. **01-mern-stack** - MongoDB + Express + React + Node
2. **02-mean-stack** - MongoDB + Express + Angular + Node
3. **03-turborepo-monorepo** - Turborepo workspace
4. **04-nx-monorepo** - Nx workspace
5. **05-t3-stack** - Next.js + tRPC + Prisma
6. **06-lerna-monorepo** - Lerna workspace
7. **07-nextjs-postgres** - Next.js + PostgreSQL
8. **08-django-react** - Django + React
9. **09-spring-react** - Spring Boot + React
10. **10-vue-express** - Vue 3 + Express
11. **11-angular-nest** - Angular + NestJS
12. **12-svelte-fastapi** - Svelte + FastAPI
13. **13-remix-prisma** - Remix + Prisma
14. **14-go-react** - Go + React
15. **15-rust-react** - Rust + React
16. **16-pnpm-workspace** - pnpm workspace
17. **17-yarn-workspaces** - Yarn workspaces
18. **18-nuxt-supabase** - Nuxt + Supabase
19. **19-sveltekit-postgres** - SvelteKit + PostgreSQL
20. **20-solidstart** - SolidStart

## Quick Start

### Run the Interactive Test:
```bash
# Navigate to the extension directory
cd /home/shinjan/Code/Extention/copy-auto-docker

# Run the test
./test-fullstack-interactive.sh
```

### What to Expect:
1. Script starts and cleans up first project
2. VS Code opens with the project
3. You see a prompt asking you to generate Docker files
4. You trigger: `Ctrl+Shift+P` → `Auto Docker: Generate Docker Files (Direct Mode)`
5. Press ENTER when done
6. Script automatically builds, runs, and tests
7. Moves to next project automatically
8. Repeat steps 2-7 for all 20 projects

### Stopping the Test:
- Press `Ctrl+C` to stop at any time
- Current containers will be cleaned up automatically

## Viewing Results

### During Test:
- Watch the terminal for real-time colored output
- Green ✓ = Success
- Red ✗ = Failure
- Yellow ! = Warning
- Blue = Info

### After Test:
```bash
# View main log
cat test-results/test_run_*.log

# View specific project build log
cat test-results/01-mern-stack_build.log

# View failed project logs
cat test-results/*_error.log
```

## Troubleshooting

### Issue: Docker build fails
**Solution**: Check the build log in `test-results/{project}_build.log`

### Issue: Containers won't start
**Solution**: 
1. Check ports aren't already in use: `docker ps`
2. View start log: `cat test-results/{project}_start.log`
3. Check Docker daemon: `systemctl status docker`

### Issue: Extension not generating files
**Solution**:
1. Verify extension is installed: `code --list-extensions | grep auto-docker`
2. Reinstall extension: `code --install-extension auto-docker-extension-2.7.0.vsix --force`
3. Restart VS Code

### Issue: Permission denied
**Solution**:
```bash
chmod +x test-fullstack-interactive.sh
```

## Manual Testing (Single Project)

If you want to test just one project manually:

```bash
# 1. Navigate to project
cd test-projects/fullstack/01-mern-stack

# 2. Clean up
rm -f docker-compose.yml nginx.conf
find . -name "Dockerfile" -delete

# 3. Open in VS Code
code .

# 4. Generate files
# Ctrl+Shift+P → "Auto Docker: Generate Docker Files (Direct Mode)"

# 5. Build and run
docker-compose build
docker-compose up -d

# 6. Check status
docker-compose ps

# 7. View logs
docker-compose logs

# 8. Stop
docker-compose down -v
```

## Success Criteria

A project **PASSES** if:
- ✅ Docker files are generated successfully
- ✅ Docker images build without errors
- ✅ Containers start successfully
- ✅ At least one container is running
- ✅ Containers can be stopped cleanly

A project **FAILS** if:
- ❌ Files are not generated
- ❌ Build fails with errors
- ❌ Containers fail to start
- ❌ No containers are running after startup

## Advanced Usage

### Test Specific Projects Only:
Edit the script and modify the projects array:
```bash
# Only test these projects
local projects=(
    "$TEST_DIR/01-mern-stack"
    "$TEST_DIR/07-nextjs-postgres"
)
```

### Skip Cleanup:
Comment out the cleanup line in the script:
```bash
# cleanup_docker_files "$project_dir"
```

### Extended Wait Times:
Increase sleep duration in `start_containers` function:
```bash
sleep 10  # Instead of sleep 5
```

## Support

For issues or questions:
1. Check `test-results/` logs
2. Review Docker logs: `docker-compose logs`
3. Check extension logs in VS Code Output panel
4. Open an issue on GitHub

---

**Happy Testing! 🐳✨**
