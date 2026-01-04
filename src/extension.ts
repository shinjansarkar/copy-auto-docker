import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FileManager } from './fileManager';
import { DockerGenerationOrchestrator } from './dockerGenerationOrchestrator';
import {
    MultiWorkspaceManager,
    GenerationLock
} from './criticalErrorHandling';

// Export for verification/testing
export { DockerGenerationOrchestrator } from './dockerGenerationOrchestrator';
export { EnhancedDetectionEngine } from './enhancedDetectionEngine';

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    console.log('Auto Docker Extension is now active!');

    // Create output channel for logging
    outputChannel = vscode.window.createOutputChannel('Auto Docker');
    context.subscriptions.push(outputChannel);

    // Register commands
    const analyzeCommand = vscode.commands.registerCommand('autoDocker.analyzeProject', async () => {
        await analyzeProject();
    });

    const regenerateCommand = vscode.commands.registerCommand('autoDocker.regenerateDockerFiles', async () => {
        await regenerateDockerFiles();
    });

    const directModeCommand = vscode.commands.registerCommand('autoDocker.analyzeProjectDirect', async () => {
        await analyzeProject(true); // Skip preview
    });

    // Add commands to subscriptions
    context.subscriptions.push(
        analyzeCommand,
        regenerateCommand,
        directModeCommand
    );

    // Show welcome message on first install
    const hasShownWelcome = context.globalState.get('hasShownWelcome', false);
    if (!hasShownWelcome) {
        showWelcomeMessage();
        context.globalState.update('hasShownWelcome', true);
    }
}

async function analyzeProject(skipPreview: boolean = false): Promise<void> {
    try {
        outputChannel.clear();
        outputChannel.show(true);
        outputChannel.appendLine('🔍 Starting AutoDocker Analysis... 👀');

        const workspaceRoot = await MultiWorkspaceManager.getActiveWorkspaceFolder();
        if (!workspaceRoot) {
            return;
        }

        if (GenerationLock.isLocked(workspaceRoot)) {
            vscode.window.showWarningMessage('Docker file generation is already in progress. Please wait...');
            return;
        }

        const fileManager = new FileManager(workspaceRoot);
        const validationResult = await fileManager.validateWorkspace();
        if (!validationResult) {
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Generating Docker files...",
            cancellable: false
        }, async (progress) => {
            return await GenerationLock.executeWithLock(workspaceRoot, async () => {
                try {
                    progress.report({ increment: 20, message: "Analyzing project structure..." });

                    const orchestrator = new DockerGenerationOrchestrator(workspaceRoot, outputChannel);

                    // Step 1: Check for conflicts
                    const conflictCheck = await orchestrator.checkForConflicts();
                    if (conflictCheck.hasConflicts) {
                        const choice = await vscode.window.showWarningMessage(
                            `Found existing Docker file(s). Overwrite?`,
                            { modal: true },
                            'Yes, Overwrite',
                            'Cancel'
                        );

                        if (choice !== 'Yes, Overwrite') {
                            outputChannel.appendLine('⚠️  Generation cancelled by user');
                            return;
                        }
                    }

                    // Step 2: Generate
                    progress.report({ increment: 40, message: "Generating Docker configuration..." });
                    const result = await orchestrator.generate();

                    if (!result.success) {
                        throw new Error('Docker generation failed');
                    }

                    // Step 3: Preview and confirm
                    progress.report({ increment: 70, message: "Preparing preview..." });

                    if (!skipPreview) {
                        const confirmed = await fileManager.showPreview({
                            dockerfile: result.files.dockerfile || '',
                            dockerCompose: result.files.dockerCompose,
                            dockerIgnore: result.files.dockerIgnore,
                            nginxConf: result.files.nginxConf
                        });
                        if (!confirmed) {
                            outputChannel.appendLine('⚠️  Docker generation cancelled by user');
                            return;
                        }
                    }

                    // Step 4: Write files
                    progress.report({ increment: 90, message: "Writing files..." });
                    await writeGeneratedFiles(workspaceRoot, result.files);

                    progress.report({ increment: 100, message: "Complete!" });
                    outputChannel.appendLine(DockerGenerationOrchestrator.generateSummary(result));
                    outputChannel.appendLine('⚡ LET\'S GOOOOO! DEPLOY TIME! 🚀');
                    vscode.window.showInformationMessage('⚡ Docker files generated! LET\'S GOOOO! 🚀');

                } catch (innerError) {
                    const errorMsg = innerError instanceof Error ? innerError.message : 'Unknown error';
                    outputChannel.appendLine(`❌ Error: ${errorMsg}`);
                    throw innerError;
                }
            });
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        outputChannel.appendLine(`❌ Error: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to generate Docker files: ${errorMessage}`);
    }
}

async function regenerateDockerFiles(): Promise<void> {
    const choice = await vscode.window.showWarningMessage(
        'This will regenerate all Docker files and may overwrite existing ones. Continue?',
        { modal: true },
        'Yes, Regenerate',
        'Cancel'
    );

    if (choice === 'Yes, Regenerate') {
        await analyzeProject();
    }
}

function showWelcomeMessage(): void {
    const message = 'Welcome to Auto Docker Extension! Generate production-ready Docker files automatically.';
    vscode.window.showInformationMessage(message, 'Learn More').then(choice => {
        if (choice === 'Learn More') {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/your-repo/auto-docker-extension#readme'));
        }
    });
}

async function writeGeneratedFiles(workspaceRoot: string, files: any): Promise<void> {
    // Write main Dockerfile
    if (files.dockerfile) {
        const dockerfilePath = path.join(workspaceRoot, 'Dockerfile');
        fs.writeFileSync(dockerfilePath, files.dockerfile, 'utf-8');
        outputChannel.appendLine('✅ Written: Dockerfile');
    }

    // Write frontend Dockerfiles
    if (files.frontendDockerfiles && files.frontendDockerfiles.length > 0) {
        for (const f of files.frontendDockerfiles) {
            const filePath = path.join(workspaceRoot, f.path);
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, f.content, 'utf-8');
            outputChannel.appendLine(`✅ Written: ${f.path}`);
        }
    }

    // Write backend Dockerfiles
    if (files.backendDockerfiles && files.backendDockerfiles.length > 0) {
        for (const f of files.backendDockerfiles) {
            const filePath = path.join(workspaceRoot, f.path);
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, f.content, 'utf-8');
            outputChannel.appendLine(`✅ Written: ${f.path}`);
        }
    }

    // Write docker-compose.yml
    if (files.dockerCompose) {
        const composePath = path.join(workspaceRoot, 'docker-compose.yml');
        fs.writeFileSync(composePath, files.dockerCompose, 'utf-8');
        outputChannel.appendLine('✅ Written: docker-compose.yml');
    }

    // Write nginx.conf files in frontend directories
    if (files.nginxConfFiles && files.nginxConfFiles.length > 0) {
        for (const nginxFile of files.nginxConfFiles) {
            const nginxPath = path.join(workspaceRoot, nginxFile.path);
            const dir = path.dirname(nginxPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(nginxPath, nginxFile.content, 'utf-8');
            outputChannel.appendLine(`✅ Written: ${nginxFile.path}`);
        }
    }
    // Fallback: Write nginx.conf at root for single-service projects
    else if (files.nginxConf && (!files.frontendDockerfiles || files.frontendDockerfiles.length === 0)) {
        const nginxPath = path.join(workspaceRoot, 'nginx.conf');
        fs.writeFileSync(nginxPath, files.nginxConf, 'utf-8');
        outputChannel.appendLine('✅ Written: nginx.conf');
    }

    // Write Dockerfile.nginx if present
    if (files.nginxDockerfile) {
        const nginxDockerfilePath = path.join(workspaceRoot, 'Dockerfile.nginx');
        fs.writeFileSync(nginxDockerfilePath, files.nginxDockerfile, 'utf-8');
        outputChannel.appendLine('✅ Written: Dockerfile.nginx');
    }

    // Write .dockerignore
    if (files.dockerignore) {
        const dockerignorePath = path.join(workspaceRoot, '.dockerignore');
        fs.writeFileSync(dockerignorePath, files.dockerignore, 'utf-8');
        outputChannel.appendLine('✅ Written: .dockerignore');
    }
}

export function deactivate() {
    if (outputChannel) {
        outputChannel.dispose();
    }
}
