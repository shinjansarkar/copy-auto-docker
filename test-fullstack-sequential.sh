#!/bin/bash

# AutoDocker Extension - Fullstack Projects Sequential Test
# This script tests all 20 fullstack projects one by one

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
EXTENSION_PATH="/home/shinjan/Code/Extention/copy-auto-docker/auto-docker-extension-2.7.0.vsix"
TEST_DIR="/home/shinjan/Code/Extention/copy-auto-docker/test-projects/fullstack"
LOG_DIR="/home/shinjan/Code/Extention/copy-auto-docker/test-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
MAIN_LOG="$LOG_DIR/test_run_${TIMESTAMP}.log"

# Create log directory
mkdir -p "$LOG_DIR"

# Test results tracking
declare -a PASSED_PROJECTS=()
declare -a FAILED_PROJECTS=()
declare -a SKIPPED_PROJECTS=()

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$MAIN_LOG"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$MAIN_LOG"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$MAIN_LOG"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$MAIN_LOG"
}

print_separator() {
    echo -e "\n${BLUE}========================================${NC}" | tee -a "$MAIN_LOG"
}

# Function to check if extension is installed
check_extension() {
    print_info "Checking if AutoDocker extension is installed..."
    if code --list-extensions | grep -q "ShinjanSarkar.auto-docker-extension"; then
        print_success "Extension is already installed"
        return 0
    else
        print_warning "Extension not found, installing..."
        return 1
    fi
}

# Function to install extension
install_extension() {
    print_info "Installing extension from: $EXTENSION_PATH"
    if code --install-extension "$EXTENSION_PATH" --force; then
        print_success "Extension installed successfully"
        sleep 2  # Give VS Code time to load the extension
        return 0
    else
        print_error "Failed to install extension"
        return 1
    fi
}

# Function to clean up existing Docker files
cleanup_docker_files() {
    local project_dir=$1
    print_info "Cleaning up existing Docker files in $project_dir..."
    
    cd "$project_dir"
    rm -f docker-compose.yml docker-compose.yaml
    rm -f nginx.conf
    rm -f .dockerignore
    find . -name "Dockerfile" -type f -delete
    find . -name ".dockerignore" -type f -delete
    
    print_success "Cleanup completed"
}

# Function to generate Docker files using VS Code command
generate_docker_files() {
    local project_dir=$1
    local project_name=$(basename "$project_dir")
    
    print_info "Generating Docker files for: $project_name"
    print_info "Project directory: $project_dir"
    
    # Open the project in VS Code and trigger the command
    cd "$project_dir"
    
    # Use VS Code CLI to run the command
    # Note: This requires VS Code to be running or will start a new instance
    code "$project_dir" --wait &
    sleep 3  # Wait for VS Code to open
    
    # Trigger the AutoDocker command via xdotool or manually
    # Since we can't programmatically trigger commands easily, we'll check if files exist after a delay
    print_warning "Please manually trigger: Ctrl+Shift+P -> 'Auto Docker: Analyze Project & Generate Docker Files'"
    print_warning "Waiting 30 seconds for file generation..."
    
    sleep 30
    
    # Check if files were generated
    if [ -f "docker-compose.yml" ] || [ -f "docker-compose.yaml" ]; then
        print_success "Docker files generated successfully"
        return 0
    else
        print_error "Docker files were not generated"
        return 1
    fi
}

# Function to build Docker images
build_docker_images() {
    local project_dir=$1
    local project_name=$(basename "$project_dir")
    
    print_info "Building Docker images for: $project_name"
    cd "$project_dir"
    
    if docker-compose build --no-cache 2>&1 | tee -a "$LOG_DIR/${project_name}_build.log"; then
        print_success "Docker images built successfully"
        return 0
    else
        print_error "Failed to build Docker images"
        return 1
    fi
}

# Function to start containers
start_containers() {
    local project_dir=$1
    local project_name=$(basename "$project_dir")
    
    print_info "Starting containers for: $project_name"
    cd "$project_dir"
    
    if docker-compose up -d 2>&1 | tee -a "$LOG_DIR/${project_name}_start.log"; then
        sleep 5  # Wait for containers to start
        print_success "Containers started successfully"
        return 0
    else
        print_error "Failed to start containers"
        return 1
    fi
}

# Function to check if containers are running
check_containers() {
    local project_dir=$1
    local project_name=$(basename "$project_dir")
    
    print_info "Checking container status for: $project_name"
    cd "$project_dir"
    
    local running_containers=$(docker-compose ps --services --filter "status=running" 2>/dev/null | wc -l)
    local total_containers=$(docker-compose ps --services 2>/dev/null | wc -l)
    
    print_info "Running containers: $running_containers / $total_containers"
    
    if [ "$running_containers" -gt 0 ]; then
        print_success "Containers are running"
        docker-compose ps | tee -a "$LOG_DIR/${project_name}_status.log"
        return 0
    else
        print_error "No containers are running"
        docker-compose ps | tee -a "$LOG_DIR/${project_name}_status.log"
        docker-compose logs --tail=50 | tee -a "$LOG_DIR/${project_name}_error_logs.log"
        return 1
    fi
}

# Function to stop and cleanup containers
stop_containers() {
    local project_dir=$1
    local project_name=$(basename "$project_dir")
    
    print_info "Stopping containers for: $project_name"
    cd "$project_dir"
    
    docker-compose down -v --remove-orphans 2>&1 | tee -a "$LOG_DIR/${project_name}_stop.log"
    print_success "Containers stopped and cleaned up"
}

# Function to test a single project
test_project() {
    local project_dir=$1
    local project_name=$(basename "$project_dir")
    
    print_separator
    print_info "Testing project: $project_name"
    print_separator
    
    # Create project log file
    local project_log="$LOG_DIR/${project_name}_test.log"
    echo "Testing $project_name at $(date)" > "$project_log"
    
    # Step 1: Cleanup existing Docker files
    cleanup_docker_files "$project_dir" || true
    
    # Step 2: Generate Docker files
    if ! generate_docker_files "$project_dir"; then
        print_error "Failed to generate Docker files for $project_name"
        FAILED_PROJECTS+=("$project_name (Generation Failed)")
        return 1
    fi
    
    # Step 3: Build Docker images
    if ! build_docker_images "$project_dir"; then
        print_error "Failed to build Docker images for $project_name"
        FAILED_PROJECTS+=("$project_name (Build Failed)")
        stop_containers "$project_dir" || true
        return 1
    fi
    
    # Step 4: Start containers
    if ! start_containers "$project_dir"; then
        print_error "Failed to start containers for $project_name"
        FAILED_PROJECTS+=("$project_name (Start Failed)")
        stop_containers "$project_dir" || true
        return 1
    fi
    
    # Step 5: Check if containers are running
    if ! check_containers "$project_dir"; then
        print_error "Containers not running properly for $project_name"
        FAILED_PROJECTS+=("$project_name (Runtime Failed)")
        stop_containers "$project_dir" || true
        return 1
    fi
    
    # Step 6: Stop containers
    stop_containers "$project_dir"
    
    print_success "Project $project_name tested successfully!"
    PASSED_PROJECTS+=("$project_name")
    return 0
}

# Main execution
main() {
    print_separator
    print_info "AutoDocker Extension - Fullstack Projects Sequential Test"
    print_info "Test started at: $(date)"
    print_info "Log directory: $LOG_DIR"
    print_separator
    
    # Check and install extension
    if ! check_extension; then
        if ! install_extension; then
            print_error "Cannot proceed without extension. Exiting."
            exit 1
        fi
    fi
    
    # Get list of projects
    local projects=($(ls -d "$TEST_DIR"/*/ | sort))
    local total_projects=${#projects[@]}
    
    print_info "Found $total_projects fullstack projects to test"
    print_separator
    
    # Test each project
    local current=1
    for project_dir in "${projects[@]}"; do
        local project_name=$(basename "$project_dir")
        
        print_info "Progress: $current / $total_projects"
        
        if test_project "$project_dir"; then
            print_success "✓ $project_name passed"
        else
            print_error "✗ $project_name failed"
        fi
        
        current=$((current + 1))
        
        # Brief pause between projects
        sleep 2
    done
    
    # Print summary
    print_separator
    print_info "TEST SUMMARY"
    print_separator
    print_success "Passed: ${#PASSED_PROJECTS[@]}"
    print_error "Failed: ${#FAILED_PROJECTS[@]}"
    print_warning "Skipped: ${#SKIPPED_PROJECTS[@]}"
    print_separator
    
    if [ ${#PASSED_PROJECTS[@]} -gt 0 ]; then
        print_info "Passed projects:"
        for proj in "${PASSED_PROJECTS[@]}"; do
            echo -e "  ${GREEN}✓${NC} $proj" | tee -a "$MAIN_LOG"
        done
    fi
    
    if [ ${#FAILED_PROJECTS[@]} -gt 0 ]; then
        print_info "Failed projects:"
        for proj in "${FAILED_PROJECTS[@]}"; do
            echo -e "  ${RED}✗${NC} $proj" | tee -a "$MAIN_LOG"
        done
    fi
    
    print_separator
    print_info "Test completed at: $(date)"
    print_info "Full log available at: $MAIN_LOG"
    print_separator
    
    # Exit with appropriate code
    if [ ${#FAILED_PROJECTS[@]} -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# Run main function
main
