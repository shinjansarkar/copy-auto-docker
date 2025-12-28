import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProjectAnalyzer } from './projectAnalyzer';
import { EnhancedProjectAnalyzer } from './enhancedProjectAnalyzer';
import { LLMService } from './llmService';
import { FileManager } from './fileManager';
import { DockerGenerationOrchestrator } from './dockerGenerationOrchestrator';
import {
    MultiWorkspaceManager,
    BOMHandler,
    SafeDirectoryTraversal,
    GenerationLock,
    PathSanitizer,
    DockerignoreGenerator,
    FileWriteLock
} from './criticalErrorHandling';

// Export for verification/testing
export { DockerGenerationOrchestrator } from './dockerGenerationOrchestrator';
export { EnhancedDetectionEngine } from './enhancedDetectionEngine';
export { ProjectAnalyzer } from './projectAnalyzer';


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

    const configureApiKeysCommand = vscode.commands.registerCommand('autoDocker.configureApiKeys', async () => {
        await configureApiKeys();
    });

    const twoStepAICommand = vscode.commands.registerCommand('autoDocker.generateWithTwoStepAI', async () => {
        await generateWithTwoStepAI();
    });

    // Add commands to subscriptions
    context.subscriptions.push(
        analyzeCommand,
        regenerateCommand,
        directModeCommand,
        configureApiKeysCommand,
        twoStepAICommand
    );

    // Show welcome message on first install
    const hasShownWelcome = context.globalState.get('hasShownWelcome', false);
    if (!hasShownWelcome) {
        showWelcomeMessage();
        context.globalState.update('hasShownWelcome', true);
    }
}

async function analyzeProject(skipPreview: boolean = false): Promise<void> {
    // CRITICAL FIX for Runtime Errors: Comprehensive try-catch and type safety
    try {
        outputChannel.clear();
        outputChannel.show(true);
        outputChannel.appendLine('🔍 Starting project analysis...');

        // CRITICAL FIX #1: Multi-workspace folder handling
        const workspaceRoot = await MultiWorkspaceManager.getActiveWorkspaceFolder();
        if (!workspaceRoot || typeof workspaceRoot !== 'string' || workspaceRoot.trim().length === 0) {
            vscode.window.showErrorMessage('Invalid or no workspace selected');
            return;
        }

        // CRITICAL FIX #5: Check if generation is already in progress (concurrent locking)
        if (GenerationLock.isLocked(workspaceRoot)) {
            vscode.window.showWarningMessage('Docker file generation is already in progress. Please wait...');
            return;
        }

        const fileManager = new FileManager(workspaceRoot);
        const validationResult = await fileManager.validateWorkspace();
        if (!validationResult) {
            return;
        }

        // Check API configuration (CRITICAL FIX #32: Safe null checks)
        const apiConfigValid = await validateApiConfiguration();
        if (!apiConfigValid) {
            return;
        }

        // Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Analyzing project and generating Docker files...",
            cancellable: false
        }, async (progress) => {
            try {
                // Step 1: Analyze project structure
                progress.report({ increment: 20, message: "Analyzing project structure..." });
                outputChannel.appendLine('📁 Analyzing project structure...');

                // Use enhanced analyzer for better code understanding
                const config = vscode.workspace.getConfiguration('autoDocker');
                const model = config.get<string>('model', 'gpt-4') || 'gpt-4';

                const enhancedAnalyzer = new EnhancedProjectAnalyzer(workspaceRoot, outputChannel);
                const analysis = await enhancedAnalyzer.analyzeWithAdvancedFeatures(model);

                // CRITICAL FIX #33: Safe property access with defaults
                const projectStructure = analysis?.projectStructure;
                if (!projectStructure) {
                    throw new Error('Failed to analyze project structure');
                }

                outputChannel.appendLine(`Project type detected: ${projectStructure.projectType || 'unknown'}`);
                if (projectStructure.frontend) {
                    outputChannel.appendLine(`Frontend: ${projectStructure.frontend}`);
                }
                if (projectStructure.backend) {
                    outputChannel.appendLine(`Backend: ${projectStructure.backend}`);
                }

                // Step 2: Generate Docker files using LLM
                progress.report({ increment: 40, message: "Generating Docker configuration..." });
                outputChannel.appendLine('🤖 Generating Docker files...');

                const llmService = new LLMService();
                const dockerFiles = await llmService.generateDockerFiles(projectStructure);

                // CRITICAL FIX #34: Validate generated content
                if (!dockerFiles ||
                    !dockerFiles.dockerfile ||
                    !dockerFiles.dockerCompose ||
                    !dockerFiles.dockerIgnore) {
                    throw new Error('LLM generated incomplete Docker files');
                }

                outputChannel.appendLine('✅ Docker files generated');

                // Step 3: Preview and confirm
                progress.report({ increment: 70, message: "Preparing preview..." });

                if (!skipPreview) {
                    try {
                        const confirmed = await fileManager.showPreview(dockerFiles);
                        if (!confirmed) {
                            outputChannel.appendLine('⚠️  Docker generation cancelled by user');
                            return;
                        }
                    } catch (error) {
                        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                        outputChannel.appendLine(`⚠️  Preview error: ${errorMsg}`);
                        // Ask user if they want to continue anyway
                        const choice = await vscode.window.showWarningMessage(
                            'Preview failed. Write files anyway?',
                            'Yes',
                            'No'
                        );
                        if (choice !== 'Yes') {
                            return;
                        }
                    }
                }

                // Step 4: Write files
                progress.report({ increment: 90, message: "Writing files..." });
                outputChannel.appendLine('📝 Writing Docker files to workspace...');

                await fileManager.writeDockerFiles(dockerFiles, projectStructure);

                progress.report({ increment: 100, message: "Complete!" });
                outputChannel.appendLine('✅ Docker files generated successfully!');
                vscode.window.showInformationMessage('✅ Docker files generated successfully!');
            } catch (innerError) {
                const errorMsg = innerError instanceof Error ? innerError.message : 'Unknown error';
                outputChannel.appendLine(`❌ Error: ${errorMsg}`);
                throw innerError;
            }
        });

    } catch (error) {
        // CRITICAL FIX #35: Comprehensive error logging and user feedback
        const errorMessage = error instanceof Error ? error.message :
            typeof error === 'string' ? error :
                'Unknown error occurred';
        outputChannel.appendLine(`❌ Error: ${errorMessage}`);
        if (error instanceof Error && error.stack) {
            outputChannel.appendLine(`Stack: ${error.stack}`);
        }
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

async function configureApiKeys(): Promise<void> {
    const config = vscode.workspace.getConfiguration('autoDocker');

    const provider = await vscode.window.showQuickPick(
        ['OpenAI (GPT)', 'Google Gemini'],
        { placeHolder: 'Select your preferred AI provider' }
    );

    if (!provider) {
        return;
    }

    if (provider === 'OpenAI (GPT)') {
        const apiKey = await vscode.window.showInputBox({
            placeHolder: 'Enter your OpenAI API key',
            password: true,
            prompt: 'Get your API key from https://platform.openai.com/api-keys'
        });

        if (apiKey) {
            await config.update('apiProvider', 'openai', vscode.ConfigurationTarget.Global);
            await config.update('openaiApiKey', apiKey, vscode.ConfigurationTarget.Global);

            const model = await vscode.window.showQuickPick(
                ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
                { placeHolder: 'Select model (gpt-4 recommended)' }
            );

            if (model) {
                await config.update('model', model, vscode.ConfigurationTarget.Global);
            }

            vscode.window.showInformationMessage('OpenAI API configuration saved successfully!');
        }
    } else if (provider === 'Google Gemini') {
        const apiKey = await vscode.window.showInputBox({
            placeHolder: 'Enter your Google Gemini API key',
            password: true,
            prompt: 'Get your API key from https://makersuite.google.com/app/apikey'
        });

        if (apiKey) {
            await config.update('apiProvider', 'gemini', vscode.ConfigurationTarget.Global);
            await config.update('geminiApiKey', apiKey, vscode.ConfigurationTarget.Global);
            await config.update('model', 'gemini-pro', vscode.ConfigurationTarget.Global);

            vscode.window.showInformationMessage('Google Gemini API configuration saved successfully!');
        }
    }
}

async function validateApiConfiguration(): Promise<boolean> {
    const config = vscode.workspace.getConfiguration('autoDocker');
    const provider = config.get<string>('apiProvider', 'openai');

    let isConfigured = false;

    if (provider === 'openai') {
        const apiKey = config.get<string>('openaiApiKey');
        isConfigured = !!apiKey && apiKey.trim().length > 0;
    } else if (provider === 'gemini') {
        const apiKey = config.get<string>('geminiApiKey');
        isConfigured = !!apiKey && apiKey.trim().length > 0;
    }

    if (!isConfigured) {
        const choice = await vscode.window.showErrorMessage(
            `${provider} API key is not configured. Please set up your API key to use Auto Docker Extension.`,
            'Configure Now',
            'Cancel'
        );

        if (choice === 'Configure Now') {
            await configureApiKeys();
            return await validateApiConfiguration(); // Re-validate after configuration
        }

        return false;
    }

    return true;
}

function getWorkspaceRoot(): string {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        throw new Error('No workspace folder is open');
    }
    return vscode.workspace.workspaceFolders[0].uri.fsPath;
}

function showWelcomeMessage(): void {
    const message = 'Welcome to Auto Docker Extension! Generate Docker files automatically using AI.';
    vscode.window.showInformationMessage(message, 'Configure API Keys', 'Learn More').then(choice => {
        if (choice === 'Configure API Keys') {
            configureApiKeys();
        } else if (choice === 'Learn More') {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/your-repo/auto-docker-extension#readme'));
        }
    });
}

/**
 * NEW: Generate Docker files using two-step AI approach
 */
async function generateWithTwoStepAI(): Promise<void> {
    try {
        outputChannel.clear();
        outputChannel.show(true);
        outputChannel.appendLine('🤖 Starting Two-Step AI Docker Generation...\n');

        // Get workspace root
        const workspaceRoot = await MultiWorkspaceManager.getActiveWorkspaceFolder();
        if (!workspaceRoot || typeof workspaceRoot !== 'string' || workspaceRoot.trim().length === 0) {
            vscode.window.showErrorMessage('Invalid or no workspace selected');
            return;
        }

        // Check if generation is already in progress
        if (GenerationLock.isLocked(workspaceRoot)) {
            vscode.window.showWarningMessage('Docker file generation is already in progress. Please wait...');
            return;
        }

        // Validate workspace
        const fileManager = new FileManager(workspaceRoot);
        const validationResult = await fileManager.validateWorkspace();
        if (!validationResult) {
            return;
        }

        // Check API configuration
        const apiConfigValid = await validateApiConfiguration();
        if (!apiConfigValid) {
            return;
        }

        // Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Two-Step AI Docker Generation",
            cancellable: false
        }, async (progress) => {
            return await GenerationLock.executeWithLock(workspaceRoot, async () => {
                try {
                    // Initialize orchestrator with two-step AI enabled
                    progress.report({ increment: 10, message: "Initializing Two-Step AI..." });
                    const orchestrator = new DockerGenerationOrchestrator(workspaceRoot, outputChannel, true);

                // Check for conflicts
                progress.report({ increment: 20, message: "Checking for existing files..." });
                const conflictCheck = await orchestrator.checkForConflicts();
                
                if (conflictCheck.hasConflicts) {
                    const fileList = conflictCheck.conflicts.map(c => `  - ${c.file}`).join('\n');
                    outputChannel.appendLine(`⚠️  Existing files detected:\n${fileList}\n`);
                    
                    const choice = await vscode.window.showWarningMessage(
                        `Found ${conflictCheck.conflicts.length} existing Docker file(s). Overwrite?`,
                        { modal: true },
                        'Yes, Overwrite',
                        'Cancel'
                    );
                    
                    if (choice !== 'Yes, Overwrite') {
                        outputChannel.appendLine('⚠️  Generation cancelled by user');
                        return;
                    }
                }

                // Step 1: Analyze project tree
                progress.report({ increment: 30, message: "Step 1: Analyzing project tree..." });
                outputChannel.appendLine('📊 Step 1: Analyzing project tree...\n');

                // Step 2: Generate Docker files
                progress.report({ increment: 50, message: "Step 2: Generating Docker files..." });
                outputChannel.appendLine('🏗️ Step 2: Generating Docker files with AI...\n');

                // Run complete generation
                const result = await orchestrator.generate();

                if (!result.success) {
                    throw new Error('Docker generation failed');
                }

                // Write files
                progress.report({ increment: 80, message: "Writing files to workspace..." });
                outputChannel.appendLine('📝 Writing generated files...\n');

                await writeGeneratedFiles(workspaceRoot, result.files);

                // Show summary
                progress.report({ increment: 100, message: "Complete!" });
                const summary = DockerGenerationOrchestrator.generateSummary(result);
                outputChannel.appendLine(summary);

                vscode.window.showInformationMessage(
                    '✅ Docker files generated with Two-Step AI!',
                    'View Output',
                    'Open docker-compose.yml'
                ).then(choice => {
                    if (choice === 'View Output') {
                        outputChannel.show();
                    } else if (choice === 'Open docker-compose.yml') {
                        const composePath = path.join(workspaceRoot, 'docker-compose.yml');
                        vscode.workspace.openTextDocument(composePath).then(doc => {
                            vscode.window.showTextDocument(doc);
                        });
                    }
                });

                } catch (innerError) {
                    const errorMsg = innerError instanceof Error ? innerError.message : 'Unknown error';
                    outputChannel.appendLine(`❌ Error: ${errorMsg}`);
                    throw innerError;
                }
            });
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message :
            typeof error === 'string' ? error :
                'Unknown error occurred';
        outputChannel.appendLine(`❌ Error: ${errorMessage}`);
        if (error instanceof Error && error.stack) {
            outputChannel.appendLine(`Stack: ${error.stack}`);
        }
        vscode.window.showErrorMessage(`Two-Step AI generation failed: ${errorMessage}`);
    }
}

/**
 * Helper: Write generated files to workspace
 * Updated to support Approach 2 structure: separate Dockerfiles in service directories
 */
async function writeGeneratedFiles(workspaceRoot: string, files: any): Promise<void> {
    // Write main Dockerfile (for single-service projects like frontend-only or backend-only)
    if (files.dockerfile) {
        const dockerfilePath = path.join(workspaceRoot, 'Dockerfile');
        fs.writeFileSync(dockerfilePath, files.dockerfile, 'utf-8');
        outputChannel.appendLine('✅ Written: Dockerfile');
    }

    // Write frontend Dockerfiles (includes Dockerfile and nginx.conf in frontend/ directory)
    if (files.frontendDockerfiles && files.frontendDockerfiles.length > 0) {
        for (const f of files.frontendDockerfiles) {
            const filePath = path.join(workspaceRoot, f.path);
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, f.content, 'utf-8');
            outputChannel.appendLine(`✅ Written: ${f.path}`);
        }
    }

    // Write backend Dockerfiles (in backend/ directory)
    if (files.backendDockerfiles && files.backendDockerfiles.length > 0) {
        for (const f of files.backendDockerfiles) {
            const filePath = path.join(workspaceRoot, f.path);
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, f.content, 'utf-8');
            outputChannel.appendLine(`✅ Written: ${f.path}`);
        }
    }

    // Write docker-compose.yml at root
    if (files.dockerCompose) {
        const composePath = path.join(workspaceRoot, 'docker-compose.yml');
        fs.writeFileSync(composePath, files.dockerCompose, 'utf-8');
        outputChannel.appendLine('✅ Written: docker-compose.yml');
    }

    // Write nginx.conf at root ONLY for single-service frontend projects
    // For fullstack/monorepo, nginx.conf is written in frontend/ directory via frontendDockerfiles
    if (files.nginxConf && (!files.frontendDockerfiles || files.frontendDockerfiles.length === 0)) {
        const nginxPath = path.join(workspaceRoot, 'nginx.conf');
        fs.writeFileSync(nginxPath, files.nginxConf, 'utf-8');
        outputChannel.appendLine('✅ Written: nginx.conf');
    }

    // Write .dockerignore at root
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
