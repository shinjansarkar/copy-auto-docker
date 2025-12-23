#!/usr/bin/env node

/**
 * Simple test to verify Docker file generation
 */

const path = require('path');
const fs = require('fs');

// Test project path
const testProject = path.join(__dirname, 'test-projects', 'backend', '01-node-express');

console.log('Testing Docker Generation on:', testProject);
console.log('');

// Check if package.json exists
const packageJsonPath = path.join(testProject, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
    console.error('❌ package.json not found');
    process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
console.log('✅ Project:', packageJson.name);
console.log('✅ Entry:', packageJson.main);
console.log('✅ Dependencies:', Object.keys(packageJson.dependencies || {}).join(', '));
console.log('');

// Since we can't directly use the extension in Node.js test,
// let's create expected Dockerfiles manually to verify the logic

const expectedDockerfile = `# Stage 1: Dependencies
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy source code
COPY . .

# Expose port
EXPOSE 8000

# Start application
CMD ["node", "server.js"]
`;

console.log('Expected Dockerfile (2-stage build):');
console.log('=====================================');
console.log(expectedDockerfile);

// Write expected dockerfile
const testDockerfilePath = path.join(testProject, 'Dockerfile.expected');
fs.writeFileSync(testDockerfilePath, expectedDockerfile);
console.log('✅ Written expected Dockerfile to:', testDockerfilePath);

console.log('');
console.log('To test this manually:');
console.log('1. Open VS Code in:', testProject);
console.log('2. Run command: "Auto Docker: Generate Docker Files (Direct Mode)"');
console.log('3. Compare generated Dockerfile with Dockerfile.expected');
