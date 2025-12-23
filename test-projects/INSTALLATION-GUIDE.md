# Auto-Docker Extension Installation & Usage Guide

## Why Dockerfiles Are Not Generated

The Auto-Docker extension requires **manual installation and execution** because:

1. **Extension must be installed first** - The .vsix file needs to be installed into VS Code
2. **Interactive UI required** - The extension needs user interaction to configure API keys and options
3. **Per-project execution** - Each project must be opened individually in VS Code
4. **Cannot be automated** - VS Code extensions cannot be triggered via command-line for batch operations

## Installation Steps

### 1. Install the Extension

```powershell
# From the Auto-Docker-main directory:
code --install-extension auto-docker-extension-2.7.0.vsix --force
```

### 2. Configure API Keys (First Time Only)

1. Open VS Code
2. Press `Ctrl+Shift+P`
3. Type: `Auto Docker: Configure API Keys`
4. Enter your API keys (Gemini/OpenAI)

### 3. Generate Dockerfiles for Test Projects

You have **two options**:

#### Option A: Use Helper Script (Recommended)

```powershell
cd test-projects
.\generate-all-dockerfiles.ps1
```

This script will:
- List all 50 test projects
- Prompt to open each project in VS Code
- Guide you through running the extension
- Track your progress

#### Option B: Manual Generation

For each project:
1. Open project folder in VS Code: `code test-projects/frontend/01-react-vite`
2. Press `Ctrl+Shift+P`
3. Type: `Auto Docker: Analyze Project & Generate Docker Files`
4. Wait for generation to complete
5. Repeat for all 50 projects

## Available Commands

The extension provides these commands:

- `Auto Docker: Analyze Project & Generate Docker Files` - Main command
- `Auto Docker: Regenerate Docker Files` - Regenerate existing files
- `Auto Docker: Generate Docker Files (Direct Mode)` - Skip analysis
- `Auto Docker: Generate Docker Files (Two-Step AI)` - Advanced generation
- `Auto Docker: Configure API Keys` - Set up API keys

## Testing Workflow

### Step 1: Install Extension
```powershell
code --install-extension auto-docker-extension-2.7.0.vsix --force
```

### Step 2: Configure API Keys
Run in VS Code: `Ctrl+Shift+P` → `Auto Docker: Configure API Keys`

### Step 3: Generate Dockerfiles
```powershell
cd test-projects
.\generate-all-dockerfiles.ps1
```

### Step 4: Check Progress
```powershell
.\check-dockerfiles.ps1
```

### Step 5: Validate Generated Files
```powershell
.\validate-all-docker.ps1
```

### Step 6: Run Complete Tests
```powershell
.\run-all-tests.ps1
```

## Quick Start Commands

```powershell
# Install extension
cd C:\Home\code\Extension\Auto-Docker-main
code --install-extension auto-docker-extension-2.7.0.vsix --force

# Start generating Dockerfiles
cd test-projects
.\generate-all-dockerfiles.ps1

# Check status anytime
.\check-dockerfiles.ps1
```

## Troubleshooting

### Extension Not Found
- Restart VS Code after installation
- Verify installation: `code --list-extensions`

### API Key Errors
- Configure keys: `Ctrl+Shift+P` → `Auto Docker: Configure API Keys`
- Ensure you have valid Gemini or OpenAI API key

### Generation Fails
- Check project structure (package.json, etc.)
- Try different generation modes (Direct Mode or Two-Step AI)
- Check VS Code output panel for errors

## Notes

- **50 Projects**: Generating all will take time (manual process)
- **Interactive**: Each generation may prompt for options
- **API Costs**: Using AI services may incur costs
- **Batch Processing**: Helper script makes it easier but still requires manual intervention

## Alternative: Bulk Generation Script (Advanced)

If you want to attempt automated generation (experimental):

```powershell
# This would require programmatic access to VS Code commands
# Currently not supported by the extension
```

---

**Status**: Ready to install extension and begin Dockerfile generation
**Next Step**: Run installation command and configure API keys
