# Generate Dockerfiles for All Test Projects
# Helper script to open projects in VS Code for Dockerfile generation

$ErrorActionPreference = 'Continue'
$testProjectsRoot = $PSScriptRoot

Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'Auto-Docker Dockerfile Generator' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

Write-Host 'This script will guide you through generating Dockerfiles.' -ForegroundColor Yellow
Write-Host ''
Write-Host 'Prerequisites:' -ForegroundColor White
Write-Host '  1. VS Code with Auto-Docker extension installed' -ForegroundColor White
Write-Host '  2. Extension activated and ready to use' -ForegroundColor White
Write-Host ''

Write-Host 'Instructions:' -ForegroundColor Cyan
Write-Host '  For each project:' -ForegroundColor White
Write-Host '  1. Open the project folder in VS Code' -ForegroundColor White
Write-Host '  2. Run Auto-Docker command (Ctrl+Shift+P)' -ForegroundColor White
Write-Host '  3. Wait for Dockerfile generation' -ForegroundColor White
Write-Host '  4. Move to next project' -ForegroundColor White
Write-Host ''

Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'PROJECT LIST' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

# Get all projects
$frontendProjects = Get-ChildItem -Path "$testProjectsRoot\frontend" -Directory -ErrorAction SilentlyContinue
$backendProjects = Get-ChildItem -Path "$testProjectsRoot\backend" -Directory -ErrorAction SilentlyContinue
$fullstackProjects = Get-ChildItem -Path "$testProjectsRoot\fullstack" -Directory -ErrorAction SilentlyContinue

$categories = @{
    'Frontend' = $frontendProjects
    'Backend' = $backendProjects
    'Fullstack' = $fullstackProjects
}

$projectIndex = 1
$totalProjects = $frontendProjects.Count + $backendProjects.Count + $fullstackProjects.Count

Write-Host "Total projects to process: $totalProjects" -ForegroundColor Cyan
Write-Host ''

foreach ($category in $categories.Keys) {
    Write-Host "[$category]" -ForegroundColor Yellow
    foreach ($project in $categories[$category]) {
        Write-Host "  $projectIndex. $($project.Name)" -ForegroundColor White
        Write-Host "     Path: $($project.FullName)" -ForegroundColor Gray
        $projectIndex++
    }
    Write-Host ''
}

Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'BATCH PROCESS HELPER' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

$response = Read-Host 'Would you like to open projects one by one in VS Code? (y/n)'

if ($response -eq 'y' -or $response -eq 'Y') {
    $currentIndex = 1
    foreach ($category in $categories.Keys) {
        foreach ($project in $categories[$category]) {
            Write-Host ''
            Write-Host "[$currentIndex/$totalProjects] Processing: $($project.Name)" -ForegroundColor Cyan
            Write-Host "Category: $category" -ForegroundColor Gray
            Write-Host 'Opening in VS Code...' -ForegroundColor Yellow
            
            # Open project in VS Code
            & code $project.FullName
            
            Write-Host ''
            Write-Host 'Please:' -ForegroundColor Yellow
            Write-Host '  1. Wait for VS Code to open' -ForegroundColor White
            Write-Host '  2. Run Auto-Docker command' -ForegroundColor White
            Write-Host '  3. Wait for Dockerfile generation' -ForegroundColor White
            Write-Host '  4. Press Enter to continue...' -ForegroundColor White
            
            Read-Host
            $currentIndex++
        }
    }
    
    Write-Host ''
    Write-Host '========================================' -ForegroundColor Green
    Write-Host 'All projects processed!' -ForegroundColor Green
    Write-Host '========================================' -ForegroundColor Green
    Write-Host ''
} else {
    Write-Host ''
    Write-Host 'You can manually open each project folder.' -ForegroundColor Yellow
    Write-Host 'Use the project list above as a reference.' -ForegroundColor Yellow
    Write-Host ''
}

Write-Host 'Next step: Run check-dockerfiles.ps1 to verify generation' -ForegroundColor Cyan
Write-Host ''
