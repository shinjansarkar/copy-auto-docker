# Automated Dockerfile Generation Script
# Attempts to generate Dockerfiles for all test projects using Auto-Docker extension

$ErrorActionPreference = 'Continue'
$testProjectsRoot = $PSScriptRoot

Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'Auto-Docker Automated Generation' -ForegroundColor Cyan
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

$totalProjects = $allProjects.Count

Write-Host "Total projects to process: $totalProjects" -ForegroundColor Cyan
Write-Host ''
Write-Host 'Starting automated generation...' -ForegroundColor Yellow
Write-Host 'Note: This will open each project in VS Code and attempt to trigger the extension.' -ForegroundColor Yellow
Write-Host ''

$currentIndex = 1
$successCount = 0
$failCount = 0

foreach ($project in $allProjects) {
    Write-Host "[$currentIndex/$totalProjects] Processing: $($project.Name)" -ForegroundColor Cyan
    
    # Open project in VS Code
    Write-Host '  Opening in VS Code...' -ForegroundColor Gray
    & code $project.FullName
    
    # Wait for VS Code to open
    Start-Sleep -Seconds 3
    
    # Try to trigger the Auto-Docker command
    Write-Host '  Please run in VS Code: Ctrl+Shift+P -> Auto Docker: Analyze Project' -ForegroundColor Yellow
    
    # Wait a bit for extension to process
    Start-Sleep -Seconds 2
    
    # Check if Dockerfile was created
    $dockerfilePath = Join-Path $project.FullName 'Dockerfile'
    if (Test-Path $dockerfilePath) {
        Write-Host '  [SUCCESS] Dockerfile generated!' -ForegroundColor Green
        $successCount++
    } else {
        Write-Host '  [PENDING] Dockerfile not found yet' -ForegroundColor Yellow
        Write-Host '  Please manually run: Ctrl+Shift+P -> Auto Docker: Analyze Project' -ForegroundColor Yellow
        
        # Wait for user to manually trigger
        Write-Host '  Press Enter when ready to continue...' -ForegroundColor White
        Read-Host
        
        # Check again
        if (Test-Path $dockerfilePath) {
            Write-Host '  [SUCCESS] Dockerfile confirmed!' -ForegroundColor Green
            $successCount++
        } else {
            Write-Host '  [SKIPPED] No Dockerfile found' -ForegroundColor Red
            $failCount++
        }
    }
    
    Write-Host ''
    $currentIndex++
}

# Summary
Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'Generation Summary' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host "Total Projects: $totalProjects" -ForegroundColor White
Write-Host "Successful: $successCount" -ForegroundColor Green
Write-Host "Failed/Skipped: $failCount" -ForegroundColor Red

if ($successCount -gt 0) {
    $successRate = [math]::Round(($successCount / $totalProjects) * 100, 2)
    Write-Host "Success Rate: $successRate%" -ForegroundColor Cyan
}

Write-Host ''
Write-Host 'Next step: Run check-dockerfiles.ps1 to verify generation' -ForegroundColor Yellow
Write-Host ''
