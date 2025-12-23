/**
 * Two-Step AI Service for Auto Dockerization
 * Step 1: Project Tree Analysis - Determines what files are needed
 * Step 2: File-Based Generation - Generates Docker files with full context
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface TreeAnalysisResult {
    sufficient: boolean;
    projectType: string;
    frameworks: string[];
    requiredFiles?: FileRequest[];
    plannedArtifacts?: string[];
    message: string;
}

export interface FileRequest {
    path: string;
    reason: string;
    service?: string; // frontend, backend, worker, etc.
}

export interface GeneratedArtifact {
    filePath: string;
    content: string;
    explanation: string;
}

export interface FileModification {
    filePath: string;
    changes: string;
    reason: string;
}

export interface GenerationResult {
    artifacts: GeneratedArtifact[];
    modifications?: FileModification[];
    architecture: {
        containerCommunication: string;
        exposedPorts: string[];
        buildRuntimeSeparation: string;
    };
    assumptions: string[];
    runInstructions: string;
}

export class TwoStepAIService {
    private geminiClient?: GoogleGenerativeAI;
    private projectPath: string;
    private outputChannel?: vscode.OutputChannel;

    constructor(projectPath: string, outputChannel?: vscode.OutputChannel) {
        this.projectPath = projectPath;
        this.outputChannel = outputChannel;
        this.initializeClient();
    }

    private initializeClient() {
        const config = vscode.workspace.getConfiguration('autoDocker');
        const geminiKey = config.get<string>('geminiApiKey');

        if (geminiKey) {
            this.geminiClient = new GoogleGenerativeAI(geminiKey);
        }
    }

    private log(message: string) {
        if (this.outputChannel) {
            this.outputChannel.appendLine(message);
        }
        console.log(`[TwoStepAI] ${message}`);
    }

    /**
     * Generate complete project directory tree
     */
    private async generateProjectTree(): Promise<string> {
        this.log('Generating project tree...');
        const tree: string[] = [];
        
        const traverse = (dir: string, prefix: string = '', isRoot: boolean = true) => {
            try {
                const items = fs.readdirSync(dir);
                
                // Filter out common ignored directories
                const filtered = items.filter((item: string) => {
                    const ignoredDirs = ['node_modules', '.git', 'dist', 'build', 'out', '.vscode', 
                                        '.next', '.nuxt', 'coverage', '__pycache__', 'venv', 
                                        'env', '.pytest_cache', 'target', 'bin', 'obj'];
                    return !ignoredDirs.includes(item);
                });

                filtered.forEach((item: string, index: number) => {
                    const itemPath = path.join(dir, item);
                    const isLast = index === filtered.length - 1;
                    const stats = fs.statSync(itemPath);
                    
                    if (isRoot && index === 0) {
                        tree.push(item + (stats.isDirectory() ? '/' : ''));
                    } else {
                        const connector = isLast ? '└── ' : '├── ';
                        tree.push(prefix + connector + item + (stats.isDirectory() ? '/' : ''));
                    }
                    
                    if (stats.isDirectory()) {
                        const newPrefix = prefix + (isLast ? '    ' : '│   ');
                        traverse(itemPath, newPrefix, false);
                    }
                });
            } catch (error) {
                // Skip permission errors
            }
        };

        const projectName = path.basename(this.projectPath);
        tree.push(projectName + '/');
        traverse(this.projectPath, '', true);
        
        return tree.join('\n');
    }

    /**
     * Step 1: Tree Analysis
     * Analyzes project tree and determines if more files are needed
     */
    async analyzeProjectTree(): Promise<TreeAnalysisResult> {
        this.log('📊 Step 1: Analyzing project tree...');

        if (!this.geminiClient) {
            throw new Error('Gemini API key not configured. Please set it in VS Code settings.');
        }

        const projectTree = await this.generateProjectTree();
        const prompt = this.createTreeAnalysisPrompt(projectTree);

        const model = this.geminiClient.getGenerativeModel({ 
            model: 'gemini-1.5-pro',
            generationConfig: {
                temperature: 0.2,
                topK: 20,
                topP: 0.8,
                maxOutputTokens: 4096,
            }
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        this.log('Received tree analysis response');
        return this.parseTreeAnalysisResponse(text);
    }

    /**
     * Step 2: File-Based Generation
     * Generates Docker files with requested file contents
     */
    async generateDockerFiles(
        treeAnalysis: TreeAnalysisResult,
        requestedFiles?: Map<string, string>
    ): Promise<GenerationResult> {
        this.log('🏗️ Step 2: Generating Docker files...');

        if (!this.geminiClient) {
            throw new Error('Gemini API key not configured. Please set it in VS Code settings.');
        }

        // If files were requested, read them
        let fileContents = requestedFiles;
        if (!fileContents && treeAnalysis.requiredFiles && treeAnalysis.requiredFiles.length > 0) {
            fileContents = await this.readRequestedFiles(treeAnalysis.requiredFiles);
        }

        const prompt = this.createGenerationPrompt(treeAnalysis, fileContents);

        const model = this.geminiClient.getGenerativeModel({ 
            model: 'gemini-1.5-pro',
            generationConfig: {
                temperature: 0.3,
                topK: 40,
                topP: 0.9,
                maxOutputTokens: 8192,
            }
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        this.log('Received generation response');
        return this.parseGenerationResponse(text);
    }

    /**
     * Read requested files from filesystem
     */
    private async readRequestedFiles(fileRequests: FileRequest[]): Promise<Map<string, string>> {
        this.log(`Reading ${fileRequests.length} requested files...`);
        const fileContents = new Map<string, string>();

        for (const request of fileRequests) {
            const fullPath = path.join(this.projectPath, request.path);
            try {
                if (fs.existsSync(fullPath)) {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    fileContents.set(request.path, content);
                    this.log(`✓ Read: ${request.path}`);
                } else {
                    this.log(`⚠ File not found: ${request.path}`);
                }
            } catch (error) {
                this.log(`✗ Error reading ${request.path}: ${error}`);
            }
        }

        return fileContents;
    }

    /**
     * Create Tree Analysis Prompt (API Call 1)
     */
    private createTreeAnalysisPrompt(projectTree: string): string {
        return `You are an expert **DevOps & Docker Automation AI**.

I will provide you with the **complete project directory tree** of a codebase.

Your tasks:

1. Analyze the project structure and identify:
   - Frontend / Backend / Full‑stack / Monorepo / Microservices
   - Programming languages and frameworks
   - Build tools and package managers
   - Whether it is production‑ready or needs assumptions
2. Decide if the **project tree alone is sufficient** to generate:
   - Production‑grade Dockerfile(s)
   - docker-compose.yml 
   - NGINX configuration (if required)
3. If sufficient:
   - Reply with JSON: {"sufficient": true, "message": "Tree is sufficient. Ready for Dockerization.", "projectType": "...", "frameworks": [...], "plannedArtifacts": [...]}
   - Clearly list what Docker artifacts will be generated.
4. If NOT sufficient:
   - Reply with JSON: {"sufficient": false, "projectType": "...", "frameworks": [...], "requiredFiles": [{path: "...", reason: "...", service: "..."}], "message": "..."}
   - Ask ONLY for the **exact files you need**, grouped by service.
   - Specify why each file is required (example: build command, port, env, framework config).

❗ Rules:

- Do NOT generate Dockerfiles yet.
- Do NOT assume commands blindly.
- Be precise and minimal in follow‑up requests.
- ALWAYS respond with valid JSON only.

Here is the project tree:

\`\`\`
${projectTree}
\`\`\`

Respond with ONLY the JSON object, no additional text.`;
    }

    /**
     * Create Generation Prompt (API Call 2)
     */
    private createGenerationPrompt(
        treeAnalysis: TreeAnalysisResult,
        fileContents?: Map<string, string>
    ): string {
        let filesSection = '';
        if (fileContents && fileContents.size > 0) {
            filesSection = '\nProvided files:\n\n';
            fileContents.forEach((content, filePath) => {
                filesSection += `### ${filePath}\n\`\`\`\n${content}\n\`\`\`\n\n`;
            });
        }

        return `You are an expert **Production DevOps Engineer AI**.

Below is the project context along with the **exact file contents** you requested earlier.

Project Type: ${treeAnalysis.projectType}
Frameworks: ${treeAnalysis.frameworks.join(', ')}
${filesSection}

Your tasks:

1. Generate **production‑grade Docker artifacts**, including:
   - Multi‑stage Dockerfile(s)
   - docker-compose.yml (only if needed)
   - NGINX config (only if frontend or reverse proxy is required)
2. Follow best practices:
   - Small image size
   - Multi‑stage builds
   - Non‑root user where applicable
   - Proper caching and layer ordering
   - Clear separation of frontend, backend, and infra
3. Modify existing files **only if necessary** and clearly explain:
   - What was changed
   - Why the change is required for Docker/production
4. For each generated file, provide:
   - File path
   - Full file content
   - Short explanation of its role
5. If multiple services exist:
   - Clearly label each service (frontend, backend, worker, db, etc.)

❗ Rules:

- Do NOT invent files that don't belong to the project
- Do NOT add dev‑only tools
- Assume **production environment** unless stated otherwise
- If something is still ambiguous, ask before proceeding

## FRONTEND PRODUCTION BASELINE (MANDATORY TEMPLATE)

When a **frontend SPA (React / Vue / Angular / Vite / CRA / Svelte)** is detected, you **MUST default to the following production structure unless the project explicitly requires otherwise**:

### Frontend Dockerfile (Multi‑Stage, Node → Nginx)

\`\`\`dockerfile
# Stage 1: Builder
FROM node:18-alpine AS builder
WORKDIR /app

COPY package*.json yarn.lock* pnpm-lock.yaml* ./

RUN if [ -f package-lock.json ]; then npm ci --prefer-offline; \\
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \\
    elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; \\
    else npm install; fi

COPY . .
RUN npm run build

# Stage 2: Nginx Runtime
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
\`\`\`

### NGINX Configuration (SPA‑Ready, Secure, Gzip, Cache)

\`\`\`nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header X-XSS-Protection "1; mode=block" always;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /health {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }
}
\`\`\`

❗ Enforcement Rules:

- This structure is the **default production output** for frontend apps
- Do NOT use Node as runtime for frontend in production
- NGINX is mandatory unless SSR requires Node
- Health checks are **non‑optional**

## OUTPUT FORMAT (MANDATORY)

Respond with ONLY a JSON object in this format:

\`\`\`json
{
  "artifacts": [
    {
      "filePath": "Dockerfile",
      "content": "...",
      "explanation": "..."
    },
    {
      "filePath": "docker-compose.yml",
      "content": "...",
      "explanation": "..."
    }
  ],
  "modifications": [
    {
      "filePath": "package.json",
      "changes": "Added 'start:prod' script",
      "reason": "Required for production container startup"
    }
  ],
  "architecture": {
    "containerCommunication": "Frontend nginx reverse-proxies to backend API",
    "exposedPorts": ["80", "3000"],
    "buildRuntimeSeparation": "Multi-stage builds used for both frontend and backend"
  },
  "assumptions": [
    "Frontend builds to /dist folder",
    "Backend runs on port 3000"
  ],
  "runInstructions": "docker compose up -d --build"
}
\`\`\`

Respond with ONLY the JSON object, no additional text or markdown formatting.`;
    }

    /**
     * Parse Tree Analysis Response
     */
    private parseTreeAnalysisResponse(responseText: string): TreeAnalysisResult {
        try {
            // Extract JSON from response (might be wrapped in markdown)
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const parsed = JSON.parse(jsonMatch[0]);
            
            return {
                sufficient: parsed.sufficient || false,
                projectType: parsed.projectType || 'Unknown',
                frameworks: parsed.frameworks || [],
                requiredFiles: parsed.requiredFiles || [],
                plannedArtifacts: parsed.plannedArtifacts || [],
                message: parsed.message || ''
            };
        } catch (error) {
            this.log(`Error parsing tree analysis: ${error}`);
            // Fallback: assume we need basic files
            return {
                sufficient: false,
                projectType: 'Unknown',
                frameworks: [],
                requiredFiles: [
                    { path: 'package.json', reason: 'Determine build commands and dependencies' }
                ],
                message: 'Could not parse response, requesting package.json as fallback'
            };
        }
    }

    /**
     * Parse Generation Response
     */
    private parseGenerationResponse(responseText: string): GenerationResult {
        try {
            // Extract JSON from response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const parsed = JSON.parse(jsonMatch[0]);
            
            return {
                artifacts: parsed.artifacts || [],
                modifications: parsed.modifications || [],
                architecture: parsed.architecture || {
                    containerCommunication: 'Not specified',
                    exposedPorts: [],
                    buildRuntimeSeparation: 'Not specified'
                },
                assumptions: parsed.assumptions || [],
                runInstructions: parsed.runInstructions || 'docker compose up -d --build'
            };
        } catch (error) {
            this.log(`Error parsing generation response: ${error}`);
            throw new Error(`Failed to parse AI response: ${error}`);
        }
    }

    /**
     * Complete two-step workflow
     */
    async generateComplete(): Promise<GenerationResult> {
        // Step 1: Analyze tree
        const treeAnalysis = await this.analyzeProjectTree();
        
        if (!treeAnalysis.sufficient) {
            this.log(`Additional files needed: ${treeAnalysis.requiredFiles?.length || 0}`);
            treeAnalysis.requiredFiles?.forEach(file => {
                this.log(`  - ${file.path}: ${file.reason}`);
            });
        } else {
            this.log('Project tree is sufficient for generation');
        }

        // Step 2: Generate with context
        const result = await this.generateDockerFiles(treeAnalysis);
        
        return result;
    }
}
