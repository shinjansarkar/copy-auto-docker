#!/usr/bin/env node

/**
 * AutoDocker Extension - Fullstack Projects Automated Test
 * Tests all 20 fullstack projects sequentially
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// Configuration
const CONFIG = {
    testDir: '/home/shinjan/Code/Extention/copy-auto-docker/test-projects/fullstack',
    logDir: '/home/shinjan/Code/Extention/copy-auto-docker/test-results',
    extensionPath: '/home/shinjan/Code/Extention/copy-auto-docker/auto-docker-extension-2.7.0.vsix',
    timeout: 120000, // 2 minutes per project
    buildTimeout: 600000, // 10 minutes for building
};

// Test results
const results = {
    passed: [],
    failed: [],
    skipped: [],
    details: {}
};

// Colors
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
};

// Utility functions
function log(message, color = colors.reset) {
    const timestamp = new Date().toISOString();
    console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

function logInfo(message) { log(`[INFO] ${message}`, colors.blue); }
function logSuccess(message) { log(`[SUCCESS] ${message}`, colors.green); }
function logError(message) { log(`[ERROR] ${message}`, colors.red); }
function logWarning(message) { log(`[WARNING] ${message}`, colors.yellow); }

function separator() {
    console.log('\n' + '='.repeat(80) + '\n');
}

// Execute command with error handling
function exec(command, options = {}) {
    try {
        const result = execSync(command, {
            encoding: 'utf8',
            stdio: options.silent ? 'pipe' : 'inherit',
            ...options
        });
        return { success: true, output: result };
    } catch (error) {
        return { 
            success: false, 
            error: error.message,
            output: error.stdout || error.stderr || error.message
        };
    }
}

// Check if extension is installed
function checkExtension() {
    logInfo('Checking if AutoDocker extension is installed...');
    const result = exec('code --list-extensions', { silent: true });
    if (result.success && result.output.includes('ShinjanSarkar.auto-docker-extension')) {
        logSuccess('Extension is already installed');
        return true;
    }
    return false;
}

// Install extension
function installExtension() {
    logInfo(`Installing extension from: ${CONFIG.extensionPath}`);
    const result = exec(`code --install-extension "${CONFIG.extensionPath}" --force`);
    if (result.success) {
        logSuccess('Extension installed successfully');
        // Wait for extension to load
        exec('sleep 3');
        return true;
    } else {
        logError('Failed to install extension');
        return false;
    }
}

// Clean up existing Docker files
function cleanupDockerFiles(projectDir) {
    logInfo(`Cleaning up existing Docker files in ${path.basename(projectDir)}...`);
    
    try {
        // Remove docker-compose files
        ['docker-compose.yml', 'docker-compose.yaml'].forEach(file => {
            const filePath = path.join(projectDir, file);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        });
        
        // Remove nginx.conf
        const nginxPath = path.join(projectDir, 'nginx.conf');
        if (fs.existsSync(nginxPath)) {
            fs.unlinkSync(nginxPath);
        }
        
        // Remove .dockerignore files recursively
        function removeDockerfiles(dir) {
            const items = fs.readdirSync(dir);
            items.forEach(item => {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                    removeDockerfiles(fullPath);
                } else if (item === 'Dockerfile' || item === '.dockerignore') {
                    fs.unlinkSync(fullPath);
                }
            });
        }
        
        removeDockerfiles(projectDir);
        logSuccess('Cleanup completed');
        return true;
    } catch (error) {
        logError(`Cleanup failed: ${error.message}`);
        return false;
    }
}

// Generate Docker files by importing and running the extension directly
async function generateDockerFiles(projectDir) {
    const projectName = path.basename(projectDir);
    logInfo(`Generating Docker files for: ${projectName}`);
    
    try {
        // Import the extension's main module
        const extensionPath = '/home/shinjan/Code/Extention/copy-auto-docker/dist/extension.js';
        
        // We'll use a simpler approach: call the compiled extension code directly
        // First, let's check what files we need
        
        // Alternative: Use VS Code CLI with workspace
        const workspaceFile = path.join(projectDir, `${projectName}.code-workspace`);
        fs.writeFileSync(workspaceFile, JSON.stringify({
            folders: [{ path: "." }],
            settings: {
                "autoDocker.overwriteFiles": true,
                "autoDocker.includeNginx": true
            }
        }, null, 2));
        
        // Trigger generation via opening workspace and waiting
        logInfo('Opening project in VS Code...');
        exec(`code "${projectDir}" --new-window`);
        
        // Wait for manual generation or timeout
        logWarning('Waiting 45 seconds for Docker files to be generated...');
        logWarning('Please run: Ctrl+Shift+P -> "Auto Docker: Generate Docker Files (Direct Mode)"');
        
        await new Promise(resolve => setTimeout(resolve, 45000));
        
        // Check if files were generated
        const composeExists = fs.existsSync(path.join(projectDir, 'docker-compose.yml')) ||
                            fs.existsSync(path.join(projectDir, 'docker-compose.yaml'));
        
        if (composeExists) {
            logSuccess('Docker files generated successfully');
            return true;
        } else {
            logError('Docker files were not generated');
            return false;
        }
    } catch (error) {
        logError(`Generation failed: ${error.message}`);
        return false;
    }
}

// Build Docker images
function buildDockerImages(projectDir) {
    const projectName = path.basename(projectDir);
    logInfo(`Building Docker images for: ${projectName}`);
    
    const logFile = path.join(CONFIG.logDir, `${projectName}_build.log`);
    const result = exec(`cd "${projectDir}" && docker-compose build --no-cache 2>&1 | tee "${logFile}"`);
    
    if (result.success) {
        logSuccess('Docker images built successfully');
        return true;
    } else {
        logError('Failed to build Docker images');
        return false;
    }
}

// Start containers
function startContainers(projectDir) {
    const projectName = path.basename(projectDir);
    logInfo(`Starting containers for: ${projectName}`);
    
    const logFile = path.join(CONFIG.logDir, `${projectName}_start.log`);
    const result = exec(`cd "${projectDir}" && docker-compose up -d 2>&1 | tee "${logFile}"`);
    
    if (result.success) {
        exec('sleep 5'); // Wait for containers to start
        logSuccess('Containers started successfully');
        return true;
    } else {
        logError('Failed to start containers');
        return false;
    }
}

// Check container status
function checkContainers(projectDir) {
    const projectName = path.basename(projectDir);
    logInfo(`Checking container status for: ${projectName}`);
    
    const psResult = exec(`cd "${projectDir}" && docker-compose ps`, { silent: true });
    if (!psResult.success) {
        logError('Failed to check container status');
        return false;
    }
    
    const runningResult = exec(`cd "${projectDir}" && docker-compose ps --services --filter "status=running"`, { silent: true });
    const totalResult = exec(`cd "${projectDir}" && docker-compose ps --services`, { silent: true });
    
    const runningCount = runningResult.output.trim().split('\n').filter(l => l).length;
    const totalCount = totalResult.output.trim().split('\n').filter(l => l).length;
    
    logInfo(`Running containers: ${runningCount} / ${totalCount}`);
    console.log(psResult.output);
    
    if (runningCount > 0) {
        logSuccess('Containers are running');
        return true;
    } else {
        logError('No containers are running');
        // Show logs
        const logsResult = exec(`cd "${projectDir}" && docker-compose logs --tail=50`, { silent: true });
        console.log('Container logs:\n', logsResult.output);
        return false;
    }
}

// Stop containers
function stopContainers(projectDir) {
    const projectName = path.basename(projectDir);
    logInfo(`Stopping containers for: ${projectName}`);
    
    exec(`cd "${projectDir}" && docker-compose down -v --remove-orphans`);
    logSuccess('Containers stopped and cleaned up');
}

// Test a single project
async function testProject(projectDir) {
    const projectName = path.basename(projectDir);
    
    separator();
    logInfo(`Testing project: ${projectName}`);
    separator();
    
    const projectResult = {
        name: projectName,
        steps: {},
        success: false
    };
    
    try {
        // Step 1: Cleanup
        projectResult.steps.cleanup = cleanupDockerFiles(projectDir);
        
        // Step 2: Generate Docker files
        projectResult.steps.generation = await generateDockerFiles(projectDir);
        if (!projectResult.steps.generation) {
            throw new Error('Generation failed');
        }
        
        // Step 3: Build images
        projectResult.steps.build = buildDockerImages(projectDir);
        if (!projectResult.steps.build) {
            throw new Error('Build failed');
        }
        
        // Step 4: Start containers
        projectResult.steps.start = startContainers(projectDir);
        if (!projectResult.steps.start) {
            throw new Error('Start failed');
        }
        
        // Step 5: Check containers
        projectResult.steps.check = checkContainers(projectDir);
        if (!projectResult.steps.check) {
            throw new Error('Runtime check failed');
        }
        
        // Step 6: Stop containers
        stopContainers(projectDir);
        projectResult.steps.cleanup_final = true;
        
        projectResult.success = true;
        logSuccess(`✓ Project ${projectName} tested successfully!`);
        results.passed.push(projectName);
        
    } catch (error) {
        logError(`✗ Project ${projectName} failed: ${error.message}`);
        results.failed.push({ name: projectName, error: error.message });
        
        // Cleanup on failure
        try {
            stopContainers(projectDir);
        } catch (e) {
            // Ignore cleanup errors
        }
    }
    
    results.details[projectName] = projectResult;
    return projectResult.success;
}

// Main function
async function main() {
    separator();
    logInfo('AutoDocker Extension - Fullstack Projects Sequential Test');
    logInfo(`Test started at: ${new Date().toISOString()}`);
    separator();
    
    // Create log directory
    if (!fs.existsSync(CONFIG.logDir)) {
        fs.mkdirSync(CONFIG.logDir, { recursive: true });
    }
    
    // Check and install extension
    if (!checkExtension()) {
        if (!installExtension()) {
            logError('Cannot proceed without extension. Exiting.');
            process.exit(1);
        }
    }
    
    // Get list of projects
    const projects = fs.readdirSync(CONFIG.testDir)
        .filter(name => {
            const fullPath = path.join(CONFIG.testDir, name);
            return fs.statSync(fullPath).isDirectory();
        })
        .map(name => path.join(CONFIG.testDir, name))
        .sort();
    
    logInfo(`Found ${projects.length} fullstack projects to test`);
    separator();
    
    // Test each project
    for (let i = 0; i < projects.length; i++) {
        const projectDir = projects[i];
        logInfo(`Progress: ${i + 1} / ${projects.length}`);
        
        await testProject(projectDir);
        
        // Brief pause between projects
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Print summary
    separator();
    logInfo('TEST SUMMARY');
    separator();
    logSuccess(`Passed: ${results.passed.length}`);
    logError(`Failed: ${results.failed.length}`);
    logWarning(`Skipped: ${results.skipped.length}`);
    separator();
    
    if (results.passed.length > 0) {
        logInfo('Passed projects:');
        results.passed.forEach(proj => console.log(`  ${colors.green}✓${colors.reset} ${proj}`));
    }
    
    if (results.failed.length > 0) {
        logInfo('Failed projects:');
        results.failed.forEach(item => {
            console.log(`  ${colors.red}✗${colors.reset} ${item.name} - ${item.error}`);
        });
    }
    
    separator();
    logInfo(`Test completed at: ${new Date().toISOString()}`);
    
    // Save results
    const resultFile = path.join(CONFIG.logDir, `test_results_${Date.now()}.json`);
    fs.writeFileSync(resultFile, JSON.stringify(results, null, 2));
    logInfo(`Results saved to: ${resultFile}`);
    separator();
    
    // Exit with appropriate code
    process.exit(results.failed.length === 0 ? 0 : 1);
}

// Run
main().catch(error => {
    logError(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
});
