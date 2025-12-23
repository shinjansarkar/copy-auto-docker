const path = require('path');
const fs = require('fs');

// Ensure vscode mock is loaded
require('./node_modules/vscode/index.js');

// Import the detection and generation classes
const { EnhancedDetectionEngine, DockerGenerationOrchestrator } = require('./dist/extension.js');

async function testProject(projectPath, projectName) {
    // console.log(`Testing: ${projectName}`); // Reduce noise
    try {
        const orchestrator = new DockerGenerationOrchestrator(projectPath);
        const result = await orchestrator.generate();

        if (result.success) {
            // Basic validation: Check if files were actually populated in the result object
            if (!result.files.dockerfile && !result.files.frontendDockerfiles && !result.files.backendDockerfiles) {
                return { success: false, error: "No Dockerfiles generated" };
            }
            return { success: true, result };
        } else {
            return { success: false, error: "Generation returned success=false" };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function runAllTests() {
    const categories = ['frontend', 'backend', 'fullstack'];
    const summary = { passed: 0, failed: 0, total: 0, details: [] };

    console.log('🚀 Starting Comprehensive Docker Generation Tests...\n');

    for (const category of categories) {
        const catPath = path.join(__dirname, 'test-projects', category);
        if (!fs.existsSync(catPath)) continue;

        const projects = fs.readdirSync(catPath).filter(f => fs.statSync(path.join(catPath, f)).isDirectory());

        console.log(`\n📂 Testing Category: ${category} (${projects.length} projects)`);

        for (const project of projects) {
            const projectPath = path.join(catPath, project);
            const res = await testProject(projectPath, project);

            summary.total++;
            if (res.success) {
                summary.passed++;
                console.log(`  ✅ ${project.padEnd(30)} [Passed]`);
                if (res.result.detectionResult) {
                    // Optional: print specific detection info if interesting
                }
            } else {
                summary.failed++;
                console.log(`  ❌ ${project.padEnd(30)} [FAILED] - ${res.error}`);
                summary.details.push({ project, category, error: res.error });
            }
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('FINAL TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`📊 Total: ${summary.total}`);

    if (summary.failed > 0) {
        console.log('\nFailures:');
        summary.details.forEach(d => console.log(` - ${d.category}/${d.project}: ${d.error}`));
    }
}

runAllTests().catch(console.error);
