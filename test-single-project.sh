#!/bin/bash

# Quick Single Project Test
# Usage: ./test-single-project.sh <project-name>
# Example: ./test-single-project.sh 01-mern-stack

set +e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

if [ -z "$1" ]; then
    echo -e "${RED}Usage: $0 <project-name>${NC}"
    echo ""
    echo "Available projects:"
    ls -1 test-projects/fullstack/ | sed 's/^/  /'
    exit 1
fi

PROJECT_NAME="$1"
PROJECT_DIR="test-projects/fullstack/$PROJECT_NAME"

if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}Error: Project '$PROJECT_NAME' not found!${NC}"
    echo ""
    echo "Available projects:"
    ls -1 test-projects/fullstack/ | sed 's/^/  /'
    exit 1
fi

echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  Testing Single Project: ${GREEN}$PROJECT_NAME${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Cleanup
echo -e "${BLUE}[1/7]${NC} Cleaning up existing Docker files..."
cd "$PROJECT_DIR"
rm -f docker-compose.yml docker-compose.yaml nginx.conf .dockerignore 2>/dev/null
find . -name "Dockerfile" -type f -not -path "*/node_modules/*" -delete 2>/dev/null
echo -e "${GREEN}✓${NC} Cleanup complete"
echo ""

# Step 2: Open in VS Code
echo -e "${BLUE}[2/7]${NC} Opening project in VS Code..."
code "$PROJECT_DIR" --reuse-window
sleep 2
echo ""

# Step 3: Wait for generation
echo -e "${YELLOW}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║${NC}  ${CYAN}ACTION REQUIRED:${NC} Generate Docker files"
echo -e "${YELLOW}║${NC}"
echo -e "${YELLOW}║${NC}  1. Press: ${CYAN}Ctrl+Shift+P${NC}"
echo -e "${YELLOW}║${NC}  2. Run: ${CYAN}Auto Docker: Generate Docker Files (Direct Mode)${NC}"
echo -e "${YELLOW}║${NC}  3. Wait for completion"
echo -e "${YELLOW}║${NC}  4. Press ${GREEN}ENTER${NC} here"
echo -e "${YELLOW}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
read -p "Press ENTER when Docker files are generated..."
echo ""

# Step 4: Verify files
echo -e "${BLUE}[3/7]${NC} Verifying generated files..."
if [ ! -f "docker-compose.yml" ] && [ ! -f "docker-compose.yaml" ]; then
    echo -e "${RED}✗${NC} docker-compose.yml not found!"
    exit 1
fi
echo -e "${GREEN}✓${NC} Files verified"
echo "  Generated files:"
[ -f "docker-compose.yml" ] && echo "    - docker-compose.yml"
[ -f "nginx.conf" ] && echo "    - nginx.conf"
find . -name "Dockerfile" -type f -not -path "*/node_modules/*" | sed 's/^/    - /'
echo ""

# Step 5: Build
echo -e "${BLUE}[4/7]${NC} Building Docker images..."
if docker-compose build --no-cache 2>&1 | grep -E "(Successfully built|Successfully tagged|CACHED|ERROR)"; then
    echo -e "${GREEN}✓${NC} Build complete"
else
    echo -e "${RED}✗${NC} Build failed!"
    exit 1
fi
echo ""

# Step 6: Start
echo -e "${BLUE}[5/7]${NC} Starting containers..."
if docker-compose up -d; then
    sleep 5
    echo -e "${GREEN}✓${NC} Containers started"
else
    echo -e "${RED}✗${NC} Failed to start containers"
    docker-compose down -v
    exit 1
fi
echo ""

# Step 7: Check status
echo -e "${BLUE}[6/7]${NC} Checking container status..."
docker-compose ps
echo ""
RUNNING=$(docker-compose ps -q | xargs docker inspect -f '{{.State.Running}}' 2>/dev/null | grep -c true || echo 0)
TOTAL=$(docker-compose ps -q | wc -l)
echo "Running: $RUNNING/$TOTAL containers"
echo ""

if [ "$RUNNING" -gt 0 ]; then
    echo -e "${GREEN}✓${NC} Containers are running!"
    echo ""
    echo "View logs: ${CYAN}docker-compose logs -f${NC}"
    echo "Stop containers: ${CYAN}docker-compose down -v${NC}"
    echo ""
    
    # Ask if user wants to stop now
    read -p "Stop containers now? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}[7/7]${NC} Stopping containers..."
        docker-compose down -v
        echo -e "${GREEN}✓${NC} Containers stopped and cleaned up"
    else
        echo -e "${YELLOW}ℹ${NC} Containers left running. Stop manually with: docker-compose down -v"
    fi
else
    echo -e "${RED}✗${NC} No containers running!"
    echo ""
    echo "Recent logs:"
    docker-compose logs --tail=30
    echo ""
    echo -e "${BLUE}[7/7]${NC} Cleaning up..."
    docker-compose down -v
    exit 1
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}  ✓ Test Complete for: ${CYAN}$PROJECT_NAME${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════╝${NC}"
