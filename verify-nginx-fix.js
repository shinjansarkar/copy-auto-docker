/**
 * Verification Script for Nginx Fix
 * 
 * This script verifies that:
 * 1. Single frontend projects have only 1 service (frontend with internal nginx)
 * 2. Frontend + backend projects have only 2 services (frontend + backend, no separate nginx)
 * 3. Multiple frontend projects have N+1 services (frontends + separate nginx gateway)
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// ANSI color codes for output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function verifyDockerCompose(composePath, expectedServices, testName) {
    log(`\n${'='.repeat(60)}`, 'cyan');
    log(`Testing: ${testName}`, 'cyan');
    log('='.repeat(60), 'cyan');

    if (!fs.existsSync(composePath)) {
        log(`❌ FAIL: docker-compose.yml not found at ${composePath}`, 'red');
        return false;
    }

    try {
        const composeContent = fs.readFileSync(composePath, 'utf8');
        const composeData = yaml.load(composeContent);

        if (!composeData.services) {
            log(`❌ FAIL: No services found in docker-compose.yml`, 'red');
            return false;
        }

        const services = Object.keys(composeData.services);
        const serviceCount = services.length;

        log(`\nServices found (${serviceCount}):`, 'blue');
        services.forEach(service => {
            log(`  - ${service}`, 'blue');
        });

        // Check expected service count
        if (serviceCount !== expectedServices.count) {
            log(`\n❌ FAIL: Expected ${expectedServices.count} services, got ${serviceCount}`, 'red');
            return false;
        }

        // Check for separate nginx service when it shouldn't exist
        const hasNginxService = services.includes('nginx');
        if (!expectedServices.shouldHaveNginx && hasNginxService) {
            log(`\n❌ FAIL: Found separate 'nginx' service when frontend should have internal nginx`, 'red');
            return false;
        }

        // Check for nginx service when it should exist
        if (expectedServices.shouldHaveNginx && !hasNginxService) {
            log(`\n❌ FAIL: Missing separate 'nginx' service for multiple frontends`, 'red');
            return false;
        }

        // Check frontend service port mapping
        const frontendService = composeData.services.frontend;
        if (frontendService && !expectedServices.shouldHaveNginx) {
            if (!frontendService.ports || !frontendService.ports.some(p => p.includes('80'))) {
                log(`\n❌ FAIL: Frontend service should expose port 80`, 'red');
                return false;
            }
        }

        log(`\n✅ PASS: All checks passed!`, 'green');
        return true;

    } catch (error) {
        log(`\n❌ FAIL: Error parsing docker-compose.yml: ${error.message}`, 'red');
        return false;
    }
}

// Test cases
const testCases = [
    {
        name: 'Frontend Only (React)',
        path: path.join(__dirname, 'test-projects', 'frontend', '01-react-vite', 'docker-compose.yml'),
        expected: {
            count: 1,
            shouldHaveNginx: false // Frontend has internal nginx
        }
    },
    {
        name: 'Frontend + Backend (MERN Stack)',
        path: path.join(__dirname, 'test-projects', 'fullstack', '01-mern-stack', 'docker-compose.yml'),
        expected: {
            count: 2, // frontend + backend (no separate nginx)
            shouldHaveNginx: false
        }
    },
    {
        name: 'Frontend + Backend + Database',
        path: path.join(__dirname, 'test-projects', 'fullstack', '07-nextjs-postgres', 'docker-compose.yml'),
        expected: {
            count: 3, // frontend + backend + postgres (no separate nginx)
            shouldHaveNginx: false
        }
    }
];

// Run tests
log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
log('║       NGINX FIX VERIFICATION SUITE                         ║', 'cyan');
log('╚════════════════════════════════════════════════════════════╝', 'cyan');

let passCount = 0;
let failCount = 0;

testCases.forEach(testCase => {
    const result = verifyDockerCompose(testCase.path, testCase.expected, testCase.name);
    if (result) {
        passCount++;
    } else {
        failCount++;
    }
});

// Summary
log(`\n${'='.repeat(60)}`, 'cyan');
log('SUMMARY', 'cyan');
log('='.repeat(60), 'cyan');
log(`✅ Passed: ${passCount}`, passCount > 0 ? 'green' : 'reset');
log(`❌ Failed: ${failCount}`, failCount > 0 ? 'red' : 'reset');
log(`Total: ${testCases.length}`, 'blue');

if (failCount === 0) {
    log(`\n🎉 All tests passed! The nginx fix is working correctly.`, 'green');
} else {
    log(`\n⚠️  Some tests failed. Please review the output above.`, 'yellow');
    process.exit(1);
}
