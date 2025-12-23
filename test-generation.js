/**
 * Test Docker Generation
 * Tests the extension on sample projects
 */

const path = require('path');
const fs = require('fs');

// Import the detection and generation classes
const { EnhancedDetectionEngine } = require('./dist/extension.js');
const { DockerGenerationOrchestrator } = require('./dist/extension.js');

async function testProject(projectPath, projectName) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${projectName}`);
    console.log(`Path: ${projectPath}`);
    console.log('='.repeat(60));

    try {
        // Create orchestrator
        const orchestrator = new DockerGenerationOrchestrator(projectPath);
        
        // Generate files
        const result = await orchestrator.generate();
        
        if (result.success) {
            console.log('✅ Generation SUCCESS');
            console.log(`\nGenerated files:`);
            
            if (result.files.dockerfile) {
                console.log('  - Dockerfile');
                const dockerfilePath = path.join(projectPath, 'Dockerfile.test');
                fs.writeFileSync(dockerfilePath, result.files.dockerfile);
            }
            
            if (result.files.dockerCompose) {
                console.log('  - docker-compose.yml');
                const composePath = path.join(projectPath, 'docker-compose.test.yml');
                fs.writeFileSync(composePath, result.files.dockerCompose);
            }
            
            if (result.files.nginxConf) {
                console.log('  - nginx.conf');
            }
            
            if (result.warnings.length > 0) {
                console.log(`\n⚠️  Warnings: ${result.warnings.length}`);
                result.warnings.forEach(w => console.log(`  - ${w}`));
            }
            
            if (result.detectionResult) {
                console.log(`\nDetected:`);
                console.log(`  - Project Type: ${result.detectionResult.projectType}`);
                if (result.detectionResult.frontend) {
                    console.log(`  - Frontend: ${result.detectionResult.frontend.framework}`);
                    console.log(`  - Output: ${result.detectionResult.frontend.outputFolder}`);
                }
                if (result.detectionResult.backend) {
                    console.log(`  - Backend: ${result.detectionResult.backend.framework}`);
                    console.log(`  - Entry: ${result.detectionResult.backend.entryPoint || 'server.js'}`);
                }
                if (result.detectionResult.databases.length > 0) {
                    console.log(`  - Databases: ${result.detectionResult.databases.map(db => db.type).join(', ')}`);
                }
            }
            
            return true;
        } else {
            console.log('❌ Generation FAILED');
            return false;
        }
    } catch (error) {
        console.log(`❌ ERROR: ${error.message}`);
        console.error(error);
        return false;
    }
}

async function runTests() {
    const basePath = __dirname;
    
    const projects = [
        {
            path: path.join(basePath, 'test-projects', 'backend', '01-node-express'),
            name: 'Node.js Express Backend'
        },
        {
            path: path.join(basePath, 'test-projects', 'backend', '02-fastapi-python'),
            name: 'Python FastAPI Backend'
        },
        {
            path: path.join(basePath, 'test-projects', 'frontend', '01-react-vite'),
            name: 'React Vite Frontend'
        }
    ];
    
    console.log('🚀 Starting Docker Generation Tests...\n');
    
    let passed = 0;
    let failed = 0;
    
    for (const project of projects) {
        const success = await testProject(project.path, project.name);
        if (success) {
            passed++;
        } else {
            failed++;
        }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${passed + failed}`);
}

runTests().catch(console.error);
