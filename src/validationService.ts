/**
 * Validation Service
 * 
 * Enforces safety rules and validates generated Docker configurations
 * before writing files to disk.
 * 
 * Goal: Prevent bad configurations from reaching production
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export class DockerValidationService {

    /**
     * Validate Dockerfile syntax and best practices
     */
    static validateDockerfile(content: string, type: 'frontend' | 'backend'): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        const lines = content.split('\n').map(l => l.trim());

        // RULE: Must have FROM instruction
        if (!lines.some(l => l.toUpperCase().startsWith('FROM '))) {
            errors.push('Dockerfile must contain at least one FROM instruction');
        }

        // RULE: Frontend must use multi-stage build
        if (type === 'frontend') {
            const fromCount = lines.filter(l => l.toUpperCase().startsWith('FROM ')).length;
            if (fromCount < 2) {
                errors.push('Frontend Dockerfile must use multi-stage build (at least 2 FROM instructions)');
            }

            // RULE: Frontend must end with nginx
            const lastFrom = lines.reverse().find(l => l.toUpperCase().startsWith('FROM '));
            if (lastFrom && !lastFrom.toLowerCase().includes('nginx')) {
                errors.push('Frontend production stage must use Nginx (FROM nginx:alpine)');
            }
            lines.reverse(); // restore order

            // RULE: Frontend must not run node in production
            if (content.includes('CMD ["node"') || content.includes('CMD ["npm", "start"')) {
                errors.push('Frontend must not use Node.js in production runtime');
            }
        }

        // RULE: Backend multi-stage recommended
        if (type === 'backend') {
            const fromCount = lines.filter(l => l.toUpperCase().startsWith('FROM ')).length;
            if (fromCount < 2) {
                warnings.push('Backend should use multi-stage build for smaller images');
            }
        }

        // RULE: Must have WORKDIR
        if (!lines.some(l => l.toUpperCase().startsWith('WORKDIR '))) {
            warnings.push('Dockerfile should specify WORKDIR');
        }

        // RULE: Must have EXPOSE or CMD
        const hasExpose = lines.some(l => l.toUpperCase().startsWith('EXPOSE '));
        const hasCmd = lines.some(l => l.toUpperCase().startsWith('CMD ') || l.toUpperCase().startsWith('ENTRYPOINT '));

        if (!hasCmd) {
            errors.push('Dockerfile must have CMD or ENTRYPOINT instruction');
        }

        // RULE: Should have health check
        if (!lines.some(l => l.toUpperCase().startsWith('HEALTHCHECK '))) {
            warnings.push('Production Dockerfile should include HEALTHCHECK');
        }

        // RULE: Avoid latest tag
        const fromWithLatest = lines.filter(l =>
            l.toUpperCase().startsWith('FROM ') && l.includes(':latest')
        );
        if (fromWithLatest.length > 0) {
            warnings.push('Avoid using :latest tag in production, specify version explicitly');
        }

        // RULE: Use --no-cache-dir for pip
        if (content.includes('pip install') && !content.includes('--no-cache-dir')) {
            warnings.push('Use pip install --no-cache-dir to reduce image size');
        }

        // RULE: Combine RUN commands
        const runCount = lines.filter(l => l.toUpperCase().startsWith('RUN ')).length;
        if (runCount > 10) {
            warnings.push('Consider combining RUN commands to reduce layers');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate docker-compose.yml structure
     */
    static validateCompose(content: string): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Basic YAML syntax check
        try {
            // Simple checks for common issues
            // Note: 'version' is optional in Compose V2 specifications
            /* if (!content.includes('version:')) {
                errors.push('docker-compose.yml must specify version');
            } */

            if (!content.includes('services:')) {
                errors.push('docker-compose.yml must have services section');
            }

            // Check for common mistakes
            if (content.includes('  depends_on') && !content.includes('depends_on:')) {
                errors.push('depends_on must be followed by colon');
            }

            // RULE: Services should have restart policy
            if (content.includes('services:') && !content.includes('restart:')) {
                warnings.push('Services should specify restart policy (e.g., restart: unless-stopped)');
            }

            // RULE: Should use networks
            if (!content.includes('networks:')) {
                warnings.push('Consider defining networks for better service isolation');
            }

            // RULE: Databases should use volumes
            const hasDatabase = content.includes('postgres') || content.includes('mysql') ||
                content.includes('mongodb') || content.includes('redis');
            const hasVolumes = content.includes('volumes:');

            if (hasDatabase && !hasVolumes) {
                warnings.push('Database services should use volumes for data persistence');
            }

            // RULE: Check for exposed ports
            if (!content.includes('ports:')) {
                warnings.push('At least one service should expose ports');
            }

        } catch (error) {
            errors.push('Invalid YAML syntax in docker-compose.yml');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate Nginx configuration
     */
    static validateNginxConfig(content: string): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // RULE: Must have server block
        if (!content.includes('server {')) {
            errors.push('Nginx config must have at least one server block');
        }

        // RULE: Must have listen directive
        if (!content.includes('listen ')) {
            errors.push('Nginx server must have listen directive');
        }

        // RULE: Should have location blocks
        if (!content.includes('location ')) {
            errors.push('Nginx server must have location blocks');
        }

        // RULE: Should enable gzip
        if (!content.includes('gzip on')) {
            warnings.push('Enable gzip compression for better performance');
        }

        // RULE: Should have security headers
        const securityHeaders = ['X-Frame-Options', 'X-Content-Type-Options', 'X-XSS-Protection'];
        const missingHeaders = securityHeaders.filter(h => !content.includes(h));

        if (missingHeaders.length > 0) {
            warnings.push(`Consider adding security headers: ${missingHeaders.join(', ')}`);
        }

        // RULE: Backend proxying should have proper headers
        if (content.includes('proxy_pass') && !content.includes('proxy_set_header')) {
            warnings.push('Proxy locations should set proper headers (Host, X-Real-IP, X-Forwarded-For)');
        }

        // RULE: Should have health check endpoint
        if (!content.includes('location /health') && !content.includes('location /nginx-health')) {
            warnings.push('Consider adding health check endpoint for monitoring');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate .dockerignore
     */
    static validateDockerignore(content: string): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

        // RULE: Should ignore node_modules
        if (!lines.some(l => l === 'node_modules' || l === 'node_modules/')) {
            warnings.push('.dockerignore should include node_modules/');
        }

        // RULE: Should ignore .git
        if (!lines.some(l => l === '.git' || l === '.git/')) {
            warnings.push('.dockerignore should include .git/');
        }

        // RULE: Should ignore environment files
        if (!lines.some(l => l.includes('.env'))) {
            warnings.push('.dockerignore should include .env files');
        }

        // RULE: Should ignore build outputs
        const buildDirs = ['dist/', 'build/', 'coverage/', '.next/'];
        const hasBuildIgnore = buildDirs.some(d => lines.includes(d));

        if (!hasBuildIgnore) {
            warnings.push('.dockerignore should include build output directories');
        }

        return {
            valid: true, // .dockerignore errors are never fatal
            errors,
            warnings
        };
    }

    /**
     * Validate multi-frontend architecture
     */
    static validateMultiFrontendArchitecture(files: {
        dockerfiles: Array<{ path: string; content: string }>;
        dockerCompose: string;
        nginxConf?: string;
    }): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        const frontendDockerfiles = files.dockerfiles.filter(df =>
            df.path.includes('frontend') || df.path.includes('web') || df.path.includes('admin')
        );

        if (frontendDockerfiles.length > 1) {
            // RULE: Multiple frontends must have Nginx
            if (!files.nginxConf) {
                errors.push('Multiple frontends require Nginx reverse proxy configuration');
            }

            // RULE: Each frontend must have its own Dockerfile
            const frontendPaths = new Set(frontendDockerfiles.map(df => path.dirname(df.path)));
            if (frontendPaths.size < frontendDockerfiles.length) {
                errors.push('Each frontend must have its own Dockerfile in separate directory');
            }

            // RULE: Nginx must route to all frontends
            if (files.nginxConf) {
                const serviceNames = frontendDockerfiles.map(df => {
                    const dirName = path.dirname(df.path);
                    return path.basename(dirName);
                });

                const missingRoutes = serviceNames.filter(name =>
                    !files.nginxConf!.includes(name)
                );

                if (missingRoutes.length > 0) {
                    errors.push(`Nginx config missing routes for: ${missingRoutes.join(', ')}`);
                }
            }

            // RULE: docker-compose must define all frontend services
            frontendDockerfiles.forEach(df => {
                const serviceName = path.basename(path.dirname(df.path));
                if (!files.dockerCompose.includes(serviceName)) {
                    errors.push(`docker-compose.yml missing service: ${serviceName}`);
                }
            });
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate complete generation result
     */
    static validateGenerationResult(files: {
        dockerfiles: Array<{ path: string; content: string }>;
        dockerCompose: string;
        nginxConf?: string;
        dockerignore: string;
    }): ValidationResult {
        const allErrors: string[] = [];
        const allWarnings: string[] = [];

        // Validate each Dockerfile
        files.dockerfiles.forEach(df => {
            const type = df.path.includes('frontend') || df.path.includes('web') ? 'frontend' : 'backend';
            const result = this.validateDockerfile(df.content, type);

            if (!result.valid) {
                allErrors.push(`${df.path}: ${result.errors.join(', ')}`);
            }
            allWarnings.push(...result.warnings.map(w => `${df.path}: ${w}`));
        });

        // Validate docker-compose.yml
        const composeResult = this.validateCompose(files.dockerCompose);
        allErrors.push(...composeResult.errors);
        allWarnings.push(...composeResult.warnings);

        // Validate Nginx config
        if (files.nginxConf) {
            const nginxResult = this.validateNginxConfig(files.nginxConf);
            allErrors.push(...nginxResult.errors);
            allWarnings.push(...nginxResult.warnings);
        }

        // Validate .dockerignore
        const dockerignoreResult = this.validateDockerignore(files.dockerignore);
        allWarnings.push(...dockerignoreResult.warnings);

        // Validate multi-frontend architecture
        const archResult = this.validateMultiFrontendArchitecture(files);
        allErrors.push(...archResult.errors);
        allWarnings.push(...archResult.warnings);

        return {
            valid: allErrors.length === 0,
            errors: allErrors,
            warnings: allWarnings
        };
    }

    /**
     * Stop generation if validation fails
     * Returns true if should proceed, false if should stop
     */
    static shouldProceedAfterValidation(result: ValidationResult): boolean {
        if (!result.valid) {
            console.error('[Validation] CRITICAL ERRORS - Generation stopped:');
            result.errors.forEach(e => console.error(`  ❌ ${e}`));
            return false;
        }

        if (result.warnings.length > 0) {
            console.warn('[Validation] Warnings (proceeding with caution):');
            result.warnings.forEach(w => console.warn(`  ⚠️  ${w}`));
        }

        return true;
    }
}
