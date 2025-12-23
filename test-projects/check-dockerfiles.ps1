# Check Dockerfile Generation Status
# Simple script to verify which projects have Dockerfiles

$ErrorActionPreference = 'Continue'
$testProjectsRoot = $PSScriptRoot

Write-Host '========================================'  -ForegroundColor Cyan
Write-Host 'Auto-Docker Dockerfile Check' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

# Get all projects
$frontendProjects = Get-ChildItem -Path "$testProjectsRoot\frontend" -Directory -ErrorAction SilentlyContinue
$backendProjects = Get-ChildItem -Path "$testProjectsRoot\backend" -Directory -ErrorAction SilentlyContinue
$fullstackProjects = Get-ChildItem -Path "$testProjectsRoot\fullstack" -Directory -ErrorAction SilentlyContinue

$totalFound = $frontendProjects.Count + $backendProjects.Count + $fullstackProjects.Count

Write-Host 'Found Projects:' -ForegroundColor Cyan
Write-Host "  Frontend: $($frontendProjects.Count)" -ForegroundColor White
Write-Host "  Backend: $($backendProjects.Count)" -ForegroundColor White
Write-Host "  Fullstack/Monorepo: $($fullstackProjects.Count)" -ForegroundColor White
Write-Host "  Total: $totalFound" -ForegroundColor White
Write-Host ''

if ($totalFound -eq 0) {
    Write-Host 'No test projects found!' -ForegroundColor Red
    exit 1
}

# Count generated Dockerfiles
$dockerfilesGenerated = 0
$allProjects = @()
$allProjects += $frontendProjects
$allProjects += $backendProjects
$allProjects += $fullstackProjects

foreach ($project in $allProjects) {
    $dockerfilePath = Join-Path $project.FullName 'Dockerfile'
    if (Test-Path $dockerfilePath) {
        $dockerfilesGenerated++
    }
}

Write-Host 'Docker Status:' -ForegroundColor Cyan
Write-Host "  Dockerfiles Generated: $dockerfilesGenerated / $totalFound" -ForegroundColor White
Write-Host ''

if ($dockerfilesGenerated -eq 0) {
    Write-Host 'WARNING: No Dockerfiles found!' -ForegroundColor Yellow
    Write-Host 'Please run the Auto-Docker extension on the test projects first.' -ForegroundColor Yellow
    Write-Host ''
    Write-Host 'To generate Dockerfiles:' -ForegroundColor Cyan
    Write-Host '  1. Open each project folder in VS Code' -ForegroundColor White
    Write-Host '  2. Run command: Auto-Docker: Generate Dockerfile' -ForegroundColor White
    Write-Host '  3. Wait for generation to complete' -ForegroundColor White
    Write-Host ''
    Write-Host 'Or use the helper script:' -ForegroundColor Cyan
    Write-Host '  .\generate-dockerfiles.ps1' -ForegroundColor White
    Write-Host ''
    exit 0
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

# Summary report
Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'Summary Report' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host "Total Projects: $totalFound" -ForegroundColor White
Write-Host "Dockerfiles Generated: $dockerfilesGenerated" -ForegroundColor White

$percentDockerfiles = [math]::Round(($dockerfilesGenerated / $totalFound) * 100, 2)
Write-Host "Generation Rate: $percentDockerfiles%" -ForegroundColor White
Write-Host ''

# List projects with Dockerfiles
Write-Host 'Projects WITH Dockerfiles:' -ForegroundColor Green
foreach ($project in $allProjects) {
    $dockerfilePath = Join-Path $project.FullName 'Dockerfile'
    if (Test-Path $dockerfilePath) {
        $relativePath = $project.FullName.Replace($testProjectsRoot, '').TrimStart('\')
        Write-Host "  [OK] $relativePath" -ForegroundColor Green
    }
}
Write-Host ''

# List projects without Dockerfiles
$missingCount = $totalFound - $dockerfilesGenerated
if ($missingCount -gt 0) {
    Write-Host 'Projects WITHOUT Dockerfiles:' -ForegroundColor Red
    foreach ($project in $allProjects) {
        $dockerfilePath = Join-Path $project.FullName 'Dockerfile'
        if (-not (Test-Path $dockerfilePath)) {
            $relativePath = $project.FullName.Replace($testProjectsRoot, '').TrimStart('\')
            Write-Host "  [MISSING] $relativePath" -ForegroundColor Red
        }
    }
    Write-Host ''
}

Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'Check Complete!' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Next Steps:' -ForegroundColor Cyan
Write-Host '  1. Review the projects list above' -ForegroundColor White
Write-Host '  2. Generate Dockerfiles for missing projects' -ForegroundColor White
Write-Host '  3. Use validate-docker.ps1 to test Dockerfile syntax' -ForegroundColor White
Write-Host ''
