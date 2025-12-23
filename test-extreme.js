const fs = require('fs');
const path = require('path');

// Ensure vscode mock is loaded
require('./node_modules/vscode/index.js');

const { EnhancedDetectionEngine } = require('./dist/extension.js');

const EXTREME_DIR = path.join(__dirname, 'test-projects', 'extreme');

// Helper to create test files
function createTestDir(name, files) {
    const dir = path.join(EXTREME_DIR, name);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });

    Object.entries(files).forEach(([filepath, content]) => {
        const fullpath = path.join(dir, filepath);
        fs.mkdirSync(path.dirname(fullpath), { recursive: true });
        fs.writeFileSync(fullpath, content);
    });
    return dir;
}

async function runExtremeTests() {
    console.log('🔥 STARTING EXTREME STRESS TESTS 🔥\n');

    const scenarios = [
        {
            name: '01-identity-crisis',
            description: 'Folder has Node, Python, Go, and Java config files simultaneously',
            files: {
                'package.json': '{"name": "conflict", "dependencies": {"express": "*"}}',
                'requirements.txt': 'flask',
                'go.mod': 'module conflict\nrequire github.com/gin-gonic/gin v1.7.0',
                'pom.xml': '<project><dependencies><dependency><groupId>org.springframework.boot</groupId></dependency></dependencies></project>'
            }
        },
        {
            name: '02-malformed-json',
            description: 'package.json is invalid JSON',
            files: {
                'package.json': '{ this is not json ',
                'server.js': 'console.log("hi")'
            }
        },
        {
            name: '03-deeply-nested',
            description: 'Backend is hidden 5 levels deep',
            files: {
                'level1/level2/level3/level4/level5/app/package.json': '{"dependencies": {"express": "*"}}',
                'level1/level2/level3/level4/level5/app/server.js': 'require("express")'
            }
        },
        {
            name: '04-decoy-folders',
            description: 'Folder named "backend" is empty, real code is in "unknown-folder"',
            files: {
                'backend/.keep': '',
                'unknown-folder/package.json': '{"dependencies": {"express": "*"}}',
                'unknown-folder/index.js': 'console.log("real backend")'
            }
        },
        {
            name: '05-massive-monorepo',
            description: 'Monorepo with 50 microservices',
            files: {
                'package.json': '{"workspaces": ["packages/*"]}',
                ...Array.from({ length: 50 }).reduce((acc, _, i) => ({
                    ...acc,
                    [`packages/service-${i}/package.json`]: `{"name": "service-${i}", "dependencies": {"express": "*"}}`,
                    [`packages/service-${i}/server.js`]: 'console.log("service")'
                }), {})
            }
        },
        {
            name: '06-circular-symlink',
            description: 'Folder contains a symlink pointing to itself (Infinite Loop Risk)',
            // Note: Symlinks creation handled separately as node fs.writeFileSync writes text
            files: {
                'package.json': '{"dependencies": {"express": "*"}}'
            }
        }
    ];

    for (const scenario of scenarios) {
        console.log(`\n🧪 Testing Scenario: ${scenario.name}`);
        console.log(`   📝 Description: ${scenario.description}`);

        const dir = createTestDir(scenario.name, scenario.files);

        // Special case for symlink
        if (scenario.name === '06-circular-symlink') {
            try {
                fs.symlinkSync(dir, path.join(dir, 'loop-link'), 'dir');
            } catch (e) {
                // Ignore if symlink fails on some systems, mostly for local dev testing
            }
        }

        try {
            const engine = new EnhancedDetectionEngine(dir);
            const start = performance.now();
            const result = await engine.detect();
            const end = performance.now();

            console.log(`   ⏱️  Time: ${(end - start).toFixed(2)}ms`);

            // Analyze Result
            if (result.projectType === 'monorepo') {
                console.log(`   🏷️  Result: MONOREPO with ${result.monorepo.workspaces.length} workspaces`);
            } else {
                console.log(`   🏷️  Result: ${result.projectType}`);
                if (result.backend?.exists) console.log(`      Backend: ${result.backend.framework} (${result.backend.language})`);
                if (result.frontend?.exists) console.log(`      Frontend: ${result.frontend.framework}`);
            }

            // Specific Assertions can go here
            if (scenario.name === '01-identity-crisis') {
                // Should probably prioritize one. Which one does it pick?
            }
            if (scenario.name === '03-deeply-nested') {
                // Does it find it?
                if (result.projectType === 'unknown' || !result.backend?.exists) {
                    console.log('   ⚠️  Failed to detect deeply nested project (Expected for current logic check)');
                }
            }
            if (scenario.name === '06-circular-symlink') {
                console.log('   ✅ Survived infinite loop check');
            }

        } catch (error) {
            console.log(`   ❌ CRASHED: ${error.message}`);
        }
    }
}

runExtremeTests().catch(console.error);
