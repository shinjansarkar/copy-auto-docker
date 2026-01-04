const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

// Mock VS Code API
const vscodeMock = {
    window: {
        createOutputChannel: () => ({
            appendLine: (msg) => console.log(`[Extension Log] ${msg}`),
            clear: () => { },
            show: () => { },
            dispose: () => { }
        }),
        showInformationMessage: () => Promise.resolve(),
        showWarningMessage: () => Promise.resolve(),
        showErrorMessage: (msg) => console.error(`[Extension Error] ${msg}`),
        withProgress: async (options, task) => {
            return task({
                report: (val) => console.log(`[Progress] ${val.message}`)
            });
        }
    },
    workspace: {
        workspaceFolders: [{ uri: { fsPath: process.cwd() } }],
        getConfiguration: () => ({
            get: () => undefined,
            update: () => Promise.resolve()
        }),
        fs: {
            stat: () => Promise.resolve(),
            readFile: () => Promise.resolve(),
            writeFile: () => Promise.resolve()
        }
    },
    Uri: { file: (f) => ({ fsPath: f }) },
    commands: { registerCommand: () => { } },
    ExtensionContext: class { subscriptions = []; }
};

// Inject mock
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (request) {
    if (request === 'vscode') return vscodeMock;
    return originalRequire.apply(this, arguments);
};

// Import Extension Logic (after mock)
// Verify path to compiled extension
const EXTENSION_PATH = path.join(__dirname, 'dist', 'extension.js');
if (!fs.existsSync(EXTENSION_PATH)) {
    console.error(`❌ Extension build not found at ${EXTENSION_PATH}. Run 'npm run compile' first.`);
    process.exit(1);
}
const { DockerGenerationOrchestrator } = require(EXTENSION_PATH);

const TEST_PROJECTS_DIR = path.join(__dirname, 'test-projects');
const LOG_FILE = path.join(__dirname, 'test-extreme.log');

// Logging
function log(msg, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [${type}] ${msg}`;
    console.log(formatted);
    fs.appendFileSync(LOG_FILE, formatted + '\n');
}

// Helper to run shell commands
function run(cmd, cwd) {
    return new Promise((resolve, reject) => {
        const proc = spawn(cmd, { shell: true, cwd, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '', stderr = '';
        proc.stdout.on('data', d => stdout += d);
        proc.stderr.on('data', d => stderr += d);
        proc.on('close', code => {
            if (code === 0) resolve(stdout.trim());
            else reject(new Error(`Command failed: ${cmd}\nSTDERR: ${stderr}`));
        });
    });
}

function getProjects(dir) {
    let projects = [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (['backend', 'frontend', 'fullstack'].includes(entry.name)) {
                    projects = projects.concat(getProjects(fullPath));
                } else if (!['node_modules', 'extreme'].includes(entry.name)) {
                    projects.push({
                        name: entry.name,
                        path: fullPath,
                        category: path.basename(path.dirname(fullPath))
                    });
                }
            }
        }
    } catch (e) { log(`Error reading projects: ${e.message}`, 'ERROR'); }
    return projects;
}

async function testProject(project) {
    log(`Testing ${project.category}/${project.name}...`, 'START');
    const projectPath = project.path;

    try {
        // 1. CLEANUP
        log('Cleaning previous artifacts...', 'STEP');
        const artifacts = ['Dockerfile', 'docker-compose.yml', 'nginx.conf', '.dockerignore', 'Dockerfile.nginx'];
        artifacts.forEach(f => {
            const p = path.join(projectPath, f);
            if (fs.existsSync(p)) fs.unlinkSync(p);
        });

        // 2. GENERATE
        log('Generating Docker files...', 'STEP');
        const outputChannel = vscodeMock.window.createOutputChannel();
        const orchestrator = new DockerGenerationOrchestrator(projectPath, outputChannel);
        const result = await orchestrator.generate();

        if (!result.success) throw new Error('Generation failed');

        // Write files
        if (result.files.dockerfile) fs.writeFileSync(path.join(projectPath, 'Dockerfile'), result.files.dockerfile);
        if (result.files.dockerCompose) fs.writeFileSync(path.join(projectPath, 'docker-compose.yml'), result.files.dockerCompose);
        if (result.files.nginxConf) fs.writeFileSync(path.join(projectPath, 'nginx.conf'), result.files.nginxConf);
        if (result.files.dockerignore) fs.writeFileSync(path.join(projectPath, '.dockerignore'), result.files.dockerignore);

        if (result.files.nginxDockerfile) fs.writeFileSync(path.join(projectPath, 'Dockerfile.nginx'), result.files.nginxDockerfile);

        // Write multi-service Dockerfiles
        if (result.files.frontendDockerfiles) {
            result.files.frontendDockerfiles.forEach(f => {
                const p = path.join(projectPath, f.path);
                fs.mkdirSync(path.dirname(p), { recursive: true });
                fs.writeFileSync(p, f.content);
            });
        }
        if (result.files.backendDockerfiles) {
            result.files.backendDockerfiles.forEach(f => {
                const p = path.join(projectPath, f.path);
                fs.mkdirSync(path.dirname(p), { recursive: true });
                fs.writeFileSync(p, f.content);
            });
        }

        // 3. BUILD & RUN (Compose)
        if (fs.existsSync(path.join(projectPath, 'docker-compose.yml'))) {
            log('Starting Docker Compose...', 'STEP');
            // Force recreation and build
            await run('docker compose up -d --build --force-recreate', projectPath);

            // Wait for containers to stabilize
            log('Waiting for containers...', 'WAIT');
            await new Promise(r => setTimeout(r, 5000));

            // Verify
            log('Verifying container status...', 'CHECK');
            const psOutput = await run('docker compose ps --format json', projectPath);
            // Docker compose ps json output varies by version. 
            // We'll trust simple grep for "Exited" as failure for now or "running" as success.
            // Actually, let's just inspect raw status.
            const rawPs = await run('docker compose ps', projectPath);
            log(`Compose State:\n${rawPs}`, 'DEBUG');

            if (rawPs.includes('Exit') || rawPs.includes('restarting')) {
                // Fetch logs of failed container
                const logs = await run('docker compose logs', projectPath);
                throw new Error(`Containers failed to start.\nLogs:\n${logs.slice(-500)}`);
            }

            log('Containers are RUNNING.', 'PASS');
        } else {
            // Fallback: Single Dockerfile build
            log('No compose file. Building single Dockerfile...', 'STEP');
            if (fs.existsSync(path.join(projectPath, 'Dockerfile'))) {
                await run('docker build .', projectPath);
                log('Build successful.', 'PASS');
            } else {
                log('No Dockerfile or Compose file generated.', 'WARN');
            }
        }

    } catch (error) {
        log(`FAILURE: ${error.message}`, 'FAIL');
        throw error;
    } finally {
        // 4. TEARDOWN
        try {
            // Only clean up if we actually created something
            if (fs.existsSync(path.join(projectPath, 'docker-compose.yml'))) {
                await run('docker compose down --volumes --rmi local', projectPath);
            }
        } catch (e) { /* ignore teardown errors */ }
    }
}

async function main() {
    fs.writeFileSync(LOG_FILE, ''); // Clear log
    const projects = getProjects(TEST_PROJECTS_DIR);
    console.log(`Found ${projects.length} projects.`);

    let passed = 0;
    let failed = 0;

    for (const p of projects) {
        try {
            await testProject(p);
            passed++;
            console.log(`✅ ${p.name} PASSED`);
        } catch (e) {
            failed++;
            console.log(`❌ ${p.name} FAILED`);
        }
    }

    console.log(`\nResults: ${passed} Passed, ${failed} Failed`);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
