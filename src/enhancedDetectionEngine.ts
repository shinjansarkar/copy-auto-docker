/**
 * Enhanced Detection Engine
 * Centralized, accurate detection of all project types and configurations
 * Fixes Issues #1-6: All codebase detection errors
 */

import * as fs from 'fs';
import * as path from 'path';

export interface FrameworkOutputInfo {
    framework: string;
    variant?: string;
    outputFolder: string;
    buildCommand: string;
    packageManager?: 'npm' | 'yarn' | 'pnpm';
    isSSR?: boolean;
}

export type ProjectType =
    | 'frontend-only'
    | 'backend-only'
    | 'fullstack'
    | 'monorepo';

export interface DetectedFrontend {
    exists: boolean;
    framework: string;
    variant?: string;
    outputFolder: string;
    buildCommand: string;
    packageManager: 'npm' | 'yarn' | 'pnpm';
    installCommand: string;
    path: string; // Relative path in monorepo (or "." for single projects)
    port?: number;
}

export interface DetectedBackend {
    exists: boolean;
    framework: string;
    language: 'node' | 'python' | 'java' | 'go' | 'php' | 'dotnet' | 'ruby' | 'elixir';
    packageManager?: string;
    path: string; // Relative path in monorepo (or "." for single projects)
    port?: number;
    dependencies?: any;
    entryPoint?: string; // Main entry file (e.g., server.js, index.js)
}

export interface DetectedDatabase {
    exists: boolean;
    type: 'postgres' | 'mysql' | 'mongodb' | 'redis' | 'sqlite' | 'mariadb' | string;
    port?: number;
    version?: string;
}

export interface MonorepoInfo {
    isMonorepo: boolean;
    tool?: 'yarn' | 'pnpm' | 'lerna' | 'nx' | 'turbo' | 'rush';
    workspaces?: string[];
    frontends: DetectedFrontend[];
    backends: DetectedBackend[];
}

export interface EnhancedDetectionResult {
    projectType: ProjectType;
    frontend?: DetectedFrontend;
    backend?: DetectedBackend;
    databases: DetectedDatabase[];
    monorepo?: MonorepoInfo;
    hasDockerfile: boolean;
    hasDockerCompose: boolean;
    hasNginxConfig: boolean;
}

/**
 * Enhanced Detection Engine - Main Class
 */
export class EnhancedDetectionEngine {
    private basePath: string;

    constructor(basePath: string) {
        this.basePath = basePath;
    }

    /**
     * Main detection method - detects everything
     */
    async detect(): Promise<EnhancedDetectionResult> {
        console.log('[EnhancedDetectionEngine] Starting detection...');

        // Check if monorepo first
        const monorepoInfo = await this.detectMonorepo();

        if (monorepoInfo.isMonorepo) {
            return this.detectMonorepoProject(monorepoInfo);
        } else {
            return this.detectSingleProject();
        }
    }

    /**
     * Detect monorepo structure
     */
    private async detectMonorepo(): Promise<MonorepoInfo> {
        const packageJsonPath = path.join(this.basePath, 'package.json');

        // Check for workspace indicators
        const hasYarnWorkspaces = fs.existsSync(packageJsonPath) &&
            this.checkYarnWorkspaces(packageJsonPath);
        const hasPnpmWorkspaces = fs.existsSync(path.join(this.basePath, 'pnpm-workspace.yaml'));
        const hasLerna = fs.existsSync(path.join(this.basePath, 'lerna.json'));
        const hasNx = fs.existsSync(path.join(this.basePath, 'nx.json'));
        const hasTurbo = fs.existsSync(path.join(this.basePath, 'turbo.json'));
        const hasRush = fs.existsSync(path.join(this.basePath, 'rush.json'));

        const isMonorepo = hasYarnWorkspaces || hasPnpmWorkspaces || hasLerna || hasNx || hasTurbo || hasRush;

        if (!isMonorepo) {
            // Also check for common monorepo folder structures
            const hasAppsFolder = fs.existsSync(path.join(this.basePath, 'apps'));
            const hasPackagesFolder = fs.existsSync(path.join(this.basePath, 'packages'));

            if (hasAppsFolder || hasPackagesFolder) {
                return {
                    isMonorepo: true,
                    tool: 'yarn',
                    frontends: [],
                    backends: []
                };
            }

            return {
                isMonorepo: false,
                frontends: [],
                backends: []
            };
        }

        // Determine tool
        let tool: MonorepoInfo['tool'] = 'yarn';
        if (hasPnpmWorkspaces) tool = 'pnpm';
        if (hasLerna) tool = 'lerna';
        if (hasNx) tool = 'nx';
        if (hasTurbo) tool = 'turbo';
        if (hasRush) tool = 'rush';

        // Get workspaces
        const workspaces = await this.getWorkspaces(tool);

        return {
            isMonorepo: true,
            tool,
            workspaces,
            frontends: [],
            backends: []
        };
    }

    /**
     * Check if package.json has yarn workspaces
     */
    private checkYarnWorkspaces(packageJsonPath: string): boolean {
        try {
            const content = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            return !!content.workspaces;
        } catch {
            return false;
        }
    }

    /**
     * Get workspaces for monorepo
     */
    private async getWorkspaces(tool?: MonorepoInfo['tool']): Promise<string[]> {
        const workspaces: string[] = [];

        // Common workspace folders
        const commonFolders = [
            'apps', 'packages', 'services', 'modules', 'libs',
            'microservices', 'functions', 'projects', 'workspaces'
        ];

        for (const folder of commonFolders) {
            const folderPath = path.join(this.basePath, folder);
            if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
                const subDirs = fs.readdirSync(folderPath)
                    .filter(item => {
                        const itemPath = path.join(folderPath, item);
                        return fs.statSync(itemPath).isDirectory();
                    })
                    .map(item => `${folder}/${item}`);

                workspaces.push(...subDirs);
            }
        }

        return workspaces;
    }

    /**
     * Detect monorepo project structure
     */
    private async detectMonorepoProject(monorepoInfo: MonorepoInfo): Promise<EnhancedDetectionResult> {
        console.log('[EnhancedDetectionEngine] Detecting monorepo structure...');

        const frontends: DetectedFrontend[] = [];
        const backends: DetectedBackend[] = [];

        // Scan each workspace
        for (const workspace of monorepoInfo.workspaces || []) {
            const workspacePath = path.join(this.basePath, workspace);

            // Detect frontend
            const frontend = await this.detectFrontend(workspacePath, workspace);
            if (frontend.exists) {
                frontends.push(frontend);
            }

            // Detect backend
            const backend = await this.detectBackend(workspacePath, workspace);
            if (backend.exists) {
                backends.push(backend);
            }
        }

        monorepoInfo.frontends = frontends;
        monorepoInfo.backends = backends;

        // Detect databases
        const databases = await this.detectDatabases();

        return {
            projectType: 'monorepo',
            monorepo: monorepoInfo,
            databases,
            hasDockerfile: this.checkFileExists('Dockerfile'),
            hasDockerCompose: this.checkFileExists('docker-compose.yml') || this.checkFileExists('docker-compose.yaml'),
            hasNginxConfig: this.checkFileExists('nginx.conf')
        };
    }

    /**
     * Detect single project (non-monorepo)
     */
    private async detectSingleProject(): Promise<EnhancedDetectionResult> {
        console.log('[EnhancedDetectionEngine] Detecting single project...');

        const frontend = await this.detectFrontend(this.basePath, '.');
        const backend = await this.detectBackend(this.basePath, '.');
        const databases = await this.detectDatabases();

        // Determine project type
        let projectType: ProjectType;
        if (frontend.exists && backend.exists) {
            projectType = 'fullstack';
        } else if (frontend.exists) {
            projectType = 'frontend-only';
        } else if (backend.exists) {
            projectType = 'backend-only';
        } else {
            projectType = 'backend-only'; // Default
        }

        return {
            projectType,
            frontend: frontend.exists ? frontend : undefined,
            backend: backend.exists ? backend : undefined,
            databases,
            hasDockerfile: this.checkFileExists('Dockerfile'),
            hasDockerCompose: this.checkFileExists('docker-compose.yml') || this.checkFileExists('docker-compose.yaml'),
            hasNginxConfig: this.checkFileExists('nginx.conf')
        };
    }

    /**
     * Detect frontend framework
     */
    private async detectFrontend(basePath: string, relativePath: string): Promise<DetectedFrontend> {
        const packageJsonPath = path.join(basePath, 'package.json');

        if (!fs.existsSync(packageJsonPath)) {
            return {
                exists: false,
                framework: 'unknown',
                outputFolder: 'dist',
                buildCommand: 'npm run build',
                packageManager: 'npm',
                installCommand: 'npm ci',
                path: relativePath
            };
        }

        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

        // Detect framework
        let framework = 'unknown';
        if (dependencies['next']) framework = 'nextjs';
        else if (dependencies['react']) framework = 'react';
        else if (dependencies['vue']) framework = 'vue';
        else if (dependencies['nuxt']) framework = 'nuxt';
        else if (dependencies['@angular/core']) framework = 'angular';
        else if (dependencies['svelte']) framework = 'svelte';
        else if (dependencies['@sveltejs/kit']) framework = 'svelte';
        else if (dependencies['gatsby']) framework = 'gatsby';
        else if (dependencies['ember-cli']) framework = 'ember';
        else if (dependencies['solid-js']) framework = 'solid';

        // If no frontend framework detected, return not exists
        if (framework === 'unknown') {
            return {
                exists: false,
                framework: 'unknown',
                outputFolder: 'dist',
                buildCommand: 'npm run build',
                packageManager: 'npm',
                installCommand: 'npm ci',
                path: relativePath
            };
        }

        // Detect config files
        const hasViteConfig = fs.existsSync(path.join(basePath, 'vite.config.js')) ||
            fs.existsSync(path.join(basePath, 'vite.config.ts'));
        const hasCRAConfig = !!dependencies['react-scripts'];
        const hasNextConfig = fs.existsSync(path.join(basePath, 'next.config.js')) ||
            fs.existsSync(path.join(basePath, 'next.config.mjs'));
        const hasAngularJson = fs.existsSync(path.join(basePath, 'angular.json'));
        const hasSvelteKitConfig = fs.existsSync(path.join(basePath, 'svelte.config.js'));

        // Read config content if needed
        let nextConfigContent: any = {};
        let angularJsonContent: any = {};

        if (hasNextConfig) {
            // Try to read next config (might need parsing for actual values)
            try {
                const nextConfigPath = fs.existsSync(path.join(basePath, 'next.config.js'))
                    ? path.join(basePath, 'next.config.js')
                    : path.join(basePath, 'next.config.mjs');
                const configText = fs.readFileSync(nextConfigPath, 'utf-8');
                // Simple check for output: 'export'
                if (configText.includes("output: 'export'")) {
                    nextConfigContent.output = 'export';
                }
            } catch (err) {
                console.log('[EnhancedDetectionEngine] Could not read next.config.js');
            }
        }

        if (hasAngularJson) {
            angularJsonContent = JSON.parse(fs.readFileSync(path.join(basePath, 'angular.json'), 'utf-8'));
        }

        // Get output folder info
        const outputInfo = this.getCompleteFrameworkInfo(
            framework,
            basePath,
            packageJson,
            {
                hasViteConfig,
                hasCRAConfig,
                hasNextConfig,
                nextConfigContent,
                hasAngularJson,
                angularJsonContent,
                hasSvelteKitConfig
            }
        );

        return {
            exists: true,
            framework: outputInfo.framework,
            variant: outputInfo.variant,
            outputFolder: outputInfo.outputFolder,
            buildCommand: outputInfo.buildCommand,
            packageManager: outputInfo.packageManager,
            installCommand: outputInfo.installCommand,
            path: relativePath,
            port: 3000
        };
    }

    /**
     * Detect backend framework
     */
    private async detectBackend(basePath: string, relativePath: string): Promise<DetectedBackend> {
        // Check for Node.js backend
        const packageJsonPath = path.join(basePath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

            // Check if it's a backend (not frontend)
            const isBackend = !!(
                dependencies['express'] ||
                dependencies['koa'] ||
                dependencies['fastify'] ||
                dependencies['@nestjs/core'] ||
                dependencies['hapi']
            );

            if (isBackend) {
                let framework = 'node-express';
                if (dependencies['@nestjs/core']) framework = 'node-nestjs';
                else if (dependencies['koa']) framework = 'node-koa';
                else if (dependencies['fastify']) framework = 'node-fastify';
                else if (dependencies['hapi']) framework = 'node-hapi';

                const packageManager = this.detectPackageManager(basePath);

                // Try to detect start script and entry point
                const startScript = packageJson.scripts?.start || 'node server.js';
                const mainFile = packageJson.main || 'index.js';
                
                // Detect actual entry point from start script
                let entryPoint = 'server.js';
                if (startScript.includes('node ')) {
                    const match = startScript.match(/node\s+([^\s]+)/);
                    if (match) entryPoint = match[1];
                } else if (mainFile) {
                    entryPoint = mainFile;
                }

                return {
                    exists: true,
                    framework,
                    language: 'node',
                    packageManager,
                    path: relativePath,
                    port: 8000,
                    dependencies: { ...packageJson.dependencies, ...packageJson.devDependencies },
                    entryPoint
                };
            }
        }

        // Check for Python backend
        const requirementsPath = path.join(basePath, 'requirements.txt');
        const pyprojectPath = path.join(basePath, 'pyproject.toml');

        if (fs.existsSync(requirementsPath) || fs.existsSync(pyprojectPath)) {
            let framework = 'python-flask';
            let packageManager = 'pip';
            let entryPoint = 'app.py';

            if (fs.existsSync(requirementsPath)) {
                const requirements = fs.readFileSync(requirementsPath, 'utf-8');
                if (requirements.includes('fastapi')) {
                    framework = 'python-fastapi';
                    entryPoint = 'main.py';
                } else if (requirements.includes('django')) {
                    framework = 'python-django';
                    entryPoint = 'manage.py';
                } else if (requirements.includes('flask')) {
                    framework = 'python-flask';
                    entryPoint = 'app.py';
                }
            }

            // Check for actual Python files
            const possibleEntryPoints = ['main.py', 'app.py', 'server.py', 'manage.py', 'run.py'];
            for (const file of possibleEntryPoints) {
                if (fs.existsSync(path.join(basePath, file))) {
                    entryPoint = file;
                    break;
                }
            }

            if (fs.existsSync(pyprojectPath)) {
                const pyproject = fs.readFileSync(pyprojectPath, 'utf-8');
                if (pyproject.includes('poetry')) packageManager = 'poetry';
                else if (pyproject.includes('pipenv')) packageManager = 'pipenv';
            }

            return {
                exists: true,
                framework,
                language: 'python',
                packageManager,
                path: relativePath,
                port: 8000,
                entryPoint
            };
        }

        // Check for Go backend
        const goModPath = path.join(basePath, 'go.mod');
        if (fs.existsSync(goModPath)) {
            const goMod = fs.readFileSync(goModPath, 'utf-8');
            let framework = 'go-gin';

            if (goMod.includes('github.com/gin-gonic/gin')) framework = 'go-gin';
            else if (goMod.includes('github.com/gofiber/fiber')) framework = 'go-fiber';
            else if (goMod.includes('github.com/labstack/echo')) framework = 'go-echo';

            return {
                exists: true,
                framework,
                language: 'go',
                path: relativePath,
                port: 8000
            };
        }

        // Check for Java backend
        const pomPath = path.join(basePath, 'pom.xml');
        const gradlePath = path.join(basePath, 'build.gradle');

        if (fs.existsSync(pomPath) || fs.existsSync(gradlePath)) {
            return {
                exists: true,
                framework: 'java-spring-boot',
                language: 'java',
                packageManager: fs.existsSync(pomPath) ? 'maven' : 'gradle',
                path: relativePath,
                port: 8080
            };
        }

        // Check for PHP backend
        const composerPath = path.join(basePath, 'composer.json');
        if (fs.existsSync(composerPath)) {
            const composer = JSON.parse(fs.readFileSync(composerPath, 'utf-8'));
            let framework = 'php-laravel';

            if (composer.require && composer.require['laravel/framework']) framework = 'php-laravel';
            else if (composer.require && composer.require['symfony/symfony']) framework = 'php-symfony';

            return {
                exists: true,
                framework,
                language: 'php',
                packageManager: 'composer',
                path: relativePath,
                port: 8000
            };
        }

        // No backend detected
        return {
            exists: false,
            framework: 'unknown',
            language: 'node',
            path: relativePath
        };
    }

    /**
     * Detect databases from environment files, docker-compose, and dependencies
     */
    private async detectDatabases(): Promise<DetectedDatabase[]> {
        const databases: DetectedDatabase[] = [];

        // 1. Check for database dependencies in package.json (Node.js)
        const packageJsonPath = path.join(this.basePath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

                // PostgreSQL
                if (allDeps['pg'] || allDeps['postgres'] || allDeps['typeorm'] || allDeps['sequelize'] || allDeps['knex']) {
                    if (!databases.some(db => db.type === 'postgres')) {
                        databases.push({ exists: true, type: 'postgres', port: 5432, version: '15-alpine' });
                    }
                }

                // MySQL/MariaDB
                if (allDeps['mysql'] || allDeps['mysql2']) {
                    if (!databases.some(db => db.type === 'mysql')) {
                        databases.push({ exists: true, type: 'mysql', port: 3306, version: '8-oracle' });
                    }
                }

                // MongoDB
                if (allDeps['mongodb'] || allDeps['mongoose']) {
                    if (!databases.some(db => db.type === 'mongodb')) {
                        databases.push({ exists: true, type: 'mongodb', port: 27017, version: '7' });
                    }
                }

                // Redis
                if (allDeps['redis'] || allDeps['ioredis']) {
                    if (!databases.some(db => db.type === 'redis')) {
                        databases.push({ exists: true, type: 'redis', port: 6379, version: '7-alpine' });
                    }
                }
            } catch (err) {
                // Ignore JSON parse errors
            }
        }

        // 2. Check for Python dependencies in requirements.txt
        const requirementsPath = path.join(this.basePath, 'requirements.txt');
        if (fs.existsSync(requirementsPath)) {
            const requirements = fs.readFileSync(requirementsPath, 'utf-8').toLowerCase();

            if ((requirements.includes('psycopg2') || requirements.includes('asyncpg')) && !databases.some(db => db.type === 'postgres')) {
                databases.push({ exists: true, type: 'postgres', port: 5432, version: '15-alpine' });
            }

            if ((requirements.includes('pymysql') || requirements.includes('mysql-connector')) && !databases.some(db => db.type === 'mysql')) {
                databases.push({ exists: true, type: 'mysql', port: 3306, version: '8-oracle' });
            }

            if (requirements.includes('pymongo') && !databases.some(db => db.type === 'mongodb')) {
                databases.push({ exists: true, type: 'mongodb', port: 27017, version: '7' });
            }

            if (requirements.includes('redis') && !databases.some(db => db.type === 'redis')) {
                databases.push({ exists: true, type: 'redis', port: 6379, version: '7-alpine' });
            }
        }

        // 3. Check for docker-compose.yml
        const composePaths = [
            path.join(this.basePath, 'docker-compose.yml'),
            path.join(this.basePath, 'docker-compose.yaml')
        ];

        for (const composePath of composePaths) {
            if (fs.existsSync(composePath)) {
                const composeContent = fs.readFileSync(composePath, 'utf-8');

                if (composeContent.includes('postgres') && !databases.some(db => db.type === 'postgres')) {
                    databases.push({ exists: true, type: 'postgres', port: 5432, version: '15-alpine' });
                }
                if (composeContent.includes('mysql') && !databases.some(db => db.type === 'mysql')) {
                    databases.push({ exists: true, type: 'mysql', port: 3306, version: '8-oracle' });
                }
                if (composeContent.includes('mongo') && !databases.some(db => db.type === 'mongodb')) {
                    databases.push({ exists: true, type: 'mongodb', port: 27017, version: '7' });
                }
                if (composeContent.includes('redis') && !databases.some(db => db.type === 'redis')) {
                    databases.push({ exists: true, type: 'redis', port: 6379, version: '7-alpine' });
                }
            }
        }

        // 4. Check for .env files
        const envPath = path.join(this.basePath, '.env');
        const envExamplePath = path.join(this.basePath, '.env.example');
        
        for (const envFile of [envPath, envExamplePath]) {
            if (fs.existsSync(envFile)) {
                const envContent = fs.readFileSync(envFile, 'utf-8').toUpperCase();

                if ((envContent.includes('POSTGRES') || envContent.includes('DATABASE_URL=postgres')) && !databases.some(db => db.type === 'postgres')) {
                    databases.push({ exists: true, type: 'postgres', port: 5432, version: '15-alpine' });
                }
                if (envContent.includes('MYSQL') && !databases.some(db => db.type === 'mysql')) {
                    databases.push({ exists: true, type: 'mysql', port: 3306, version: '8-oracle' });
                }
                if ((envContent.includes('MONGO') || envContent.includes('MONGODB')) && !databases.some(db => db.type === 'mongodb')) {
                    databases.push({ exists: true, type: 'mongodb', port: 27017, version: '7' });
                }
                if (envContent.includes('REDIS') && !databases.some(db => db.type === 'redis')) {
                    databases.push({ exists: true, type: 'redis', port: 6379, version: '7-alpine' });
                }
            }
        }

        return databases;
    }

    /**
     * Check if file exists
     */
    private checkFileExists(filename: string): boolean {
        return fs.existsSync(path.join(this.basePath, filename));
    }

    /**
     * Detect package manager from lock files
     */
    private detectPackageManager(basePath: string): 'npm' | 'yarn' | 'pnpm' {
        if (fs.existsSync(path.join(basePath, 'pnpm-lock.yaml'))) {
            return 'pnpm';
        }
        if (fs.existsSync(path.join(basePath, 'yarn.lock'))) {
            return 'yarn';
        }
        return 'npm';
    }

    /**
     * Get the correct install command based on package manager
     */
    private getInstallCommand(packageManager: 'npm' | 'yarn' | 'pnpm', production: boolean = false): string {
        switch (packageManager) {
            case 'npm':
                return production ? 'npm ci --only=production' : 'npm ci';
            case 'yarn':
                return production ? 'yarn install --production' : 'yarn install';
            case 'pnpm':
                return production ? 'pnpm install --prod' : 'pnpm install';
            default:
                return 'npm install';
        }
    }

    /**
     * Get the correct build command with package manager
     */
    private getBuildCommand(packageManager: 'npm' | 'yarn' | 'pnpm', customCommand?: string): string {
        const command = customCommand || 'build';

        switch (packageManager) {
            case 'npm':
                return `npm run ${command}`;
            case 'yarn':
                return `yarn ${command}`;
            case 'pnpm':
                return `pnpm ${command}`;
            default:
                return `npm run ${command}`;
        }
    }

    /**
     * Detect actual build command and output folder from package.json
     */
    private detectBuildConfigFromPackageJson(packageJson: any, basePath: string): { buildCommand: string; outputFolder: string } {
        const scripts = packageJson.scripts || {};
        const buildScript = scripts.build || '';
        
        // Try to detect output folder from build script
        let outputFolder = 'dist'; // default
        
        // Check for common patterns in build script
        if (buildScript.includes('--outDir')) {
            const match = buildScript.match(/--outDir[=\s]+([^\s]+)/);
            if (match) outputFolder = match[1];
        } else if (buildScript.includes('--out-dir')) {
            const match = buildScript.match(/--out-dir[=\s]+([^\s]+)/);
            if (match) outputFolder = match[1];
        } else if (buildScript.includes('BUILD_PATH=')) {
            const match = buildScript.match(/BUILD_PATH=([^\s]+)/);
            if (match) outputFolder = match[1];
        }
        
        // Check for CRA (react-scripts build) - outputs to 'build'
        if (buildScript.includes('react-scripts build')) {
            outputFolder = 'build';
        }
        
        // Check for Next.js static export
        if (buildScript.includes('next build') && buildScript.includes('next export')) {
            outputFolder = 'out';
        }
        
        // Check for vite.config.js/ts for custom build output
        try {
            const viteConfigPath = fs.existsSync(path.join(basePath, 'vite.config.ts')) 
                ? path.join(basePath, 'vite.config.ts')
                : path.join(basePath, 'vite.config.js');
            
            if (fs.existsSync(viteConfigPath)) {
                const viteConfig = fs.readFileSync(viteConfigPath, 'utf-8');
                const outDirMatch = viteConfig.match(/outDir:\s*['"]([^'"]+)['"]/);
                if (outDirMatch) {
                    outputFolder = outDirMatch[1];
                }
            }
        } catch (err) {
            // Ignore errors
        }
        
        const buildCommand = scripts.build || 'npm run build';
        
        return { buildCommand, outputFolder };
    }

    /**
     * Get complete framework info including everything needed for Dockerfile
     */
    private getCompleteFrameworkInfo(
        framework: string,
        basePath: string,
        packageJson?: any,
        configFiles?: any
    ): FrameworkOutputInfo & { installCommand: string; packageManager: 'npm' | 'yarn' | 'pnpm' } {
        const packageManager = this.detectPackageManager(basePath);
        const installCommand = this.getInstallCommand(packageManager, false);
        let buildCommand = this.getBuildCommand(packageManager, 'build');
        let outputFolder = 'dist'; // default
        let variant = undefined;
        let isSSR = false;

        // Detect framework-specific defaults
        if (framework === 'react') {
            const hasVite = configFiles?.hasViteConfig || false;
            const hasCRA = configFiles?.hasCRAConfig || false;
            if (hasCRA) {
                outputFolder = 'build';
                variant = 'cra';
            } else {
                outputFolder = 'dist';
                variant = 'vite';
            }
        } else if (framework === 'nextjs') {
            const isStatic = configFiles?.nextConfigContent?.output === 'export';
            if (isStatic) {
                outputFolder = 'out';
                variant = 'static';
            } else {
                outputFolder = '.next';
                variant = 'ssr';
                isSSR = true;
            }
        } else if (framework === 'angular') {
            const angularJson = configFiles?.angularJsonContent;
            if (angularJson?.projects) {
                const projectName = Object.keys(angularJson.projects)[0];
                outputFolder = angularJson.projects[projectName]?.architect?.build?.options?.outputPath || 'dist';
            }
        } else if (framework === 'vue') {
            outputFolder = 'dist';
        } else if (framework === 'svelte') {
            if (configFiles?.hasSvelteKitConfig) {
                outputFolder = 'build';
                variant = 'kit';
                isSSR = true;
            } else {
                outputFolder = 'dist';
                variant = 'vite';
            }
        } else if (framework === 'gatsby') {
            outputFolder = 'public';
        } else if (framework === 'nuxt') {
            outputFolder = '.output/public';
            isSSR = true;
        }
        
        // Try to detect actual build configuration from package.json
        if (packageJson) {
            const detected = this.detectBuildConfigFromPackageJson(packageJson, basePath);
            if (detected.buildCommand && detected.buildCommand !== 'npm run build') {
                buildCommand = this.getBuildCommand(packageManager, 'build');
            }
            if (detected.outputFolder && detected.outputFolder !== 'dist') {
                outputFolder = detected.outputFolder;
            }
        }

        return {
            framework,
            variant,
            outputFolder,
            buildCommand,
            packageManager,
            installCommand,
            isSSR
        };
    }
}
