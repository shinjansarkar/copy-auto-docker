# Quick Start Guide - Testing Auto-Docker Extension

## Prerequisites
- ✅ VS Code installed
- ✅ Auto-Docker extension (.vsix) installed
- ✅ Docker Desktop running

## One-Time Setup (5 minutes)

All 50 test projects are already created! No need to run npm install or setup dependencies.

## Testing Process

### Option 1: Automated Testing (Recommended)

```powershell
# 1. Navigate to test-projects directory
cd test-projects

# 2. Generate Dockerfiles for all projects (interactive)
.\generate-dockerfiles.ps1

# 3. Run comprehensive tests
.\run-tests.ps1

# 4. View results
# Check test-results.json and test-results.csv for detailed analysis
```

### Option 2: Manual Testing

1. **Open a project**:
   ```powershell
   code .\test-projects\frontend\01-react-vite
   ```

2. **Generate Dockerfile**:
   - Press `Ctrl+Shift+P`
   - Type "Auto-Docker"
   - Select "Auto-Docker: Generate Dockerfile"

3. **Test Docker build**:
   ```powershell
   docker build -t test-app .
   docker run -p 3000:3000 test-app
   ```

4. **Repeat for other projects**

## Project Categories

### Test Different Types:
- **Frontend** (15): React, Vue, Angular, Next.js, Svelte, etc.
- **Backend** (15): Node, Python, Go, Java, Rust, PHP, etc.
- **Full-Stack** (20): MERN, MEAN, Turborepo, Nx, etc.

## Quick Commands

```powershell
# Validate all Dockerfiles quickly
.\validate-docker.ps1

# Clean up Docker images
docker system prune -a --volumes -f

# Check Docker status
docker ps -a
docker images
```

## Expected Timeline

- **Dockerfile Generation**: ~2-3 minutes per project (if using AI)
- **Testing All Projects**: ~2-3 hours (automated)
- **Manual Testing**: ~5-10 minutes per project

## Success Indicators

Look for:
- ✅ Dockerfile created in each project
- ✅ `docker build` completes successfully
- ✅ Container starts without errors
- ✅ Application runs (check logs)

## Common Issues

**"Docker build failed"**
- Ensure Docker Desktop is running
- Check disk space (need ~20GB)

**"Extension doesn't detect project"**
- Check if package.json or requirements.txt exists
- Verify VS Code opened the project folder

**"Container exits immediately"**
- Normal for some projects (they need env vars or databases)
- Check `docker logs <container-name>` for details

## Results Tracking

After running tests:
1. Open `test-results.csv` in Excel/Google Sheets
2. Filter by success/failure
3. Analyze by category (Frontend/Backend/Fullstack)
4. Share results with the team

## Next Steps

1. ✅ Run tests on all 50 projects
2. ✅ Document any failures
3. ✅ Test edge cases
4. ✅ Provide feedback on extension improvements

## Support

If you encounter issues:
1. Check project-specific README files
2. Review Docker logs
3. Check extension output in VS Code
4. Document unexpected behaviors for improvement
