/**
 * Docker Generation Orchestrator
 * Integrates all components to generate complete Docker configurations
 * Orchestrates: Detection -> Generation -> Validation -> File Writing
 * 
 * NEW: Supports both legacy detection-based generation and two-step AI approach
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { EnhancedDetectionEngine, EnhancedDetectionResult, ProjectType } from './enhancedDetectionEngine';
import { SmartDockerfileGenerator } from './smartDockerfileGenerator';
import { SimpleNginxGenerator } from './simpleNginxGenerator';
import { CleanComposeGenerator } from './cleanComposeGenerator';
import { TwoStepAIService } from './twoStepAIService';

export interface GeneratedDockerFiles {
    dockerfile?: string;
    dockerCompose: string;
    dockerignore: string;
    nginxConf?: string;
    frontendDockerfiles?: Array<{ path: string; content: string }>;
    backendDockerfiles?: Array<{ path: string; content: string }>;
}

export interface GenerationResult {
    success: boolean;
    files: GeneratedDockerFiles;
    detectionResult?: EnhancedDetectionResult;
    warnings: string[];
    skipped: string[];
    usedTwoStepAI?: boolean;
    architecture?: {
        containerCommunication: string;
        exposedPorts: string[];
        buildRuntimeSeparation: string;
    };
    assumptions?: string[];
}

/**
 * Docker Generation Orchestrator
 */
export class DockerGenerationOrchestrator {
    private basePath: string;
    private detectionEngine: EnhancedDetectionEngine;
    private twoStepAI?: TwoStepAIService;
    private outputChannel?: vscode.OutputChannel;
    private useTwoStepAI: boolean;

    constructor(basePath: string, outputChannel?: vscode.OutputChannel, useTwoStepAI: boolean = false) {
        this.basePath = basePath;
        this.detectionEngine = new EnhancedDetectionEngine(basePath);
        this.outputChannel = outputChannel;
        this.useTwoStepAI = useTwoStepAI;

        // Initialize Two-Step AI if enabled
        if (useTwoStepAI) {
            this.twoStepAI = new TwoStepAIService(basePath, outputChannel);
        }
    }

    /**
     * Routes to either legacy or two-step AI approach
     */
    async generate(): Promise<GenerationResult> {
        console.log('[DockerGenerationOrchestrator] Starting generation process...');

        if (this.useTwoStepAI && this.twoStepAI) {
            return await this.generateWithTwoStepAI();
        } else {
            return await this.generateLegacy();
        }
    }

    /**
     * NEW: Two-Step AI Generation
     */
    private async generateWithTwoStepAI(): Promise<GenerationResult> {
        this.log('🤖 Using Two-Step AI Generation approach');

        const warnings: string[] = [];
        const skipped: string[] = [];

        try {
            // Run complete two-step workflow
            const aiResult = await this.twoStepAI!.generateComplete();

            // Convert AI artifacts to our file format
            const files: GeneratedDockerFiles = {
                dockerCompose: '',
                dockerignore: this.generateDefaultDockerignore()
            };

            for (const artifact of aiResult.artifacts) {
                const fileName = path.basename(artifact.filePath).toLowerCase();
                
                if (fileName === 'dockerfile') {
                    files.dockerfile = artifact.content;
                } else if (fileName === 'docker-compose.yml' || fileName === 'docker-compose.yaml') {
                    files.dockerCompose = artifact.content;
                } else if (fileName === 'nginx.conf') {
                    files.nginxConf = artifact.content;
                } else if (artifact.filePath.includes('frontend') && fileName === 'dockerfile') {
                    if (!files.frontendDockerfiles) files.frontendDockerfiles = [];
                    files.frontendDockerfiles.push({
                        path: artifact.filePath,
                        content: artifact.content
                    });
                } else if (artifact.filePath.includes('backend') && fileName === 'dockerfile') {
                    if (!files.backendDockerfiles) files.backendDockerfiles = [];
                    files.backendDockerfiles.push({
                        path: artifact.filePath,
                        content: artifact.content
                    });
                }
            }

            // Add assumptions as warnings for visibility
            if (aiResult.assumptions && aiResult.assumptions.length > 0) {
                warnings.push('Assumptions made by AI:');
                warnings.push(...aiResult.assumptions.map(a => `  - ${a}`));
            }

            return {
                success: true,
                files,
                warnings,
                skipped,
                usedTwoStepAI: true,
                architecture: aiResult.architecture,
                assumptions: aiResult.assumptions
            };

        } catch (error) {
            this.log(`❌ Two-Step AI generation failed: ${error}`);
            this.log('Falling back to legacy detection-based generation...');
            
            // Fallback to legacy approach
            return await this.generateLegacy();
        }
    }

    /**
     * LEGACY: Detection-based generation (original approach)
     */
    private async generateLegacy(): Promise<GenerationResult> {
        console.log('[DockerGenerationOrchestrator] Using legacy detection-based generation');

        const warnings: string[] = [];
        const skipped: string[] = [];

        // Step 1: Detect project structure
        console.log('[Orchestrator] Step 1: Detection');
        const detectionResult = await this.detectionEngine.detect();
        console.log(`[Orchestrator] Detected project type: ${detectionResult.projectType}`);

        // Step 2: Generate files based on detection
        console.log('[Orchestrator] Step 2: Generation');
        const files = await this.generateFiles(detectionResult, warnings, skipped);

        // Step 3: Validate generated files
        console.log('[Orchestrator] Step 3: Validation');
        this.validateGeneratedFiles(files, warnings);

        return {
            success: true,
            files,
            detectionResult,
            warnings,
            skipped,
            usedTwoStepAI: false
        };
    }

    private log(message: string) {
        if (this.outputChannel) {
            this.outputChannel.appendLine(message);
        }
        console.log(`[Orchestrator] ${message}`);
    }

    private generateDefaultDockerignore(): string {
        return SmartDockerfileGenerator.generateDockerignore();
    }

    /**
     * Generate all Docker files based on detection
     */
    private async generateFiles(
        detection: EnhancedDetectionResult,
        warnings: string[],
        skipped: string[]
    ): Promise<GeneratedDockerFiles> {
        const { projectType } = detection;

        switch (projectType) {
            case 'frontend-only':
                return this.generateFrontendOnlyFiles(detection, warnings, skipped);

            case 'backend-only':
                return this.generateBackendOnlyFiles(detection, warnings, skipped);

            case 'fullstack':
                return this.generateFullstackFiles(detection, warnings, skipped);

            case 'monorepo':
                return this.generateMonorepoFiles(detection, warnings, skipped);

            default:
                throw new Error(`Unknown project type: ${projectType}`);
        }
    }

    /**
     * Generate files for frontend-only project
     */
    private async generateFrontendOnlyFiles(
        detection: EnhancedDetectionResult,
        warnings: string[],
        skipped: string[]
    ): Promise<GeneratedDockerFiles> {
        console.log('[Orchestrator] Generating frontend-only files');

        const { frontend } = detection;
        if (!frontend) {
            throw new Error('Frontend detection failed');
        }

        const files: GeneratedDockerFiles = {
            dockerCompose: '',
            dockerignore: ''
        };

        // Generate Dockerfile
        files.dockerfile = SmartDockerfileGenerator.generateFrontendDockerfile(frontend);

        // Generate nginx.conf (check if should generate)
        const nginxGeneration = SimpleNginxGenerator.generateWithContext(true, false, this.basePath);
        if (nginxGeneration.shouldGenerate) {
            files.nginxConf = nginxGeneration.config!;
        } else {
            skipped.push('nginx.conf: ' + nginxGeneration.reason);
        }

        // Generate docker-compose.yml
        files.dockerCompose = CleanComposeGenerator.generateFrontendOnlyCompose(frontend);

        // Generate .dockerignore
        files.dockerignore = SmartDockerfileGenerator.generateDockerignore();

        return files;
    }

    /**
     * Generate files for backend-only project
     */
    private async generateBackendOnlyFiles(
        detection: EnhancedDetectionResult,
        warnings: string[],
        skipped: string[]
    ): Promise<GeneratedDockerFiles> {
        console.log('[Orchestrator] Generating backend-only files');

        const { backend, databases } = detection;
        if (!backend) {
            throw new Error('Backend detection failed');
        }

        const files: GeneratedDockerFiles = {
            dockerCompose: '',
            dockerignore: ''
        };

        // Generate Dockerfile
        files.dockerfile = SmartDockerfileGenerator.generateBackendDockerfile(backend);

        // NO nginx.conf for backend-only
        skipped.push('nginx.conf: Backend-only project does not need nginx');

        // Generate docker-compose.yml
        files.dockerCompose = CleanComposeGenerator.generateBackendOnlyCompose(backend, databases);

        // Generate .dockerignore
        files.dockerignore = SmartDockerfileGenerator.generateDockerignore();

        return files;
    }

    /**
     * Generate files for fullstack project
     * Uses Approach 2: Separate Dockerfiles in frontend/ and backend/ directories
     */
    private async generateFullstackFiles(
        detection: EnhancedDetectionResult,
        warnings: string[],
        skipped: string[]
    ): Promise<GeneratedDockerFiles> {
        console.log('[Orchestrator] Generating fullstack files with Approach 2 structure');

        const { frontend, backend, databases } = detection;
        if (!frontend || !backend) {
            throw new Error('Fullstack detection failed');
        }

        const files: GeneratedDockerFiles = {
            dockerCompose: '',
            dockerignore: '',
            frontendDockerfiles: [],
            backendDockerfiles: []
        };

        const dockerignoreContent = SmartDockerfileGenerator.generateDockerignore();

        // Use actual detected paths (e.g., client/, server/, frontend/, backend/, etc.)
        const frontendPath = frontend.path === '.' ? 'frontend' : frontend.path;
        const backendPath = backend.path === '.' ? 'backend' : backend.path;

        // Generate frontend Dockerfile in frontend directory
        const frontendDockerfile = SmartDockerfileGenerator.generateFrontendDockerfile(frontend);
        files.frontendDockerfiles = [{
            path: `${frontendPath}/Dockerfile`,
            content: frontendDockerfile
        }];

        // Add .dockerignore to frontend directory
        files.frontendDockerfiles.push({
            path: `${frontendPath}/.dockerignore`,
            content: dockerignoreContent
        });

        // Generate backend Dockerfile in backend directory
        const backendDockerfile = SmartDockerfileGenerator.generateBackendDockerfile(backend);
        files.backendDockerfiles = [{
            path: `${backendPath}/Dockerfile`,
            content: backendDockerfile
        }];

        // Add .dockerignore to backend directory
        files.backendDockerfiles.push({
            path: `${backendPath}/.dockerignore`,
            content: dockerignoreContent
        });

        // Generate nginx.conf in frontend directory (with backend proxy)
        const nginxGeneration = SimpleNginxGenerator.generateWithContext(true, true, this.basePath);
        if (nginxGeneration.shouldGenerate) {
            files.nginxConf = nginxGeneration.config!;
            // Store nginx.conf in frontend directory
            files.frontendDockerfiles.push({
                path: `${frontendPath}/nginx.conf`,
                content: nginxGeneration.config!
            });
        } else {
            skipped.push('nginx.conf: ' + nginxGeneration.reason);
        }

        // Generate docker-compose.yml at root
        files.dockerCompose = CleanComposeGenerator.generateFullstackCompose(frontend, backend, databases);

        // Generate .dockerignore at root
        files.dockerignore = dockerignoreContent;

        return files;
    }

    /**
     * Generate files for monorepo project
     * Uses Approach 2: Separate Dockerfiles in respective service directories
     */
    private async generateMonorepoFiles(
        detection: EnhancedDetectionResult,
        warnings: string[],
        skipped: string[]
    ): Promise<GeneratedDockerFiles> {
        console.log('[Orchestrator] Generating monorepo files with Approach 2 structure');

        const { monorepo, databases } = detection;
        if (!monorepo) {
            throw new Error('Monorepo detection failed');
        }

        const files: GeneratedDockerFiles = {
            dockerCompose: '',
            dockerignore: '',
            frontendDockerfiles: [],
            backendDockerfiles: []
        };

        const dockerignoreContent = SmartDockerfileGenerator.generateDockerignore();

        // Generate frontend Dockerfiles in respective directories
        for (const frontend of monorepo.frontends) {
            const dockerfile = SmartDockerfileGenerator.generateFrontendDockerfile(frontend);
            files.frontendDockerfiles!.push({
                path: `${frontend.path}/Dockerfile`,
                content: dockerfile
            });

            // Add .dockerignore to each frontend directory
            files.frontendDockerfiles!.push({
                path: `${frontend.path}/.dockerignore`,
                content: dockerignoreContent
            });

            // Generate nginx.conf for each frontend in its directory
            const hasFrontend = true;
            const hasBackend = monorepo.backends.length > 0;
            const nginxGeneration = SimpleNginxGenerator.generateWithContext(
                hasFrontend,
                hasBackend,
                this.basePath
            );

            if (nginxGeneration.shouldGenerate) {
                files.frontendDockerfiles!.push({
                    path: `${frontend.path}/nginx.conf`,
                    content: nginxGeneration.config!
                });
            }
        }

        // Generate backend Dockerfiles in respective directories
        for (const backend of monorepo.backends) {
            const dockerfile = SmartDockerfileGenerator.generateBackendDockerfile(backend);
            files.backendDockerfiles!.push({
                path: `${backend.path}/Dockerfile`,
                content: dockerfile
            });

            // Add .dockerignore to each backend directory
            files.backendDockerfiles!.push({
                path: `${backend.path}/.dockerignore`,
                content: dockerignoreContent
            });
        }

        // Generate docker-compose.yml at root
        files.dockerCompose = CleanComposeGenerator.generateMonorepoCompose(
            monorepo.frontends,
            monorepo.backends,
            databases
        );

        // Generate .dockerignore at root
        files.dockerignore = dockerignoreContent;

        return files;
    }

    /**
     * Validate generated files
     */
    private validateGeneratedFiles(files: GeneratedDockerFiles, warnings: string[]): void {
        console.log('[Orchestrator] Validating generated files');

        // Validate docker-compose.yml
        const composeValidation = CleanComposeGenerator.validateCompose(files.dockerCompose);
        if (!composeValidation.isValid) {
            warnings.push(...composeValidation.errors.map(e => `docker-compose.yml: ${e}`));
        }

        // Check for unnecessary elements in compose
        const composeChecks = CleanComposeGenerator.checkForUnnecessaryElements(files.dockerCompose);
        if (composeChecks.warnings.length > 0) {
            warnings.push(...composeChecks.warnings.map(w => `docker-compose.yml: ${w}`));
        }

        // Validate nginx.conf if it exists
        if (files.nginxConf) {
            const nginxValidation = SimpleNginxGenerator.validateNginxConfig(files.nginxConf);
            if (!nginxValidation.isValid) {
                warnings.push(...nginxValidation.errors.map(e => `nginx.conf: ${e}`));
            }
        }
    }

    /**
     * Get user-friendly summary
     */
    static generateSummary(result: GenerationResult): string {
        const { detectionResult, files, warnings, skipped, usedTwoStepAI, architecture, assumptions } = result;

        let summary = `## Docker Configuration Generated\n\n`;
        
        if (usedTwoStepAI) {
            summary += `**Generation Method:** 🤖 Two-Step AI (Tree Analysis → File Generation)\n\n`;
        } else {
            summary += `**Generation Method:** 🔍 Legacy Detection-Based\n\n`;
        }

        if (detectionResult) {
            summary += `**Project Type:** ${detectionResult.projectType}\n\n`;

            // Detection details
            if (detectionResult.frontend) {
                summary += `### Frontend Detected\n`;
                summary += `- Framework: ${detectionResult.frontend.framework}`;
                if (detectionResult.frontend.variant) {
                    summary += ` (${detectionResult.frontend.variant})`;
                }
                summary += `\n`;
                summary += `- Build Output: \`${detectionResult.frontend.outputFolder}\`\n`;
                summary += `- Package Manager: ${detectionResult.frontend.packageManager}\n`;
                summary += `\n`;
            }

            if (detectionResult.backend) {
                summary += `### Backend Detected\n`;
                summary += `- Framework: ${detectionResult.backend.framework}\n`;
                summary += `- Language: ${detectionResult.backend.language}\n`;
                summary += `\n`;
            }

            if (detectionResult.databases && detectionResult.databases.length > 0) {
                summary += `### Databases Detected\n`;
                for (const db of detectionResult.databases) {
                    summary += `- ${db.type}\n`;
                }
                summary += `\n`;
            }
        }

        // Architecture (from AI)
        if (architecture) {
            summary += `### Architecture\n`;
            summary += `- **Communication:** ${architecture.containerCommunication}\n`;
            summary += `- **Exposed Ports:** ${architecture.exposedPorts.join(', ')}\n`;
            summary += `- **Build/Runtime:** ${architecture.buildRuntimeSeparation}\n\n`;
        }

        // Generated files
        summary += `### Generated Files\n`;

        if (files.dockerfile) {
            summary += `- ✅ Dockerfile\n`;
        }
        if (files.frontendDockerfiles && files.frontendDockerfiles.length > 0) {
            for (const f of files.frontendDockerfiles) {
                summary += `- ✅ ${f.path}\n`;
            }
        }
        if (files.backendDockerfiles && files.backendDockerfiles.length > 0) {
            for (const f of files.backendDockerfiles) {
                summary += `- ✅ ${f.path}\n`;
            }
        }
        summary += `- ✅ docker-compose.yml\n`;
        summary += `- ✅ .dockerignore\n`;

        if (files.nginxConf) {
            summary += `- ✅ nginx.conf\n`;
        }

        // Assumptions (from AI)
        if (assumptions && assumptions.length > 0) {
            summary += `\n### Assumptions\n`;
            for (const assumption of assumptions) {
                summary += `- 💡 ${assumption}\n`;
            }
        }

        // Skipped files
        if (skipped.length > 0) {
            summary += `\n### Skipped Files\n`;
            for (const skip of skipped) {
                summary += `- ⏭️ ${skip}\n`;
            }
        }

        // Warnings
        if (warnings.length > 0) {
            summary += `\n### Warnings\n`;
            for (const warning of warnings) {
                summary += `- ⚠️ ${warning}\n`;
            }
        }

        return summary;
    }

    /**
     * Check for existing files and determine conflicts
     */
    async checkForConflicts(): Promise<{
        hasConflicts: boolean;
        conflicts: Array<{
            file: string;
            exists: boolean;
            path: string;
        }>;
    }> {
        const conflicts: Array<{ file: string; exists: boolean; path: string }> = [];

        const filesToCheck = [
            'Dockerfile',
            'docker-compose.yml',
            'nginx.conf',
            '.dockerignore',
            'frontend/Dockerfile',
            'backend/Dockerfile'
        ];

        for (const file of filesToCheck) {
            const filePath = path.join(this.basePath, file);
            const exists = fs.existsSync(filePath);

            if (exists) {
                conflicts.push({
                    file,
                    exists: true,
                    path: filePath
                });
            }
        }

        return {
            hasConflicts: conflicts.length > 0,
            conflicts
        };
    }
}
