# Docker Validation Script
# Quick validation of Docker images without full test suite

param(
    [string]$ProjectPath = '',
    [switch]$CleanupImages = $false
)

$ErrorActionPreference = 'Continue'

function Test-DockerImage {
    param(
        [string]$path,
        [string]$name
    )
    
    Write-Host ''
    Write-Host "Validating: $name" -ForegroundColor Cyan
    
    $dockerfilePath = Join-Path $path 'Dockerfile'
    if (-not (Test-Path $dockerfilePath)) {
        Write-Host '  [SKIP] No Dockerfile found' -ForegroundColor Red
        return $false
    }
    
    Write-Host '  [OK] Dockerfile exists' -ForegroundColor Green
    
    # Check Dockerfile syntax
    $content = Get-Content $dockerfilePath -Raw
    if ($content -match 'FROM\s+\S+') {
        Write-Host '  [OK] Valid FROM instruction' -ForegroundColor Green
    } else {
        Write-Host '  [FAIL] Invalid Dockerfile syntax' -ForegroundColor Red
        return $false
    }
    
    # Try to build
    $imageName = "test-$($name.ToLower() -replace '[^a-z0-9-]', '-')"
    Write-Host "  [BUILD] Building: $imageName..." -ForegroundColor Yellow
    
    Push-Location $path
    docker build -t $imageName . 2>&1 | Out-Null
    $buildSuccess = $LASTEXITCODE -eq 0
    Pop-Location
    
    if ($buildSuccess) {
        Write-Host '  [SUCCESS] Build successful' -ForegroundColor Green
        
        if ($CleanupImages) {
            docker rmi $imageName 2>&1 | Out-Null
            Write-Host '  [CLEANUP] Image removed' -ForegroundColor Gray
        }
        
        return $true
    } else {
        Write-Host '  [FAIL] Build failed' -ForegroundColor Red
        return $false
    }
}

if ($ProjectPath) {
    # Test single project
    $projectName = Split-Path $ProjectPath -Leaf
    Test-DockerImage -path $ProjectPath -name $projectName
} else {
    # Test all projects
    Write-Host '========================================' -ForegroundColor Cyan
    Write-Host 'Docker Validation Suite' -ForegroundColor Cyan
    Write-Host '========================================' -ForegroundColor Cyan
    Write-Host ''
    
    $testRoot = $PSScriptRoot
    $allProjects = @()
    
    $allProjects += Get-ChildItem "$testRoot\frontend" -Directory -ErrorAction SilentlyContinue
    $allProjects += Get-ChildItem "$testRoot\backend" -Directory -ErrorAction SilentlyContinue
    $allProjects += Get-ChildItem "$testRoot\fullstack" -Directory -ErrorAction SilentlyContinue
    
    $successCount = 0
    $totalCount = $allProjects.Count
    
    foreach ($project in $allProjects) {
        $result = Test-DockerImage -path $project.FullName -name $project.Name
        if ($result) {
            $successCount++
        }
    }
    
    Write-Host ''
    Write-Host '========================================' -ForegroundColor Cyan
    Write-Host 'Validation Summary' -ForegroundColor Cyan
    Write-Host '========================================' -ForegroundColor Cyan
    Write-Host "Successful: $successCount / $totalCount" -ForegroundColor White
    
    if ($totalCount -gt 0) {
        $successRate = [math]::Round(($successCount / $totalCount) * 100, 2)
        Write-Host "Success Rate: $successRate%" -ForegroundColor White
    }
}
