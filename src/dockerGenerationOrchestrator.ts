import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { EnhancedDetectionEngine, EnhancedDetectionResult } from './enhancedDetectionEngine';
import { DeterministicDockerGenerator, DeterministicGenerationResult } from './deterministicDockerGenerator';

export interface GeneratedDockerFiles {
    dockerfile?: string;
    dockerCompose: string;
    dockerIgnore: string;
    nginxConf?: string;
    nginxConfFiles?: Array<{ path: string; content: string }>;  // nginx.conf for each frontend directory
    nginxDockerfile?: string;
    frontendDockerfiles?: Array<{ path: string; content: string }>;
    backendDockerfiles?: Array<{ path: string; content: string }>;
}

export interface GenerationResult {
    success: boolean;
    files: GeneratedDockerFiles;
    detectionResult?: EnhancedDetectionResult;
    deterministicResult?: DeterministicGenerationResult;
    warnings: string[];
    skipped: string[];
    usedDeterministic: boolean;
    architecture?: {
        containerCommunication: string;
        exposedPorts: string[];
        buildRuntimeSeparation: string;
    };
    assumptions?: string[];
}

/**
 * Docker Generation Orchestrator
 * PRIMARY: Deterministic blueprint-based generation (rule-based, template-driven)
 */
export class DockerGenerationOrchestrator {
    private basePath: string;
    private detectionEngine: EnhancedDetectionEngine;
    private outputChannel?: vscode.OutputChannel;

    constructor(
        basePath: string,
        outputChannel?: vscode.OutputChannel
    ) {
        this.basePath = basePath;
        this.detectionEngine = new EnhancedDetectionEngine(basePath);
        this.outputChannel = outputChannel;
    }

    /**
     * Main generation method using Deterministic Blueprint-Based Generation
     */
    async generate(): Promise<GenerationResult> {
        this.log('📐 Starting Deterministic Blueprint-Based Generation...');

        const warnings: string[] = [];
        const skipped: string[] = [];

        try {
            // Step 1: Detection
            this.log('🔍 Detecting project structure...');
            const detectionResult = await this.detectionEngine.detect();

            // Step 2: Generate using deterministic generator
            this.log('📝 Generating Docker files from blueprints...');
            const generator = new DeterministicDockerGenerator(detectionResult);
            const result = await generator.generate();

            // Step 3: Convert to our file format
            const files: GeneratedDockerFiles = {
                dockerCompose: result.files.dockerCompose,
                dockerIgnore: result.files.dockerignore,
                frontendDockerfiles: [],
                backendDockerfiles: []
            };

            // Separate frontend and backend Dockerfiles
            result.files.dockerfiles.forEach(df => {
                const isFrontend = df.path.includes('frontend') || df.path.includes('web') || df.path.includes('client');
                const isBackend = df.path.includes('backend') || df.path.includes('server') || df.path.includes('api');

                if (isFrontend) {
                    files.frontendDockerfiles!.push(df);
                } else if (isBackend) {
                    files.backendDockerfiles!.push(df);
                } else {
                    // Root Dockerfile
                    files.dockerfile = df.content;
                }
            });

            if (result.files.nginxConf) {
                files.nginxConf = result.files.nginxConf;
            }

            if (result.files.nginxConfFiles) {
                files.nginxConfFiles = result.files.nginxConfFiles;
            }

            if (result.files.nginxDockerfile) {
                files.nginxDockerfile = result.files.nginxDockerfile;
            }

            // Log architecture
            this.log(`\n✅ Blueprint: ${result.blueprint.type}`);
            this.log(`📦 Services: ${result.architecture.services.join(', ')}`);
            this.log(`🔌 Exposed Ports: ${result.architecture.exposedPorts.join(', ')}`);

            // Log assumptions
            if (result.assumptions.length > 0) {
                this.log('\n📋 Assumptions:');
                result.assumptions.forEach(a => this.log(`   - ${a}`));
            }

            // Log warnings
            if (result.warnings.length > 0) {
                this.log('\n⚠️  Warnings:');
                result.warnings.forEach(w => this.log(`   - ${w}`));
                warnings.push(...result.warnings);
            }

            return {
                success: true,
                files,
                detectionResult,
                deterministicResult: result,
                warnings,
                skipped,
                usedDeterministic: true,
                architecture: {
                    containerCommunication: result.architecture.topology,
                    exposedPorts: result.architecture.exposedPorts.map(String),
                    buildRuntimeSeparation: 'Multi-stage builds enforced by templates'
                },
                assumptions: result.assumptions
            };

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log(`❌ Generation failed: ${message}`);
            throw error;
        }
    }

    private log(message: string) {
        if (this.outputChannel) {
            this.outputChannel.appendLine(message);
        }
        console.log(`[Orchestrator] ${message}`);
    }

    /**
     * Get user-friendly summary
     */
    static generateSummary(result: GenerationResult): string {
        const { deterministicResult, files, warnings, skipped, architecture, assumptions } = result;

        let summary = `## Docker Configuration Generated\n\n`;
        summary += `**Generation Method:** 📐 Deterministic Blueprint-Based\n\n`;

        if (deterministicResult) {
            summary += `**Blueprint Used:** ${deterministicResult.blueprint.type}\n`;
            summary += `**Description:** ${deterministicResult.blueprint.description}\n\n`;
        }

        // Architecture
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

        // Assumptions
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
            '.dockerignore'
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
