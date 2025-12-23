const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// Ensure vscode mock is loaded
require('./node_modules/vscode/index.js');
const vscode = require('vscode');

const { DockerGenerationOrchestrator } = require('./dist/extension.js');

const TEST_PROJECTS_DIR = path.join(__dirname, 'test-projects');

// Colors for console output
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m"
};

async function runCommand(command, cwd) {
    return new Promise((resolve, reject) => {
        const proc = spawn(command.split(' ')[0], command.split(' ').slice(1), {
            cwd,
            shell: true,
            stdio: 'pipe'
        });

        let output = '';
        proc.stdout.on('data', data => output += data.toString());
        proc.stderr.on('data', data => output += data.toString()); // Capture stderr too

        proc.on('close', code => {
            if (code === 0) resolve(output);
            else reject(new Error(`Command failed with code ${code}\n${output}`));
        });
    });
}

function getProjects(dir) {
    let projects = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === 'extreme') continue; // Skip extreme for now, focus on standard

            // Check if it's a project category folder (backend, frontend, fullstack)
            if (['backend', 'frontend', 'fullstack'].includes(entry.name)) {
                projects = projects.concat(getProjects(fullPath));
            } else {
                // It's a project folder
                projects.push({
                    name: entry.name,
                    path: fullPath,
                    category: path.basename(path.dirname(fullPath))
                });
            }
        }
    }
    return projects;
}

async function verifyDockerBuild() {
    console.log(`${colors.cyan}🐳 STARTING DOCKER BUILD VERIFICATION 🐳${colors.reset}\n`);

    const projects = getProjects(TEST_PROJECTS_DIR);
    console.log(`Found ${projects.length} projects to test.\n`);

    const results = {
        passed: [],
        failed: [],
        skipped: []
    };

    for (const project of projects) {
        console.log(`${colors.blue}▶ Testing: ${project.category}/${project.name}${colors.reset}`);

        try {
            // Instantiate Orchestrator for THIS project path
            const orchestrator = new DockerGenerationOrchestrator(project.path);

            // Clean previous Dockerfile
            const dockerfilePath = path.join(project.path, 'Dockerfile');
            if (fs.existsSync(dockerfilePath)) fs.unlinkSync(dockerfilePath);

            // 1. Generate
            process.stdout.write('  Generating Dockerfile... ');
            const result = await orchestrator.generate();

            if (!result.success) {
                console.log(`${colors.red}❌ Generation Failed (Orchestrator returned false)${colors.reset}`);
                results.failed.push({ project, error: 'Generation Failed' });
                continue;
            }

            // WRITE FILES TO DISK
            const files = result.files;

            // Main Dockerfile
            if (files.dockerfile) {
                fs.writeFileSync(path.join(project.path, 'Dockerfile'), files.dockerfile);
            }

            // Docker Compose
            if (files.dockerCompose) {
                fs.writeFileSync(path.join(project.path, 'docker-compose.yml'), files.dockerCompose);
            }

            // Nginx
            if (files.nginxConf) {
                fs.writeFileSync(path.join(project.path, 'nginx.conf'), files.nginxConf);
            }

            // .dockerignore
            if (files.dockerignore) {
                fs.writeFileSync(path.join(project.path, '.dockerignore'), files.dockerignore);
            }

            // Frontend Dockerfiles (Monorepo/Fullstack)
            if (files.frontendDockerfiles) {
                for (const f of files.frontendDockerfiles) {
                    const fPath = path.join(project.path, f.path);
                    fs.mkdirSync(path.dirname(fPath), { recursive: true });
                    fs.writeFileSync(fPath, f.content);
                }
            }

            // Backend Dockerfiles (Monorepo/Fullstack)
            if (files.backendDockerfiles) {
                for (const f of files.backendDockerfiles) {
                    const fPath = path.join(project.path, f.path);
                    fs.mkdirSync(path.dirname(fPath), { recursive: true });
                    fs.writeFileSync(fPath, f.content);
                }
            }

            // Check if ANY Dockerfile exists now
            // For monorepos, there might not be a root Dockerfile, but there should be child ones.
            // If it's a monorepo, we might need to build sub-services?
            // "test-project folder" implies verify functionality. 
            // If root Dockerfile exists: build it.
            // If no root Dockerfile but compose exists: try `docker compose config`?
            // If monorepo: maybe just build one of the services?

            // For now, let's look for a root Dockerfile. If not found, look for docker-compose.
            const hasRootDockerfile = fs.existsSync(path.join(project.path, 'Dockerfile'));

            if (!hasRootDockerfile && (!files.frontendDockerfiles && !files.backendDockerfiles)) {
                console.log(`${colors.red}❌ Generation Failed (No file written)${colors.reset}`);
                results.failed.push({ project, error: 'Generation Failed (No file written)' });
                continue;
            }
            console.log(`${colors.green}✔ Done${colors.reset}`);

            // 2. Build
            // If root Dockerfile exists, build it.
            if (hasRootDockerfile) {
                process.stdout.write('  Building Docker Image (Root)... ');
                const imageName = `test-${project.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

                try {
                    await runCommand(`docker build -t ${imageName} .`, project.path);
                    console.log(`${colors.green}✔ BUILT${colors.reset}`);
                    results.passed.push(project);
                    try { cancelImage(imageName); } catch (e) { }
                } catch (buildError) {
                    console.log(`${colors.red}❌ BUILD FAILED${colors.reset}`);
                    const logPath = path.join(project.path, 'build.log');
                    fs.writeFileSync(logPath, buildError.message);
                    results.failed.push({ project, error: 'Build Failed (see build.log)' });
                }
            } else {
                // If it's a monorepo/fullstack with multiple Dockerfiles, try building the first backend one we find
                // This is a proxy for "working correctly"
                let builtSomething = false;

                if (files.backendDockerfiles && files.backendDockerfiles.length > 0) {
                    const bf = files.backendDockerfiles[0];
                    process.stdout.write(`  Building Docker Image (${bf.path})... `);
                    const imageName = `test-${project.name.toLowerCase()}-backend`;
                    const dir = path.dirname(path.join(project.path, bf.path));

                    try {
                        // Build from project root but pointing to dockerfile? usually monorepos build from root context
                        // But if generated dockerfile expects COPY . ., it assumes context is that folder?
                        // "SmartDockerfileGenerator" creates standard dockerfiles.
                        // For monorepos, typically we build from root with -f path/to/Dockerfile.
                        // But simple generator usually puts COPY . . which implies service-level context.
                        // Let's assume service-level context for now as per `generateMonorepoFiles` implementation logic (usually separate contexts).

                        await runCommand(`docker build -t ${imageName} .`, dir);
                        console.log(`${colors.green}✔ BUILT${colors.reset}`);
                        builtSomething = true;
                        results.passed.push(project);
                        try { cancelImage(imageName); } catch (e) { }
                    } catch (buildError) {
                        console.log(`${colors.red}❌ BUILD FAILED${colors.reset}`);
                        results.failed.push({ project, error: `Build Failed: ${bf.path}` });
                    }
                }

                if (!builtSomething && files.frontendDockerfiles && files.frontendDockerfiles.length > 0) {
                    // Try frontend if backend execution didn't happen (e.g. frontend-only monorepo?)
                    // ...
                }
            }

        } catch (err) {
            console.log(`${colors.red}❌ Error: ${err.message}${colors.reset}`);
            results.failed.push({ project, error: err.message });
        }
        console.log('');
    }

    console.log(`${colors.cyan}========================================${colors.reset}`);
    console.log(`${colors.cyan}           VERIFICATION SUMMARY         ${colors.reset}`);
    console.log(`${colors.cyan}========================================${colors.reset}`);
    console.log(`${colors.green}✅ Passed: ${results.passed.length}${colors.reset}`);
    console.log(`${colors.red}❌ Failed: ${results.failed.length}${colors.reset}`);

    if (results.failed.length > 0) {
        console.log(`\n${colors.red}Failures:${colors.reset}`);
        results.failed.forEach(f => {
            console.log(` - ${f.project.category}/${f.project.name}: ${f.error}`);
        });
    }
}

function cancelImage(name) {
    try {
        execSync(`docker rmi ${name} --force`, { stdio: 'ignore' });
    } catch (e) { }
}

verifyDockerBuild().catch(console.error);
