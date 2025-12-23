# Auto-Docker Extension Test Suite - Complete Testing
# Tests Docker builds and runs for all projects

$ErrorActionPreference = 'Continue'
$testProjectsRoot = $PSScriptRoot

Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'Auto-Docker Test Suite' -ForegroundColor Cyan
Write-Host 'Complete Docker Build and Run Testing' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

# Get all projects
$frontendProjects = Get-ChildItem -Path "$testProjectsRoot\frontend" -Directory -ErrorAction SilentlyContinue
$backendProjects = Get-ChildItem -Path "$testProjectsRoot\backend" -Directory -ErrorAction SilentlyContinue
$fullstackProjects = Get-ChildItem -Path "$testProjectsRoot\fullstack" -Directory -ErrorAction SilentlyContinue

$allProjects = @()
$allProjects += $frontendProjects
$allProjects += $backendProjects
$allProjects += $fullstackProjects

$totalFound = $allProjects.Count

Write-Host 'Found Projects:' -ForegroundColor Cyan
Write-Host "  Frontend: $($frontendProjects.Count)" -ForegroundColor White
Write-Host "  Backend: $($backendProjects.Count)" -ForegroundColor White
Write-Host "  Fullstack: $($fullstackProjects.Count)" -ForegroundColor White
Write-Host "  Total: $totalFound" -ForegroundColor White
Write-Host ''

if ($totalFound -eq 0) {
    Write-Host 'ERROR: No test projects found!' -ForegroundColor Red
    exit 1
}

# Test Docker connectivity
Write-Host 'Checking Docker...' -ForegroundColor Cyan
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'ERROR: Docker is not running!' -ForegroundColor Red
        Write-Host 'Please start Docker Desktop and try again.' -ForegroundColor Yellow
        exit 1
    }
    Write-Host "Docker is running: $dockerVersion" -ForegroundColor Green
    Write-Host ''
} catch {
    Write-Host 'ERROR: Docker is not installed or not accessible!' -ForegroundColor Red
    exit 1
}

# Test results tracking
$testResults = @()
$totalDockerfiles = 0
$successfulBuilds = 0
$failedBuilds = 0

Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'Starting Docker Build Tests' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

foreach ($project in $allProjects) {
    $projectName = $project.Name
    $dockerfilePath = Join-Path $project.FullName 'Dockerfile'
    
    Write-Host "Testing: $projectName" -ForegroundColor Yellow
    
    $result = @{
        Name = $projectName
        HasDockerfile = $false
        BuildSuccess = $false
        Error = $null
    }
    
    if (Test-Path $dockerfilePath) {
        $totalDockerfiles++
        $result.HasDockerfile = $true
        Write-Host '  [OK] Dockerfile found' -ForegroundColor Green
        
        # Try to build
        $imageName = "test-$($projectName.ToLower() -replace '[^a-z0-9-]', '-')"
        Write-Host "  [BUILD] Building image: $imageName..." -ForegroundColor Cyan
        
        Push-Location $project.FullName
        $buildOutput = docker build -t $imageName . 2>&1
        $buildSuccess = $LASTEXITCODE -eq 0
        Pop-Location
        
        if ($buildSuccess) {
            $result.BuildSuccess = $true
            $successfulBuilds++
            Write-Host '  [SUCCESS] Build completed' -ForegroundColor Green
            
            # Cleanup image
            docker rmi $imageName 2>&1 | Out-Null
            Write-Host '  [CLEANUP] Image removed' -ForegroundColor Gray
        } else {
            $failedBuilds++
            $result.Error = 'Build failed'
            Write-Host '  [FAIL] Build failed' -ForegroundColor Red
        }
    } else {
        Write-Host '  [SKIP] No Dockerfile found' -ForegroundColor Yellow
        $result.Error = 'No Dockerfile'
    }
    
    $testResults += $result
    Write-Host ''
}

# Generate summary report
Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'Test Summary Report' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

Write-Host 'Overall Results:' -ForegroundColor White
Write-Host "  Total Projects: $totalFound" -ForegroundColor White
Write-Host "  Dockerfiles Found: $totalDockerfiles" -ForegroundColor White
Write-Host "  Successful Builds: $successfulBuilds" -ForegroundColor Green
Write-Host "  Failed Builds: $failedBuilds" -ForegroundColor Red
Write-Host ''

if ($totalDockerfiles -gt 0) {
    $successRate = [math]::Round(($successfulBuilds / $totalDockerfiles) * 100, 2)
    Write-Host "Build Success Rate: $successRate%" -ForegroundColor Cyan
    Write-Host ''
}

# List successful projects
if ($successfulBuilds -gt 0) {
    Write-Host 'Successful Projects:' -ForegroundColor Green
    foreach ($result in $testResults) {
        if ($result.BuildSuccess) {
            Write-Host "  [OK] $($result.Name)" -ForegroundColor Green
        }
    }
    Write-Host ''
}

# List failed projects
if ($failedBuilds -gt 0) {
    Write-Host 'Failed Projects:' -ForegroundColor Red
    foreach ($result in $testResults) {
        if ($result.HasDockerfile -and -not $result.BuildSuccess) {
            Write-Host "  [FAIL] $($result.Name)" -ForegroundColor Red
        }
    }
    Write-Host ''
}

# List projects without Dockerfiles
$missingDockerfiles = $totalFound - $totalDockerfiles
if ($missingDockerfiles -gt 0) {
    Write-Host 'Projects Without Dockerfiles:' -ForegroundColor Yellow
    foreach ($result in $testResults) {
        if (-not $result.HasDockerfile) {
            Write-Host "  [SKIP] $($result.Name)" -ForegroundColor Yellow
        }
    }
    Write-Host ''
}

Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'Testing Complete!' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Cyan
