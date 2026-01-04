/**
 * Blueprint Types and Definitions
 * 
 * Blueprints define the service topology for Docker generation.
 * They are STATIC and DETERMINISTIC - cannot be modified by AI.
 * 
 * Architecture Rule: Use predefined blueprints only.
 */

export type BlueprintType =
    | 'frontend-only-nginx'           // Single frontend with Nginx
    | 'backend-only'                  // Single backend only
    | 'frontend-backend-nginx'        // One frontend + one backend + Nginx
    | 'frontend-backend-db-cache'     // Full stack with database and cache
    | 'multi-frontend-backend-nginx'  // Multiple frontends + backend + Nginx
    | 'multi-frontend-nginx'          // Multiple frontends + Nginx (no backend)
    | 'monorepo-fullstack';           // Monorepo with multiple apps

export interface ServiceDefinition {
    name: string;
    type: 'frontend' | 'backend' | 'database' | 'cache' | 'nginx' | 'queue';
    required: boolean;
    port?: number;
    nginxRoute?: string;  // Path for nginx routing (e.g., '/', '/api', '/admin')
    dependsOn?: string[]; // Service dependencies
}

export interface Blueprint {
    type: BlueprintType;
    description: string;
    services: ServiceDefinition[];
    nginxRequired: boolean;
    composeVersion: string;
}

/**
 * Predefined Blueprint Catalog
 * THESE ARE THE ONLY VALID BLUEPRINTS
 */
export const BLUEPRINTS: Record<BlueprintType, Blueprint> = {
    'frontend-only-nginx': {
        type: 'frontend-only-nginx',
        description: 'Single frontend application served via Nginx',
        services: [
            { name: 'frontend', type: 'frontend', required: true, port: 80, nginxRoute: '/' }
        ],
        nginxRequired: true,
        composeVersion: '3.8'
    },

    'backend-only': {
        type: 'backend-only',
        description: 'Single backend API service',
        services: [
            { name: 'backend', type: 'backend', required: true, port: 3000 }
        ],
        nginxRequired: false,
        composeVersion: '3.8'
    },

    'frontend-backend-nginx': {
        type: 'frontend-backend-nginx',
        description: 'Frontend + Backend with Nginx reverse proxy',
        services: [
            { name: 'frontend', type: 'frontend', required: true, port: 80, nginxRoute: '/', dependsOn: ['backend'] },
            { name: 'backend', type: 'backend', required: true, port: 3000, nginxRoute: '/api' }
        ],
        nginxRequired: true,
        composeVersion: '3.8'
    },

    'frontend-backend-db-cache': {
        type: 'frontend-backend-db-cache',
        description: 'Full stack with database and cache',
        services: [
            { name: 'frontend', type: 'frontend', required: true, port: 80, nginxRoute: '/', dependsOn: ['backend'] },
            { name: 'backend', type: 'backend', required: true, port: 3000, nginxRoute: '/api', dependsOn: ['database', 'cache'] },
            { name: 'database', type: 'database', required: true, port: 5432 },
            { name: 'cache', type: 'cache', required: true, port: 6379 }
        ],
        nginxRequired: true,
        composeVersion: '3.8'
    },

    'multi-frontend-backend-nginx': {
        type: 'multi-frontend-backend-nginx',
        description: 'Multiple frontends with shared backend and Nginx routing',
        services: [
            { name: 'frontend_web', type: 'frontend', required: true, nginxRoute: '/' },
            { name: 'frontend_admin', type: 'frontend', required: true, nginxRoute: '/admin' },
            { name: 'backend', type: 'backend', required: true, port: 3000, nginxRoute: '/api' },
            { name: 'nginx', type: 'nginx', required: true, port: 80, dependsOn: ['frontend_web', 'frontend_admin'] }
        ],
        nginxRequired: true,
        composeVersion: '3.8'
    },

    'multi-frontend-nginx': {
        type: 'multi-frontend-nginx',
        description: 'Multiple frontends with Nginx routing (no backend)',
        services: [
            { name: 'frontend_web', type: 'frontend', required: true, nginxRoute: '/' },
            { name: 'frontend_admin', type: 'frontend', required: true, nginxRoute: '/admin' },
            { name: 'nginx', type: 'nginx', required: true, port: 80, dependsOn: ['frontend_web', 'frontend_admin'] }
        ],
        nginxRequired: true,
        composeVersion: '3.8'
    },

    'monorepo-fullstack': {
        type: 'monorepo-fullstack',
        description: 'Monorepo with multiple independently deployable apps',
        services: [
            // Services are dynamically added based on detection
            // But must follow the same rules as other blueprints
        ],
        nginxRequired: true, // If any frontend exists
        composeVersion: '3.8'
    }
};

/**
 * Blueprint Selector
 * Determines which blueprint to use based on detected services
 */
export class BlueprintSelector {
    
    /**
     * Select appropriate blueprint based on detection results
     * RULE: Never guess - use strict matching
     */
    static selectBlueprint(params: {
        frontendCount: number;
        backendCount: number;
        hasDatabase: boolean;
        hasCache: boolean;
        isMonorepo: boolean;
    }): Blueprint {
        const { frontendCount, backendCount, hasDatabase, hasCache, isMonorepo } = params;

        // Monorepo always uses monorepo blueprint
        if (isMonorepo) {
            return BLUEPRINTS['monorepo-fullstack'];
        }

        // Multiple frontends
        if (frontendCount > 1) {
            if (backendCount > 0) {
                return BLUEPRINTS['multi-frontend-backend-nginx'];
            }
            return BLUEPRINTS['multi-frontend-nginx'];
        }

        // Single frontend + backend + infrastructure
        if (frontendCount === 1 && backendCount === 1) {
            if (hasDatabase || hasCache) {
                return BLUEPRINTS['frontend-backend-db-cache'];
            }
            return BLUEPRINTS['frontend-backend-nginx'];
        }

        // Frontend only
        if (frontendCount === 1 && backendCount === 0) {
            return BLUEPRINTS['frontend-only-nginx'];
        }

        // Backend only
        if (frontendCount === 0 && backendCount === 1) {
            return BLUEPRINTS['backend-only'];
        }

        // Default fallback: backend only (safest assumption)
        console.warn('[BlueprintSelector] Could not determine blueprint, using backend-only as safe default');
        return BLUEPRINTS['backend-only'];
    }

    /**
     * Validate if a blueprint can be used with given services
     */
    static validateBlueprint(blueprint: Blueprint, detectedServices: {
        frontends: number;
        backends: number;
    }): { valid: boolean; reason?: string } {
        const requiredFrontends = blueprint.services.filter(s => s.type === 'frontend' && s.required).length;
        const requiredBackends = blueprint.services.filter(s => s.type === 'backend' && s.required).length;

        if (detectedServices.frontends < requiredFrontends) {
            return { 
                valid: false, 
                reason: `Blueprint requires ${requiredFrontends} frontend(s), but only ${detectedServices.frontends} detected` 
            };
        }

        if (detectedServices.backends < requiredBackends) {
            return { 
                valid: false, 
                reason: `Blueprint requires ${requiredBackends} backend(s), but only ${detectedServices.backends} detected` 
            };
        }

        return { valid: true };
    }
}
