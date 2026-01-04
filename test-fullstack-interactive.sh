#!/bin/bash

# AutoDocker Extension - Fullstack Projects Semi-Automated Test
# This script handles build/run/test, but you trigger generation manually

set +e  # Don't exit on error, we want to continue testing

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
TEST_DIR="/home/shinjan/Code/Extention/copy-auto-docker/test-projects/fullstack"
LOG_DIR="/home/shinjan/Code/Extention/copy-auto-docker/test-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
MAIN_LOG="$LOG_DIR/test_run_${TIMESTAMP}.log"

# Create log and results directory
mkdir -p "$LOG_DIR"

# Results tracking
PASSED=0
FAILED=0
TOTAL=0
declare -a PASSED_PROJECTS=()
declare -a FAILED_PROJECTS=()

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$MAIN_LOG"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1" | tee -a "$MAIN_LOG"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1" | tee -a "$MAIN_LOG"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1" | tee -a "$MAIN_LOG"
}

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1" | tee -a "$MAIN_LOG"
}

print_separator() {
    echo -e "\n${BLUE}$( printf '=%.0s' {1..80} )${NC}\n" | tee -a "$MAIN_LOG"
}

print_header() {
    print_separator
    echo -e "${CYAN}$1${NC}" | tee -a "$MAIN_LOG"
    print_separator
}

# Function to wait for user input
wait_for_generation() {
    local project_name=$1
    echo ""
    echo -e "${YELLOW}╔════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║${NC}  ${CYAN}ACTION REQUIRED:${NC} Please generate Docker files for: ${GREEN}${project_name}${NC}"
    echo -e "${YELLOW}║${NC}"
    echo -e "${YELLOW}║${NC}  1. VS Code should be open with the project"
    echo -e "${YELLOW}║${NC}  2. Press: ${CYAN}Ctrl+Shift+P${NC}"
    echo -e "${YELLOW}║${NC}  3. Run: ${CYAN}Auto Docker: Generate Docker Files (Direct Mode)${NC}"
    echo -e "${YELLOW}║${NC}  4. Wait for generation to complete"
    echo -e "${YELLOW}║${NC}  5. Press ${GREEN}ENTER${NC} here when done"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    read -p "Press ENTER when Docker files are generated..."
}

# Function to clean up Docker files
cleanup_docker_files() {
    local project_dir=$1
    log_step "Cleaning up existing Docker files..."
    
    cd "$project_dir" || return 1
    rm -f docker-compose.yml docker-compose.yaml nginx.conf .dockerignore 2>/dev/null
    find . -name "Dockerfile" -type f -not -path "*/node_modules/*" -delete 2>/dev/null
    find . -name ".dockerignore" -type f -not -path "*/node_modules/*" -delete 2>/dev/null
    
    log_success "Cleanup completed"
}

# Function to verify Docker files were generated
verify_generated_files() {
    local project_dir=$1
    cd "$project_dir" || return 1
    
    if [ ! -f "docker-compose.yml" ] && [ ! -f "docker-compose.yaml" ]; then
        log_error "docker-compose.yml not found!"
        return 1
    fi
    
    log_success "Docker files verified"
    
    # List generated files
    log_info "Generated files:"
    [ -f "docker-compose.yml" ] && echo "  - docker-compose.yml" | tee -a "$MAIN_LOG"
    [ -f "nginx.conf" ] && echo "  - nginx.conf" | tee -a "$MAIN_LOG"
    find . -name "Dockerfile" -type f -not -path "*/node_modules/*" | while read -r file; do
        echo "  - $file" | tee -a "$MAIN_LOG"
    done
    
    return 0
}

# Function to build Docker images
build_docker_images() {
    local project_dir=$1
    local project_name=$2
    local build_log="$LOG_DIR/${project_name}_build.log"
    
    log_step "Building Docker images..."
    cd "$project_dir" || return 1
    
    if docker-compose build --no-cache > "$build_log" 2>&1; then
        log_success "Docker images built successfully"
        return 0
    else
        log_error "Failed to build Docker images (see $build_log)"
        tail -n 20 "$build_log" | tee -a "$MAIN_LOG"
        return 1
    fi
}

# Function to start containers
start_containers() {
    local project_dir=$1
    local project_name=$2
    local start_log="$LOG_DIR/${project_name}_start.log"
    
    log_step "Starting containers..."
    cd "$project_dir" || return 1
    
    if docker-compose up -d > "$start_log" 2>&1; then
        sleep 5  # Wait for containers to initialize
        log_success "Containers started"
        return 0
    else
        log_error "Failed to start containers (see $start_log)"
        tail -n 20 "$start_log" | tee -a "$MAIN_LOG"
        return 1
    fi
}

# Function to check container status
check_containers() {
    local project_dir=$1
    local project_name=$2
    
    log_step "Checking container status..."
    cd "$project_dir" || return 1
    
    # Get container status
    local status_output=$(docker-compose ps 2>&1)
    echo "$status_output" | tee -a "$LOG_DIR/${project_name}_status.log"
    
    # Count running containers
    local running=$(docker-compose ps -q | xargs docker inspect -f '{{.State.Running}}' 2>/dev/null | grep -c true || echo 0)
    local total=$(docker-compose ps -q | wc -l)
    
    log_info "Running: $running/$total containers"
    
    if [ "$running" -gt 0 ]; then
        log_success "Containers are running!"
        return 0
    else
        log_error "No containers running properly"
        log_info "Recent logs:"
        docker-compose logs --tail=30 | tee -a "$LOG_DIR/${project_name}_error.log"
        return 1
    fi
}

# Function to stop containers
stop_containers() {
    local project_dir=$1
    
    log_step "Stopping and cleaning up containers..."
    cd "$project_dir" || return 1
    
    docker-compose down -v --remove-orphans > /dev/null 2>&1
    log_success "Containers stopped and cleaned up"
}

# Function to test a single project
test_project() {
    local project_dir=$1
    local project_name=$(basename "$project_dir")
    
    TOTAL=$((TOTAL + 1))
    
    print_header "Testing Project $TOTAL: $project_name"
    
    # Step 1: Cleanup
    cleanup_docker_files "$project_dir"
    
    # Step 2: Open in VS Code
    log_step "Opening project in VS Code..."
    code "$project_dir" --reuse-window
    sleep 2
    
    # Step 3: Wait for user to generate files
    wait_for_generation "$project_name"
    
    # Step 4: Verify files were generated
    if ! verify_generated_files "$project_dir"; then
        log_error "Generation verification failed for $project_name"
        FAILED=$((FAILED + 1))
        FAILED_PROJECTS+=("$project_name - Generation Failed")
        return 1
    fi
    
    # Step 5: Build images
    if ! build_docker_images "$project_dir" "$project_name"; then
        log_error "Build failed for $project_name"
        FAILED=$((FAILED + 1))
        FAILED_PROJECTS+=("$project_name - Build Failed")
        stop_containers "$project_dir"
        return 1
    fi
    
    # Step 6: Start containers
    if ! start_containers "$project_dir" "$project_name"; then
        log_error "Start failed for $project_name"
        FAILED=$((FAILED + 1))
        FAILED_PROJECTS+=("$project_name - Start Failed")
        stop_containers "$project_dir"
        return 1
    fi
    
    # Step 7: Check containers
    if ! check_containers "$project_dir" "$project_name"; then
        log_error "Runtime check failed for $project_name"
        FAILED=$((FAILED + 1))
        FAILED_PROJECTS+=("$project_name - Runtime Failed")
        stop_containers "$project_dir"
        return 1
    fi
    
    # Step 8: Stop containers
    stop_containers "$project_dir"
    
    # Success!
    log_success "✓ $project_name PASSED all tests!"
    PASSED=$((PASSED + 1))
    PASSED_PROJECTS+=("$project_name")
    
    return 0
}

# Main execution
main() {
    print_header "AutoDocker Extension - Fullstack Projects Test Suite"
    log_info "Test started at: $(date)"
    log_info "Log directory: $LOG_DIR"
    log_info "Main log: $MAIN_LOG"
    
    # Get sorted list of projects
    local projects=($(find "$TEST_DIR" -maxdepth 1 -type d -not -path "$TEST_DIR" | sort))
    local total_count=${#projects[@]}
    
    log_info "Found $total_count projects to test"
    print_separator
    
    # Test each project
    for project_dir in "${projects[@]}"; do
        test_project "$project_dir"
        echo "" | tee -a "$MAIN_LOG"
    done
    
    # Print final summary
    print_header "TEST SUMMARY"
    echo "" | tee -a "$MAIN_LOG"
    log_info "Total Projects: $TOTAL"
    log_success "Passed: $PASSED"
    log_error "Failed: $FAILED"
    echo "" | tee -a "$MAIN_LOG"
    
    if [ ${#PASSED_PROJECTS[@]} -gt 0 ]; then
        log_info "✓ PASSED PROJECTS:"
        for proj in "${PASSED_PROJECTS[@]}"; do
            echo "  ${GREEN}✓${NC} $proj" | tee -a "$MAIN_LOG"
        done
        echo "" | tee -a "$MAIN_LOG"
    fi
    
    if [ ${#FAILED_PROJECTS[@]} -gt 0 ]; then
        log_info "✗ FAILED PROJECTS:"
        for proj in "${FAILED_PROJECTS[@]}"; do
            echo "  ${RED}✗${NC} $proj" | tee -a "$MAIN_LOG"
        done
        echo "" | tee -a "$MAIN_LOG"
    fi
    
    log_info "Test completed at: $(date)"
    log_info "Success rate: $(awk "BEGIN {printf \"%.1f%%\", ($PASSED/$TOTAL)*100}")"
    print_separator
    
    # Exit with appropriate code
    [ $FAILED -eq 0 ] && exit 0 || exit 1
}

# Run main
main
