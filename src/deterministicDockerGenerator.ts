import * as fs from 'fs';
import * as path from 'path';

/**
 * Deterministic Docker Generator
 * 
 * This is the NEW generation system that follows STRICT architectural rules:
 * 1. Blueprint-driven (no guessing)
 * 2. Template-only (no dynamic generation)
 * 3. AI for verification ONLY (not architecture decisions)
 * 4. Multi-frontend support
 * 5. Monorepo-first design
 * 
 * This replaces AI-first generation with rule-based generation.
 */

import { Blueprint, BlueprintSelector, BlueprintType } from './blueprints/blueprintTypes';
import { TemplateManager, TemplateContext } from './templates/templateManager';
import { NginxTemplateManager, NginxService } from './templates/nginx/nginxTemplateManager';
import { ComposeTemplateManager, ServiceConfig } from './templates/compose/composeTemplateManager';
import { DetectedFrontend, DetectedBackend, DetectedDatabase, EnhancedDetectionResult } from './enhancedDetectionEngine';
import { DockerValidationService } from './validationService';

export interface DeterministicGenerationResult {
    success: boolean;
    blueprint: Blueprint;
    files: {
        dockerfiles: Array<{ path: string; content: string }>;
        dockerCompose: string;
        nginxConf?: string;
        nginxDockerfile?: string;
        dockerignore: string;
    };
    architecture: {
        topology: string;
        services: string[];
        exposedPorts: number[];
        volumes: string[];
    };
    warnings: string[];
    assumptions: string[];
}

/**
 * AI Verification Service (Optional)
 * AI can ONLY verify specific safe details - never architecture
 */
interface AIVerification {
    buildOutputDir?: string;  // Verify build output directory
    entryPoint?: string;      // Verify backend entry point
    exposedPort?: number;     // Verify exposed port
    confidence: 'high' | 'medium' | 'low';
}

export class DeterministicDockerGenerator {
    private detectionResult: EnhancedDetectionResult;
    private warnings: string[] = [];
    private assumptions: string[] = [];

    constructor(detectionResult: EnhancedDetectionResult) {
        this.detectionResult = detectionResult;
    }

    /**
     * Generate all Docker files deterministically
     */
    async generate(): Promise<DeterministicGenerationResult> {
        console.log('[DeterministicDockerGenerator] Starting blueprint-based generation');

        // Step 1: Select Blueprint
        const blueprint = this.selectBlueprint();
        console.log(`[DeterministicDockerGenerator] Selected blueprint: ${blueprint.type}`);

        // Step 2: Generate Dockerfiles (template-based)
        const dockerfiles = this.generateDockerfiles();

        // Step 3: Generate docker-compose.yml (template-based)
        const dockerCompose = this.generateDockerCompose(blueprint);

        // Step 4: Generate Nginx config (if needed)
        const nginxConf = blueprint.nginxRequired ? this.generateNginxConfig() : undefined;

        // Step 5: Generate .dockerignore
        const dockerignore = this.generateDockerignore();

        // Step 6: Build architecture summary
        const architecture = this.buildArchitecture(blueprint);

        // Step 7: Validate generated files (CRITICAL)
        console.log('[DeterministicDockerGenerator] Validating generated files...');
        const validationResult = DockerValidationService.validateGenerationResult({
            dockerfiles,
            dockerCompose,
            nginxConf: nginxConf || '',
            dockerignore
        });

        // Add validation warnings to our warnings list
        this.warnings.push(...validationResult.warnings);

        // STOP if validation fails
        if (!validationResult.valid) {
            console.error('[DeterministicDockerGenerator] Validation failed - stopping generation');
            throw new Error(`Validation failed: ${validationResult.errors.join('; ')}`);
        }

        return {
            success: true,
            blueprint,
            files: {
                dockerfiles,
                dockerCompose,
                nginxConf,
                dockerignore,
                nginxDockerfile: (blueprint.nginxRequired && (this.getAllFrontends().length > 1 || this.getAllBackends().length > 0)) ?
                    NginxTemplateManager.generateProxyDockerfile() : undefined
            },
            architecture,
            warnings: this.warnings,
            assumptions: this.assumptions
        };
    }

    /**
     * Select appropriate blueprint based on detection
     * RULE: Deterministic selection - no AI involvement
     */
    private selectBlueprint(): Blueprint {
        const frontendCount = this.getFrontendCount();
        const backendCount = this.getBackendCount();
        const hasDatabase = this.detectionResult.databases.some(db => db.exists);
        const hasCache = this.detectionResult.databases.some(db => db.type === 'redis');
        const isMonorepo = this.detectionResult.isMonorepo || false;

        const blueprint = BlueprintSelector.selectBlueprint({
            frontendCount,
            backendCount,
            hasDatabase,
            hasCache,
            isMonorepo
        });

        this.assumptions.push(`Blueprint: ${blueprint.type} (${blueprint.description})`);
        return blueprint;
    }

    /**
     * Generate all Dockerfiles using templates
     * RULE: Templates only - no inline generation
     */
    private generateDockerfiles(): Array<{ path: string; content: string }> {
        const dockerfiles: Array<{ path: string; content: string }> = [];

        // Generate frontend Dockerfiles
        const frontends = this.getAllFrontends();
        for (const frontend of frontends) {
            const context = this.buildFrontendContext(frontend);
            const content = TemplateManager.getFrontendTemplate(context);
            const path = frontend.path === '.' ? 'Dockerfile' : `${frontend.path}/Dockerfile`;
            dockerfiles.push({ path, content });

            this.assumptions.push(`Frontend Dockerfile: ${path} (${frontend.framework})`);
        }

        // Generate backend Dockerfiles
        const backends = this.getAllBackends();
        for (const backend of backends) {
            const context = this.buildBackendContext(backend);
            const content = TemplateManager.getBackendTemplate(context);
            const path = backend.path === '.' ? 'Dockerfile' : `${backend.path}/Dockerfile`;
            dockerfiles.push({ path, content });

            this.assumptions.push(`Backend Dockerfile: ${path} (${backend.language})`);
        }

        return dockerfiles;
    }

    /**
     * Generate docker-compose.yml
     */
    private generateDockerCompose(blueprint: Blueprint): string {
        const services: ServiceConfig[] = [];

        // Add frontend services
        const frontends = this.getAllFrontends();
        frontends.forEach((frontend, index) => {
            const serviceName = frontends.length > 1 ? `frontend_${index + 1}` : 'frontend';
            services.push({
                name: serviceName,
                type: 'frontend',
                buildContext: frontend.path === '.' ? '.' : `./${frontend.path}`,
                dockerfile: 'Dockerfile',
                dependsOn: []
            });
        });

        // Add backend services
        const backends = this.getAllBackends();
        backends.forEach((backend, index) => {
            const serviceName = backends.length > 1 ? `backend_${index + 1}` : 'backend';
            const dependsOn: string[] = [];

            // Add database dependencies
            this.detectionResult.databases.forEach(db => {
                if (db.exists && db.type !== 'redis') {
                    dependsOn.push(db.type);
                }
            });

            services.push({
                name: serviceName,
                type: 'backend',
                buildContext: backend.path === '.' ? '.' : `./${backend.path}`,
                dockerfile: 'Dockerfile',
                port: backend.port || 3000,
                internalPort: backend.port || 3000,
                environment: this.getBackendEnvironment(backend),
                dependsOn
            });
        });

        // Add database services
        this.detectionResult.databases.forEach(db => {
            if (db.exists) {
                if (db.type === 'postgres' || db.type === 'mysql' || db.type === 'mongodb') {
                    services.push(ComposeTemplateManager.getDatabaseService(db.type as any));
                } else if (db.type === 'redis') {
                    services.push(ComposeTemplateManager.getDatabaseService('redis'));
                }
            }
        });

        // Add Nginx service (if needed)
        // Add Nginx service or Expose Frontend
        // RULE: 
        // 1. Single Frontend (Static) -> Expose directly (it runs Nginx internal)
        // 2. Fullstack or Multi-Frontend -> Use Nginx Gateway Service

        const isMultiService = frontends.length > 1 || backends.length > 0;

        if (blueprint.nginxRequired) {
            if (isMultiService) {
                // Gateway Pattern: Separate Nginx service
                // Robustness Fix: Wait for upstream services to be healthy before starting Nginx.
                // This prevents Nginx from crashing/restarting if upstreams are not ready (Race Condition).
                const nginxDependsOn: Record<string, { condition: string }> = {};

                frontends.forEach((_, i) => {
                    const name = frontends.length > 1 ? `frontend_${i + 1}` : 'frontend';
                    nginxDependsOn[name] = { condition: 'service_healthy' };
                });

                // Backends are also dependencies if Nginx routes to them
                if (backends.length > 0) {
                    backends.forEach((_, i) => {
                        const name = backends.length > 1 ? `backend_${i + 1}` : 'backend';
                        nginxDependsOn[name] = { condition: 'service_healthy' };
                    });
                }

                services.push({
                    name: 'nginx',
                    type: 'nginx',
                    buildContext: '.',
                    dockerfile: 'Dockerfile.nginx',
                    port: 80,
                    internalPort: 80,
                    dependsOn: nginxDependsOn
                });
            } else if (frontends.length === 1) {
                // Single Frontend Pattern: Expose frontend directly
                // Find the frontend service and add port mapping
                const frontendService = services.find(s => s.type === 'frontend');
                if (frontendService) {
                    frontendService.port = 80;
                    frontendService.internalPort = 80;
                    // Note: Internal port depends on the Dockerfile. 
                    // Static site templates (nginx) use 80. Node apps might use 3000.
                    // But 'frontend-only-nginx' blueprint implies static/nginx, so 80 is safe.
                }
            }
        }

        return ComposeTemplateManager.generateCompose(services, blueprint);
    }

    /**
     * Generate Nginx configuration
     * RULE: Path-based routing for multiple frontends
     */
    private generateNginxConfig(): string {
        const nginxServices: NginxService[] = [];

        // Add frontends
        const frontends = this.getAllFrontends();
        frontends.forEach((frontend, index) => {
            const name = frontends.length > 1 ? `frontend_${index + 1}` : 'frontend';
            const path = frontends.length > 1 ? this.assignFrontendPath(frontend, index) : '/';

            nginxServices.push({
                name,
                type: 'frontend',
                path
            });

            if (frontends.length > 1) {
                this.assumptions.push(`Nginx routing: ${name} -> ${path}`);
            }
        });

        // Add backends
        const backends = this.getAllBackends();
        backends.forEach((backend, index) => {
            const name = backends.length > 1 ? `backend_${index + 1}` : 'backend';
            nginxServices.push({
                name,
                type: 'backend',
                path: '/api',
                port: backend.port || 3000
            });
        });

        return NginxTemplateManager.generateConfig(nginxServices);
    }

    /**
     * Assign routing path for frontend
     * RULE: Never guess - use safe defaults
     */
    private assignFrontendPath(frontend: DetectedFrontend, index: number): string {
        // Check for common naming patterns
        const pathLower = frontend.path.toLowerCase();

        if (pathLower.includes('admin')) return '/admin';
        if (pathLower.includes('dashboard')) return '/dashboard';
        if (pathLower.includes('portal')) return '/portal';
        if (pathLower.includes('app')) return '/app';

        // First frontend gets root by default
        if (index === 0) return '/';

        // Others get path based on folder name
        const folderName = frontend.path.split('/').pop() || `app${index + 1}`;
        return `/${folderName}`;
    }

    /**
     * Generate .dockerignore
     */
    private generateDockerignore(): string {
        return `# Dependencies
node_modules/
.pnpm-store/
__pycache__/
venv/
.venv/
vendor/

# Build outputs
dist/
build/
.next/
out/
target/
*.pyc

# Environment files
// .env
// .env.local
// .env.*.local

# Version control
.git/
.gitignore
.github/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Testing
coverage/
.nyc_output/
*.test.js
*.spec.js

# Logs
*.log
logs/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Documentation
README.md
CHANGELOG.md
docs/
`;
    }

    /**
     * Build frontend template context
     */
    private buildFrontendContext(frontend: DetectedFrontend): TemplateContext {
        // AI verification could happen here (optional)
        // But it would ONLY verify outputFolder, not change architecture

        let installCommand = frontend.installCommand;

        // Safety: If npm is used but no lockfile exists, force 'npm install'
        if (frontend.packageManager === 'npm' && frontend.projectPath) {
            const lockfilePath = path.join(frontend.projectPath, 'package-lock.json');
            if (!fs.existsSync(lockfilePath)) {
                installCommand = 'npm install';
                this.warnings.push(`No package-lock.json found in ${frontend.path}, falling back to 'npm install'`);
            }
        }

        return {
            framework: frontend.framework,
            variant: frontend.variant,
            packageManager: frontend.packageManager,
            buildCommand: frontend.buildCommand,
            installCommand: installCommand,
            outputFolder: frontend.outputFolder,
            port: frontend.port
        };
    }

    /**
     * Build backend template context
     */
    private buildBackendContext(backend: DetectedBackend): TemplateContext {
        // AI verification could happen here (optional)
        // But it would ONLY verify entryPoint/port, not change architecture

        return {
            language: backend.language,
            backendFramework: backend.framework,
            entryPoint: backend.entryPoint,
            port: backend.port || 3000
        };
    }

    /**
     * Get backend environment variables
     */
    private getBackendEnvironment(backend: DetectedBackend): Record<string, string> {
        const env: Record<string, string> = {
            NODE_ENV: 'production'
        };

        // Add database connection strings
        this.detectionResult.databases.forEach(db => {
            if (db.exists) {
                if (db.type === 'postgres') {
                    env.DATABASE_URL = 'postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}';
                } else if (db.type === 'mongodb') {
                    env.MONGODB_URI = 'mongodb://${MONGO_USER}:${MONGO_PASSWORD}@mongodb:27017/${MONGO_DATABASE}';
                } else if (db.type === 'redis') {
                    env.REDIS_URL = 'redis://redis:6379';
                }
            }
        });

        return env;
    }

    /**
     * Build architecture summary
     */
    private buildArchitecture(blueprint: Blueprint): {
        topology: string;
        services: string[];
        exposedPorts: number[];
        volumes: string[];
    } {
        const services: string[] = [];
        const exposedPorts: number[] = [];
        const volumes: string[] = [];

        // Collect from blueprint
        blueprint.services.forEach(s => {
            services.push(`${s.name} (${s.type})`);
            if (s.port) exposedPorts.push(s.port);
        });

        // Add database volumes
        this.detectionResult.databases.forEach(db => {
            if (db.exists) {
                volumes.push(`${db.type}_data`);
            }
        });

        return {
            topology: blueprint.description,
            services,
            exposedPorts,
            volumes
        };
    }

    /**
     * Helper methods
     */
    private getFrontendCount(): number {
        if (this.detectionResult.monorepo?.frontends) {
            return this.detectionResult.monorepo.frontends.length;
        }
        return this.detectionResult.frontend?.exists ? 1 : 0;
    }

    private getBackendCount(): number {
        if (this.detectionResult.monorepo?.backends) {
            return this.detectionResult.monorepo.backends.length;
        }
        return this.detectionResult.backend?.exists ? 1 : 0;
    }

    private getAllFrontends(): DetectedFrontend[] {
        if (this.detectionResult.monorepo?.frontends) {
            return this.detectionResult.monorepo.frontends;
        }
        return this.detectionResult.frontend?.exists ? [this.detectionResult.frontend] : [];
    }

    private getAllBackends(): DetectedBackend[] {
        if (this.detectionResult.monorepo?.backends) {
            return this.detectionResult.monorepo.backends;
        }
        return this.detectionResult.backend?.exists ? [this.detectionResult.backend] : [];
    }
}
