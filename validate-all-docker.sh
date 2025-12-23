#!/bin/bash

# Docker Validation Script for Mac/Linux
# Usage: ./validate-all-docker.sh

echo -e "\033[36m========================================\033[0m"
echo -e "\033[36m      Docker Verification Suite         \033[0m"
echo -e "\033[36m========================================\033[0m\n"

PASSED=0
FAILED=0

# Function to test a project
test_project() {
    local project_dir=$1
    local category=$(basename $(dirname "$project_dir"))
    local name=$(basename "$project_dir")
    local display_name="$category/$name"
    
    echo -e "\033[34m▶ Testing: $display_name\033[0m"
    
    # Check if Dockerfile exists
    # Check for client/server/web/api folders which are common in monorepos/fullstack
    local has_inner_docker=false
    
    if [ -f "$project_dir/Dockerfile" ]; then
        has_inner_docker=true
    elif [ -f "$project_dir/backend/Dockerfile" ] || [ -f "$project_dir/frontend/Dockerfile" ]; then
         has_inner_docker=true
    elif [ -f "$project_dir/server/Dockerfile" ] || [ -f "$project_dir/client/Dockerfile" ]; then
         has_inner_docker=true
    elif [ -f "$project_dir/api/Dockerfile" ] || [ -f "$project_dir/web/Dockerfile" ]; then
         has_inner_docker=true
    fi

    if [ "$has_inner_docker" = false ]; then
        # Check standard monorepo structures (apps/*, packages/*)
        local found=false
        if [ -d "$project_dir/apps" ]; then
            if ls "$project_dir/apps"/*/Dockerfile 1> /dev/null 2>&1; then found=true; fi
        fi
        if [ -d "$project_dir/packages" ]; then
            if ls "$project_dir/packages"/*/Dockerfile 1> /dev/null 2>&1; then found=true; fi
        fi
        
        if [ "$found" = false ]; then
            echo -e "  \033[31m❌ Skipped (No Dockerfile found)\033[0m"
            FAILED=$((FAILED+1))
            return
        fi
    fi
    
    # Build strategy
    local build_cmd=""
    local build_context="$project_dir"
    local image_name="test-$(echo $name | tr '[:upper:]' '[:lower:]' | tr -cd '[:alnum:]-')"
    
    if [ -f "$project_dir/Dockerfile" ]; then
        build_cmd="docker build -t $image_name ."
    elif [ -f "$project_dir/backend/Dockerfile" ]; then
        build_cmd="docker build -t $image_name -f backend/Dockerfile ."
    elif [ -f "$project_dir/frontend/Dockerfile" ]; then
        build_cmd="docker build -t $image_name -f frontend/Dockerfile ."
    elif [ -f "$project_dir/server/Dockerfile" ]; then
        # For implicit workspaces (server folder is root of backend), we might need to build from server context OR root context
        # The generated Dockerfile usually expects to be at root of service (COPY package.json .)
        # But if we build from project root, we need -f server/Dockerfile 
        # AND check if Dockerfile expects context at root or subfolder.
        # SmartDockerfileGenerator usually copies . . -> implies context is service root.
        # So we should cd into server/ for build.
        build_context="$project_dir/server"
        build_cmd="docker build -t $image_name ."
    elif [ -f "$project_dir/client/Dockerfile" ]; then
        build_context="$project_dir/client"
        build_cmd="docker build -t $image_name ."
    elif [ -f "$project_dir/api/Dockerfile" ]; then
        build_context="$project_dir/api"
        build_cmd="docker build -t $image_name ."
    elif [ -f "$project_dir/web/Dockerfile" ]; then
        build_context="$project_dir/web"
        build_cmd="docker build -t $image_name ."
    else
        # Try to find any Dockerfile
        local df=$(find "$project_dir" -name Dockerfile | head -n 1)
        if [ -n "$df" ]; then
            local rel_path=${df#$project_dir/}
            build_cmd="docker build -t $image_name -f $rel_path ."
        fi
    fi
    
    if [ -z "$build_cmd" ]; then
        echo -e "  \033[31m❌ Failed to determine build command\033[0m"
        FAILED=$((FAILED+1))
        return
    fi
    
    echo -n "  Building... "
    
    # Run build (capturing output to log on failure)
    if (cd "$build_context" && $build_cmd > build.log 2>&1); then
        echo -e "\033[32m✔ BUILT\033[0m"
        PASSED=$((PASSED+1))
        # Cleanup
        docker rmi $image_name > /dev/null 2>&1 || true
        rm "$project_dir/build.log" 2>/dev/null || true
    else
        echo -e "\033[31m❌ FAILED\033[0m"
        echo "  (See $project_dir/build.log for details)"
        FAILED=$((FAILED+1))
    fi
    echo ""
}

# Iterate through categories
for category in backend frontend fullstack; do
    if [ -d "test-projects/$category" ]; then
        for project in "test-projects/$category"/*; do
            if [ -d "$project" ]; then
                test_project "$project"
            fi
        done
    fi
done

echo -e "\033[36m========================================\033[0m"
echo -e "\033[36m           SUMMARY                      \033[0m"
echo -e "\033[36m========================================\033[0m"
echo -e "\033[32m✅ Passed: $PASSED\033[0m"
echo -e "\033[31m❌ Failed: $FAILED\033[0m"

if [ $FAILED -eq 0 ]; then
    echo -e "\n\033[32mAll tests passed! 🚀\033[0m"
    exit 0
else
    echo -e "\n\033[31mSome tests failed.\033[0m"
    exit 1
fi
