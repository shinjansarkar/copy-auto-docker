/**
 * Docker Compose Template Manager
 * 
 * Generates docker-compose.yml based on blueprints.
 * RULE: Template-driven, production-ready configurations only.
 */

import { Blueprint } from '../../blueprints/blueprintTypes';

export interface ServiceConfig {
    name: string;
    type: 'frontend' | 'backend' | 'database' | 'cache' | 'nginx' | 'queue';
    buildContext?: string;
    dockerfile?: string;
    image?: string;
    port?: number;
    internalPort?: number;
    environment?: Record<string, string>;
    volumes?: string[];
    dependsOn?: string[] | Record<string, { condition: string }>;
    healthCheck?: {
        test: string;
        interval: string;
        timeout: string;
        retries: number;
    };
}

export class ComposeTemplateManager {

    /**
     * Generate docker-compose.yml from services
     */
    static generateCompose(services: ServiceConfig[], blueprint: Blueprint): string {
        const serviceBlocks = services.map(s => this.generateServiceBlock(s)).join('\n\n');
        const volumes = this.generateVolumes(services);
        const networks = this.generateNetworks();

        return `services:
${serviceBlocks}

${volumes}
${networks}
`;
    }

    /**
     * Generate individual service block
     */
    private static generateServiceBlock(service: ServiceConfig): string {
        const lines: string[] = [`  ${service.name}:`];

        // Build or Image
        if (service.buildContext) {
            lines.push(`    build:`);
            lines.push(`      context: ${service.buildContext}`);
            if (service.dockerfile) {
                lines.push(`      dockerfile: ${service.dockerfile}`);
            }
        } else if (service.image) {
            lines.push(`    image: ${service.image}`);
        }

        // Container name
        lines.push(`    container_name: ${service.name}`);

        // Restart policy
        lines.push(`    restart: unless-stopped`);

        // Ports
        if (service.port) {
            const internal = service.internalPort || service.port;
            lines.push(`    ports:`);
            lines.push(`      - "${service.port}:${internal}"`);
        }

        // Environment
        if (service.environment && Object.keys(service.environment).length > 0) {
            lines.push(`    environment:`);
            Object.entries(service.environment).forEach(([key, value]) => {
                lines.push(`      ${key}: ${value}`);
            });
        }

        // Volumes
        if (service.volumes && service.volumes.length > 0) {
            lines.push(`    volumes:`);
            service.volumes.forEach(vol => {
                lines.push(`      - ${vol}`);
            });
        }

        // Depends on
        if (service.dependsOn) {
            const isArray = Array.isArray(service.dependsOn);
            const hasItems = isArray ? (service.dependsOn as string[]).length > 0 : Object.keys(service.dependsOn).length > 0;

            if (hasItems) {
                lines.push(`    depends_on:`);
                if (isArray) {
                    (service.dependsOn as string[]).forEach(dep => {
                        lines.push(`      - ${dep}`);
                    });
                } else {
                    Object.entries(service.dependsOn).forEach(([dep, config]) => {
                        lines.push(`      ${dep}:`);
                        lines.push(`        condition: ${config.condition}`);
                    });
                }
            }
        }

        // Health check
        if (service.healthCheck) {
            lines.push(`    healthcheck:`);
            lines.push(`      test: ${service.healthCheck.test}`);
            lines.push(`      interval: ${service.healthCheck.interval}`);
            lines.push(`      timeout: ${service.healthCheck.timeout}`);
            lines.push(`      retries: ${service.healthCheck.retries}`);
        }

        // Networks
        lines.push(`    networks:`);
        lines.push(`      - app-network`);

        return lines.join('\n');
    }

    /**
     * Generate volumes section
     */
    private static generateVolumes(services: ServiceConfig[]): string {
        const volumeNames = new Set<string>();

        services.forEach(service => {
            if (service.volumes) {
                service.volumes.forEach(vol => {
                    // Extract named volumes (format: volume_name:path)
                    const parts = vol.split(':');
                    if (parts.length >= 2 && !parts[0].startsWith('.') && !parts[0].startsWith('/')) {
                        volumeNames.add(parts[0]);
                    }
                });
            }
        });

        if (volumeNames.size === 0) {
            return '';
        }

        const volumeLines = Array.from(volumeNames).map(name => `  ${name}:`).join('\n');
        return `volumes:\n${volumeLines}`;
    }

    /**
     * Generate networks section
     */
    private static generateNetworks(): string {
        return `networks:
  app-network:
    driver: bridge`;
    }

    /**
     * Get standard database service config
     */
    static getDatabaseService(type: 'postgres' | 'mysql' | 'mongodb' | 'redis'): ServiceConfig {
        switch (type) {
            case 'postgres':
                return {
                    name: 'postgres',
                    type: 'database',
                    image: 'postgres:16-alpine',
                    port: 5432,
                    internalPort: 5432,
                    environment: {
                        POSTGRES_DB: '${POSTGRES_DB:-appdb}',
                        POSTGRES_USER: '${POSTGRES_USER:-appuser}',
                        POSTGRES_PASSWORD: '${POSTGRES_PASSWORD:-apppass}'
                    },
                    volumes: [
                        'postgres_data:/var/lib/postgresql/data'
                    ],
                    healthCheck: {
                        test: '["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-appuser}"]',
                        interval: '10s',
                        timeout: '5s',
                        retries: 5
                    }
                };

            case 'mysql':
                return {
                    name: 'mysql',
                    type: 'database',
                    image: 'mysql:8.0',
                    port: 3306,
                    internalPort: 3306,
                    environment: {
                        MYSQL_DATABASE: '${MYSQL_DATABASE:-appdb}',
                        MYSQL_USER: '${MYSQL_USER:-appuser}',
                        MYSQL_PASSWORD: '${MYSQL_PASSWORD:-apppass}',
                        MYSQL_ROOT_PASSWORD: '${MYSQL_ROOT_PASSWORD:-rootpass}'
                    },
                    volumes: [
                        'mysql_data:/var/lib/mysql'
                    ],
                    healthCheck: {
                        test: '["CMD", "mysqladmin", "ping", "-h", "localhost"]',
                        interval: '10s',
                        timeout: '5s',
                        retries: 5
                    }
                };

            case 'mongodb':
                return {
                    name: 'mongodb',
                    type: 'database',
                    image: 'mongo:7.0',
                    port: 27017,
                    internalPort: 27017,
                    environment: {
                        MONGO_INITDB_DATABASE: '${MONGO_DATABASE:-appdb}',
                        MONGO_INITDB_ROOT_USERNAME: '${MONGO_USER:-admin}',
                        MONGO_INITDB_ROOT_PASSWORD: '${MONGO_PASSWORD:-mongopass}'
                    },
                    volumes: [
                        'mongodb_data:/data/db'
                    ],
                    healthCheck: {
                        test: '["CMD", "mongosh", "--eval", "db.adminCommand(\'ping\')"]',
                        interval: '10s',
                        timeout: '5s',
                        retries: 5
                    }
                };

            case 'redis':
                return {
                    name: 'redis',
                    type: 'cache',
                    image: 'redis:7-alpine',
                    port: 6379,
                    internalPort: 6379,
                    volumes: [
                        'redis_data:/data'
                    ],
                    healthCheck: {
                        test: '["CMD", "redis-cli", "ping"]',
                        interval: '10s',
                        timeout: '5s',
                        retries: 5
                    }
                };
        }
    }

    /**
     * Get standard message queue service
     */
    static getQueueService(type: 'rabbitmq' | 'kafka'): ServiceConfig {
        if (type === 'rabbitmq') {
            return {
                name: 'rabbitmq',
                type: 'queue',
                image: 'rabbitmq:3.12-management-alpine',
                port: 5672,
                internalPort: 5672,
                environment: {
                    RABBITMQ_DEFAULT_USER: '${RABBITMQ_USER:-guest}',
                    RABBITMQ_DEFAULT_PASS: '${RABBITMQ_PASSWORD:-guest}'
                },
                volumes: [
                    'rabbitmq_data:/var/lib/rabbitmq'
                ],
                healthCheck: {
                    test: '["CMD", "rabbitmq-diagnostics", "ping"]',
                    interval: '10s',
                    timeout: '5s',
                    retries: 5
                }
            };
        } else {
            return {
                name: 'kafka',
                type: 'queue',
                image: 'bitnami/kafka:latest',
                port: 9092,
                internalPort: 9092,
                environment: {
                    KAFKA_CFG_NODE_ID: '0',
                    KAFKA_CFG_PROCESS_ROLES: 'controller,broker',
                    KAFKA_CFG_LISTENERS: 'PLAINTEXT://:9092,CONTROLLER://:9093',
                    KAFKA_CFG_ADVERTISED_LISTENERS: 'PLAINTEXT://kafka:9092',
                    KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: '0@kafka:9093',
                    KAFKA_CFG_CONTROLLER_LISTENER_NAMES: 'CONTROLLER'
                },
                volumes: [
                    'kafka_data:/bitnami/kafka'
                ],
                healthCheck: {
                    test: '["CMD", "kafka-broker-api-versions.sh", "--bootstrap-server=localhost:9092"]',
                    interval: '10s',
                    timeout: '5s',
                    retries: 5
                }
            };
        }
    }
}
