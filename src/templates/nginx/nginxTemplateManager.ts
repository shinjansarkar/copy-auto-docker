/**
 * Nginx Template Manager
 * 
 * Generates Nginx configurations for:
 * - Single frontend serving
 * - Multiple frontend routing (path-based)
 * - Backend API proxying
 * - Production-grade settings
 */

export interface NginxService {
    name: string;
    type: 'frontend' | 'backend';
    path: string;  // URL path (e.g., '/', '/api', '/admin')
    port?: number; // Internal service port
}

export class NginxTemplateManager {
    
    /**
     * Generate Nginx configuration
     * RULE: All frontends served via Nginx, backends proxied
     */
    static generateConfig(services: NginxService[]): string {
        const frontends = services.filter(s => s.type === 'frontend');
        const backends = services.filter(s => s.type === 'backend');

        if (frontends.length === 0) {
            throw new Error('Nginx configuration requires at least one frontend service');
        }

        if (frontends.length === 1 && backends.length === 0) {
            return this.getSingleFrontendTemplate(frontends[0]);
        }

        if (frontends.length === 1 && backends.length > 0) {
            return this.getFrontendWithBackendTemplate(frontends[0], backends);
        }

        // Multiple frontends
        return this.getMultipleFrontendsTemplate(frontends, backends);
    }

    /**
     * TEMPLATE: Single Frontend (no backend)
     */
    private static getSingleFrontendTemplate(frontend: NginxService): string {
        return `# Nginx configuration for single frontend
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml+rss 
               application/json application/javascript;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Main location
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static assets caching
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check
    location /health {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }
}
`;
    }

    /**
     * TEMPLATE: Single Frontend + Backend(s)
     */
    private static getFrontendWithBackendTemplate(frontend: NginxService, backends: NginxService[]): string {
        const backendProxies = backends.map(backend => {
            const port = backend.port || 3000;
            return `
    # Backend API: ${backend.name}
    location ${backend.path} {
        proxy_pass http://${backend.name}:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }`;
        }).join('\n');

        return `# Nginx configuration for frontend + backend
upstream backend {
    least_conn;
    ${backends.map(b => `server ${b.name}:${b.port || 3000} max_fails=3 fail_timeout=30s;`).join('\n    ')}
}

server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml+rss 
               application/json application/javascript;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Client body size limit
    client_max_body_size 10M;
${backendProxies}

    # Frontend - must be last
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static assets caching
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check
    location /nginx-health {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }
}
`;
    }

    /**
     * TEMPLATE: Multiple Frontends + Optional Backends
     * CRITICAL: Each frontend gets its own routing path
     */
    private static getMultipleFrontendsTemplate(frontends: NginxService[], backends: NginxService[]): string {
        // Sort frontends: root path last (most specific first)
        const sortedFrontends = [...frontends].sort((a, b) => {
            if (a.path === '/') return 1;
            if (b.path === '/') return -1;
            return b.path.length - a.path.length;
        });

        const frontendLocations = sortedFrontends.map(frontend => {
            const containerName = frontend.name;
            const path = frontend.path === '/' ? '' : frontend.path;
            
            return `
    # Frontend: ${frontend.name}
    location ${frontend.path} {
        alias /usr/share/nginx/html/${containerName}/;
        try_files $uri $uri/ ${frontend.path}/index.html;
        
        # SPA routing support
        index index.html;
        
        # Disable caching for HTML
        location ~ \\.html$ {
            add_header Cache-Control "no-cache, no-store, must-revalidate";
            add_header Pragma "no-cache";
            add_header Expires "0";
        }
    }`;
        }).join('\n');

        const backendProxies = backends.map(backend => {
            const port = backend.port || 3000;
            return `
    # Backend API: ${backend.name}
    location ${backend.path} {
        proxy_pass http://${backend.name}:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }`;
        }).join('\n');

        return `# Nginx configuration for multiple frontends
server {
    listen 80;
    server_name localhost;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml+rss 
               application/json application/javascript;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Client body size limit
    client_max_body_size 10M;

    # Health check
    location /nginx-health {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }
${backendProxies}
${frontendLocations}

    # Static assets caching (global)
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
`;
    }

    /**
     * Generate Nginx Dockerfile for multi-frontend setup
     * This Dockerfile copies multiple frontend builds into appropriate paths
     */
    static generateMultiFrontendDockerfile(frontends: { name: string; buildPath: string }[]): string {
        const copyCommands = frontends.map(f => 
            `COPY --from=${f.name} /app/${f.buildPath} /usr/share/nginx/html/${f.name}/`
        ).join('\n');

        return `# Multi-frontend Nginx container
FROM nginx:alpine

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy all frontend builds
${copyCommands}

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD wget --quiet --tries=1 --spider http://localhost/nginx-health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
`;
    }
}
