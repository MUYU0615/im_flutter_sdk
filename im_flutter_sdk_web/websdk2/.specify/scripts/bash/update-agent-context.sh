#!/usr/bin/env bash

# Update agent context files with information from plan.md
#
# This script maintains AI agent context files by parsing feature specifications 
# and updating agent-specific configuration files with project information.
#
# MAIN FUNCTIONS:
# 1. Environment Validation
#    - Verifies git repository structure and branch information
#    - Checks for required plan.md files and templates
#    - Validates file permissions and accessibility
#
# 2. Plan Data Extraction
#    - Parses plan.md files to extract project metadata
#    - Identifies language/version, frameworks, databases, and project types
#    - Handles missing or incomplete specification data gracefully
#
# 3. Agent File Management
#    - Creates new agent context files from templates when needed
#    - Updates existing agent files with new project information
#    - Preserves manual additions and custom configurations
#    - Supports multiple AI agent formats and directory structures
#
# 4. Content Generation
#    - Generates language-specific build/test commands
#    - Creates appropriate project directory structures
#    - Updates technology stacks and recent changes sections
#    - Maintains consistent formatting and timestamps
#
# 5. Multi-Agent Support
#    - Handles agent-specific file paths and naming conventions
#    - Supports: Claude, Gemini, Copilot, Cursor, Qwen, opencode, Codex, Windsurf, Kilo Code, Auggie CLI, Roo Code, CodeBuddy CLI, Qoder CLI, Amp, SHAI, or Amazon Q Developer CLI
#    - Can update single agents or all existing agent files
#    - Creates default Claude file if no agent files exist
#
# Usage: ./update-agent-context.sh [agent_type]
# Agent types: claude|gemini|copilot|cursor-agent|qwen|opencode|codex|windsurf|kilocode|auggie|shai|q|bob|qoder
# Leave empty to update all existing agent files

set -e

# Enable strict error handling
set -u
set -o pipefail

#==============================================================================
# Configuration and Global Variables
#==============================================================================

# Get script directory and load common functions
SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# Get all paths and variables from common functions
eval $(get_feature_paths)

NEW_PLAN="$IMPL_PLAN"  # Alias for compatibility with existing code
AGENT_TYPE="${1:-}"

# Agent-specific file paths  
CLAUDE_FILE="$REPO_ROOT/CLAUDE.md"
GEMINI_FILE="$REPO_ROOT/GEMINI.md"
COPILOT_FILE="$REPO_ROOT/.github/agents/copilot-instructions.md"
CURSOR_FILE="$REPO_ROOT/.cursor/rules/specify-rules.mdc"
QWEN_FILE="$REPO_ROOT/QWEN.md"
AGENTS_FILE="$REPO_ROOT/AGENTS.md"
WINDSURF_FILE="$REPO_ROOT/.windsurf/rules/specify-rules.md"
KILOCODE_FILE="$REPO_ROOT/.kilocode/rules/specify-rules.md"
AUGGIE_FILE="$REPO_ROOT/.augment/rules/specify-rules.md"
ROO_FILE="$REPO_ROOT/.roo/rules/specify-rules.md"
CODEBUDDY_FILE="$REPO_ROOT/CODEBUDDY.md"
QODER_FILE="$REPO_ROOT/QODER.md"
AMP_FILE="$REPO_ROOT/AGENTS.md"
SHAI_FILE="$REPO_ROOT/SHAI.md"
Q_FILE="$REPO_ROOT/AGENTS.md"
BOB_FILE="$REPO_ROOT/AGENTS.md"

# Template file
TEMPLATE_FILE="$REPO_ROOT/.specify/templates/agent-file-template.md"

# Global variables for parsed plan data
NEW_LANG=""
NEW_FRAMEWORK=""
NEW_DB=""
NEW_PROJECT_TYPE=""

#==============================================================================
# Utility Functions
#==============================================================================

log_info() {
    echo "INFO: $1"
}

log_success() {
    echo "✓ $1"
}

log_error() {
    echo "ERROR: $1" >&2
}

log_warning() {
    echo "WARNING: $1" >&2
}

# Cleanup function for temporary files
cleanup() {
    local exit_code=$?
    rm -f /tmp/agent_update_*_$$
    rm -f /tmp/manual_additions_$$
    exit $exit_code
}

# Set up cleanup trap
trap cleanup EXIT INT TERM

#==============================================================================
# Validation Functions
#==============================================================================

validate_environment() {
    # Check if we have a current branch/feature (git or non-git)
    if [[ -z "$CURRENT_BRANCH" ]]; then
        log_error "Unable to determine current feature"
        if [[ "$HAS_GIT" == "true" ]]; then
            log_info "Make sure you're on a feature branch"
        else
            log_info "Set SPECIFY_FEATURE environment variable or create a feature first"
        fi
        exit 1
    fi
    
    # Check if plan.md exists
    if [[ ! -f "$NEW_PLAN" ]]; then
        log_error "No plan.md found at $NEW_PLAN"
        log_info "Make sure you're working on a feature with a corresponding spec directory"
        if [[ "$HAS_GIT" != "true" ]]; then
            log_info "Use: export SPECIFY_FEATURE=your-feature-name or create a new feature first"
        fi
        exit 1
    fi
    
    # Check if template exists (needed for new files)
    if [[ ! -f "$TEMPLATE_FILE" ]]; then
        log_warning "Template file not found at $TEMPLATE_FILE"
        log_warning "Creating new agent files will fail"
    fi
}

#==============================================================================
# Plan Parsing Functions
#==============================================================================

extract_plan_field() {
    local field_pattern="$1"
    local plan_file="$2"
    
    grep "^\*\*${field_pattern}\*\*: " "$plan_file" 2>/dev/null | \
        head -1 | \
        sed "s|^\*\*${field_pattern}\*\*: ||" | \
        sed 's/^[ \t]*//;s/[ \t]*$//' | \
        grep -v "NEEDS CLARIFICATION" | \
        grep -v "^N/A$" || echo ""
}

parse_plan_data() {
    local plan_file="$1"
    
    if [[ ! -f "$plan_file" ]]; then
        log_error "Plan file not found: $plan_file"
        return 1
    fi
    
    if [[ ! -r "$plan_file" ]]; then
        log_error "Plan file is not readable: $plan_file"
        return 1
    fi
    
    log_info "Parsing plan data from $plan_file"
    
    NEW_LANG=$(extract_plan_field_candidates "$plan_file" "Language/Version" "语言/版本")
    NEW_FRAMEWORK=$(extract_plan_field_candidates "$plan_file" "Primary Dependencies" "主要依赖" "测试框架" "协议基础")
    NEW_DB=$(extract_plan_field_candidates "$plan_file" "Storage" "存储")
    NEW_PROJECT_TYPE=$(extract_plan_field_candidates "$plan_file" "Project Type" "目标平台")
    
    # Log what we found
    if [[ -n "$NEW_LANG" ]]; then
        log_info "Found language: $NEW_LANG"
    else
        log_warning "No language information found in plan"
    fi
    
    if [[ -n "$NEW_FRAMEWORK" ]]; then
        log_info "Found framework: $NEW_FRAMEWORK"
    fi
    
    if [[ -n "$NEW_DB" ]] && [[ "$NEW_DB" != "N/A" ]]; then
        log_info "Found database: $NEW_DB"
    fi
    
    if [[ -n "$NEW_PROJECT_TYPE" ]]; then
        log_info "Found project type: $NEW_PROJECT_TYPE"
    fi
}

format_technology_stack() {
    local lang="$1"
    local framework="$2"
    local parts=()
    
    # Add non-empty parts
    [[ -n "$lang" && "$lang" != "NEEDS CLARIFICATION" ]] && parts+=("$lang")
    [[ -n "$framework" && "$framework" != "NEEDS CLARIFICATION" && "$framework" != "N/A" ]] && parts+=("$framework")
    
    # Join with proper formatting
    if [[ ${#parts[@]} -eq 0 ]]; then
        echo ""
    elif [[ ${#parts[@]} -eq 1 ]]; then
        echo "${parts[0]}"
    else
        # Join multiple parts with " + "
        local result="${parts[0]}"
        for ((i=1; i<${#parts[@]}; i++)); do
            result="$result + ${parts[i]}"
        done
        echo "$result"
    fi
}

sanitize_plan_value() {
    local value="$1"

    printf '%s' "$value" | \
        sed 's/`//g' | \
        sed 's/[[:space:]]\+/ /g' | \
        sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

extract_plan_field_block() {
    local field_pattern="$1"
    local plan_file="$2"

    awk -v field="$field_pattern" '
        BEGIN { capture = 0 }
        $0 ~ "^\\*\\*" field "\\*\\*:" || $0 ~ "^-[[:space:]]*\\*\\*" field "\\*\\*:" {
            capture = 1
            line = $0
            sub("^(-[[:space:]]*)?\\*\\*" field "\\*\\*:[[:space:]]*", "", line)
            gsub(/[[:space:]]+$/, "", line)
            if (line != "") {
                print line
            }
            next
        }
        capture {
            if ($0 ~ "^(-[[:space:]]*)?\\*\\*.+\\*\\*:" || $0 ~ "^## " || $0 ~ "^```") {
                exit
            }
            if ($0 ~ /^[[:space:]]*$/ || $0 ~ /^<!--/) {
                next
            }
            line = $0
            sub(/^[[:space:]]*-[[:space:]]*/, "", line)
            sub(/^[[:space:]]+/, "", line)
            gsub(/[[:space:]]+$/, "", line)
            if (line != "") {
                print line
            }
        }
    ' "$plan_file" | \
        awk '
            BEGIN { first = 1 }
            {
                if (!first) {
                    printf "、"
                }
                printf "%s", $0
                first = 0
            }
            END {
                printf "\n"
            }
        ' | \
        sed '/^$/d' | \
        while IFS= read -r line; do
            sanitize_plan_value "$line"
        done | \
        grep -v "NEEDS CLARIFICATION" || true
}

extract_plan_field_candidates() {
    local plan_file="$1"
    shift
    local field=""
    local candidate=""

    for field in "$@"; do
        candidate=$(extract_plan_field_block "$field" "$plan_file")
        if [[ -n "$candidate" ]]; then
            printf '%s\n' "$candidate"
        fi
    done | \
        awk '!seen[$0]++' | \
        awk '
            BEGIN { first = 1 }
            {
                if (!first) {
                    printf "；"
                }
                printf "%s", $0
                first = 0
            }
            END {
                printf "\n"
            }
        '
}

extract_plan_date() {
    local plan_file="$1"
    local date_value=""

    date_value=$(grep "^\*\*Branch\*\*:" "$plan_file" 2>/dev/null | head -1 | sed -E 's/.*\*\*Date\*\*: *([0-9]{4}-[0-9]{2}-[0-9]{2}).*/\1/' || true)

    if [[ "$date_value" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
        echo "$date_value"
        return
    fi

    echo ""
}

extract_plan_summary() {
    local plan_file="$1"

    awk '
        /^\*\*范围\*\*:/ {
            line = $0
            sub(/^\*\*范围\*\*:[[:space:]]*/, "", line)
            gsub(/`/, "", line)
            gsub(/[[:space:]]+/, " ", line)
            print line
            exit
        }
        /^## (概述|目标)$/ {
            capture = 1
            next
        }
        capture {
            if ($0 ~ /^## /) {
                exit
            }
            if ($0 ~ /^[[:space:]]*$/) {
                next
            }
            line = $0
            sub(/^[[:space:]]*-[[:space:]]*/, "", line)
            gsub(/`/, "", line)
            gsub(/[[:space:]]+/, " ", line)
            print line
            exit
        }
    ' "$plan_file" | while IFS= read -r line; do
        sanitize_plan_value "$line"
    done
}

collect_all_plan_metadata() {
    local metadata_file
    metadata_file=$(mktemp "/tmp/agent_update_metadata_XXXX")

    while IFS= read -r plan_file; do
        local feature_name
        local feature_date
        local language
        local framework
        local storage
        local project_type
        local tech_stack
        local summary

        feature_name=$(basename "$(dirname "$plan_file")")
        feature_date=$(extract_plan_date "$plan_file")
        language=$(extract_plan_field_candidates "$plan_file" "Language/Version" "语言/版本")
        framework=$(extract_plan_field_candidates "$plan_file" "Primary Dependencies" "主要依赖" "测试框架" "协议基础")
        storage=$(extract_plan_field_candidates "$plan_file" "Storage" "存储")
        project_type=$(extract_plan_field_candidates "$plan_file" "Project Type" "目标平台")
        tech_stack=$(format_technology_stack "$language" "$framework")
        summary=$(extract_plan_summary "$plan_file")

        printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
            "$feature_name" \
            "$feature_date" \
            "$language" \
            "$framework" \
            "$storage" \
            "$project_type" \
            "$tech_stack" \
            "$summary" >> "$metadata_file"
    done < <(find "$REPO_ROOT/specs" -mindepth 2 -maxdepth 2 -name plan.md | sort)

    echo "$metadata_file"
}

summarize_metadata_column() {
    local metadata_file="$1"
    local column_index="$2"
    local limit="$3"

    awk -F '\t' -v column_index="$column_index" -v limit="$limit" '
        {
            values[NR] = $column_index
        }
        END {
            count = 0
            for (i = NR; i >= 1; i--) {
                value = values[i]
                gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
                if (value == "" || seen[value]++) {
                    continue
                }
                entries[++count] = value
                if (limit > 0 && count >= limit) {
                    break
                }
            }
            for (i = 1; i <= count; i++) {
                if (i > 1) {
                    printf "；"
                }
                printf "%s", entries[i]
            }
            printf "\n"
        }
    ' "$metadata_file"
}

build_repo_structure_block() {
    local directories=(
        ".cursor"
        ".specify"
        "docs"
        "specs"
        "src"
        "tests"
        "demo"
        "scripts"
    )
    local output=""
    local directory=""

    for directory in "${directories[@]}"; do
        if [[ -d "$REPO_ROOT/$directory" ]]; then
            output="${output}${directory}/"$'\n'
        fi
    done

    printf '%s' "$output" | sed '/^$/d'
}

build_common_commands_block() {
    local package_file="$REPO_ROOT/package.json"
    local commands=()

    if [[ ! -f "$package_file" ]]; then
        return
    fi

    grep -q '"test:run"' "$package_file" && commands+=("- \`npm run test:run\`")
    grep -q '"lint"' "$package_file" && commands+=("- \`npm run lint\`")
    grep -q '"type-check"' "$package_file" && commands+=("- \`npm run type-check\`")
    grep -q '"test:coverage"' "$package_file" && commands+=("- \`npm run test:coverage\`")
    grep -q '"test:gate:pr"' "$package_file" && commands+=("- \`npm run test:gate:pr\`")
    grep -q '"test:e2e"' "$package_file" && commands+=("- \`npm run test:e2e\`")
    grep -q '"docs:api:check"' "$package_file" && commands+=("- \`npm run docs:api:check\`")

    printf '%s\n' "${commands[@]}"
}

build_code_style_block() {
    cat <<'EOF'
- TypeScript strict 模式，禁止 `any`，公共 API 优先使用 `interface`
- 所有函数与方法显式声明返回类型，异步逻辑优先使用 `async/await + try/catch`
- 优先命名导出，类型导入使用 `import type`，格式化遵循 Prettier 配置
EOF
}

extract_manual_additions_content() {
    local target_file="$1"

    if [[ ! -f "$target_file" ]]; then
        return
    fi

    awk '
        /<!-- MANUAL ADDITIONS START -->/ {
            in_block = 1
            next
        }
        /<!-- MANUAL ADDITIONS END -->/ {
            in_block = 0
            exit
        }
        in_block {
            print
        }
    ' "$target_file"
}

write_existing_agents_preamble() {
    local target_file="$1"
    local temp_file="$2"

    if [[ ! -f "$target_file" ]]; then
        return
    fi

    awk '
        /^## websdk2 开发指南$/ {
            exit
        }
        {
            print
        }
    ' "$target_file" >> "$temp_file"
}

append_recent_updates_section() {
    local metadata_file="$1"

    awk -F '\t' '
        {
            features[NR] = $1
            dates[NR] = $2
            techs[NR] = $7
            storages[NR] = $5
            summaries[NR] = $8
        }
        END {
            count = 0
            for (i = NR; i >= 1 && count < 3; i--) {
                line = "- " features[i]
                if (dates[i] != "") {
                    line = line "（" dates[i] "）"
                }
                if (techs[i] != "") {
                    line = line "：补充 " techs[i]
                } else if (summaries[i] != "") {
                    line = line "：补充 " summaries[i]
                }
                if (storages[i] != "") {
                    line = line "；存储：" storages[i]
                }
                print line
                count++
            }
        }
    ' "$metadata_file"
}

append_active_technologies_section() {
    local metadata_file="$1"

    awk -F '\t' '
        {
            feature = $1
            storage = $5
            tech = $7
            summary = $8

            if (tech != "") {
                print "- " tech "（" feature "）"
            } else if (summary != "") {
                print "- 方案摘要：" summary "（" feature "）"
            }

            if (storage != "") {
                print "- 存储：" storage "（" feature "）"
            }
        }
    ' "$metadata_file"
}

append_recent_changes_section() {
    local metadata_file="$1"

    awk -F '\t' '
        {
            features[NR] = $1
            dates[NR] = $2
            languages[NR] = $3
            frameworks[NR] = $4
            storages[NR] = $5
            summaries[NR] = $8
        }
        END {
            count = 0
            for (i = NR; i >= 1 && count < 5; i--) {
                line = "- " features[i]
                if (dates[i] != "") {
                    line = line "（" dates[i] "）"
                }
                details = ""
                if (languages[i] != "") {
                    details = details "语言/版本：" languages[i]
                }
                if (frameworks[i] != "") {
                    if (details != "") {
                        details = details "；"
                    }
                    details = details "主要依赖：" frameworks[i]
                }
                if (storages[i] != "") {
                    if (details != "") {
                        details = details "；"
                    }
                    details = details "存储：" storages[i]
                }
                if (details == "" && summaries[i] != "") {
                    details = "方案摘要：" summaries[i]
                }
                if (details != "") {
                    line = line "：更新 " details
                }
                print line
                count++
            }
        }
    ' "$metadata_file"
}

rebuild_codex_agent_file() {
    local target_file="$1"
    local current_date="$2"
    local metadata_file=""
    local temp_file=""
    local manual_additions=""
    local language_summary=""
    local dependency_summary=""
    local storage_summary=""
    local project_type_summary=""
    local project_name=""

    metadata_file=$(collect_all_plan_metadata)
    temp_file=$(mktemp) || {
        log_error "Failed to create temporary file"
        return 1
    }

    project_name=$(basename "$REPO_ROOT")
    manual_additions=$(extract_manual_additions_content "$target_file")
    language_summary=$(summarize_metadata_column "$metadata_file" 3 5)
    dependency_summary=$(summarize_metadata_column "$metadata_file" 4 4)
    storage_summary=$(summarize_metadata_column "$metadata_file" 5 5)
    project_type_summary=$(summarize_metadata_column "$metadata_file" 6 4)

    if [[ -f "$target_file" ]]; then
        write_existing_agents_preamble "$target_file" "$temp_file"
    fi

    if [[ -s "$temp_file" ]]; then
        printf '\n' >> "$temp_file"
    fi

    cat <<EOF >> "$temp_file"
## ${project_name} 开发指南

自动从所有功能计划生成。最后更新：${current_date}

## 当前技术栈
EOF

    if [[ -n "$language_summary" ]]; then
        printf '%s\n' "- 语言/版本：${language_summary}" >> "$temp_file"
    fi

    if [[ -n "$dependency_summary" ]]; then
        printf '%s\n' "- 主要依赖：${dependency_summary}" >> "$temp_file"
    fi

    if [[ -n "$storage_summary" ]]; then
        printf '%s\n' "- 存储方案：${storage_summary}" >> "$temp_file"
    fi

    if [[ -n "$project_type_summary" ]]; then
        printf '%s\n' "- 项目形态：${project_type_summary}" >> "$temp_file"
    fi

    cat <<'EOF' >> "$temp_file"

## 项目结构

```text
EOF
    build_repo_structure_block >> "$temp_file"
    cat <<'EOF' >> "$temp_file"
```

## 常用命令
EOF
    build_common_commands_block >> "$temp_file"
    cat <<'EOF' >> "$temp_file"

## 代码风格
EOF
    build_code_style_block >> "$temp_file"
    cat <<'EOF' >> "$temp_file"

## 最近更新
EOF
    append_recent_updates_section "$metadata_file" >> "$temp_file"
    cat <<'EOF' >> "$temp_file"

<!-- MANUAL ADDITIONS START -->
EOF

    if [[ -n "$manual_additions" ]]; then
        printf '%s\n' "$manual_additions" >> "$temp_file"
    fi

    cat <<'EOF' >> "$temp_file"
<!-- MANUAL ADDITIONS END -->

## 当前活跃技术
EOF
    append_active_technologies_section "$metadata_file" >> "$temp_file"
    cat <<'EOF' >> "$temp_file"

## 最近变更
EOF
    append_recent_changes_section "$metadata_file" >> "$temp_file"

    if ! mv "$temp_file" "$target_file"; then
        log_error "Failed to move rebuilt Codex agent file into place"
        rm -f "$temp_file"
        rm -f "$metadata_file"
        return 1
    fi

    rm -f "$metadata_file"
    log_success "Rebuilt Codex context file from all specs"
    return 0
}

#==============================================================================
# Template and Content Generation Functions
#==============================================================================

get_project_structure() {
    local project_type="$1"
    
    if [[ "$project_type" == *"web"* ]]; then
        echo "backend/\\nfrontend/\\ntests/"
    else
        echo "src/\\ntests/"
    fi
}

get_commands_for_language() {
    local lang="$1"
    
    case "$lang" in
        *"Python"*)
            echo "cd src && pytest && ruff check ."
            ;;
        *"Rust"*)
            echo "cargo test && cargo clippy"
            ;;
        *"JavaScript"*|*"TypeScript"*)
            echo "npm test \\&\\& npm run lint"
            ;;
        *)
            echo "# Add commands for $lang"
            ;;
    esac
}

get_language_conventions() {
    local lang="$1"
    echo "$lang: Follow standard conventions"
}

create_new_agent_file() {
    local target_file="$1"
    local temp_file="$2"
    local project_name="$3"
    local current_date="$4"
    
    if [[ ! -f "$TEMPLATE_FILE" ]]; then
        log_error "Template not found at $TEMPLATE_FILE"
        return 1
    fi
    
    if [[ ! -r "$TEMPLATE_FILE" ]]; then
        log_error "Template file is not readable: $TEMPLATE_FILE"
        return 1
    fi
    
    log_info "Creating new agent context file from template..."
    
    if ! cp "$TEMPLATE_FILE" "$temp_file"; then
        log_error "Failed to copy template file"
        return 1
    fi
    
    # Replace template placeholders
    local project_structure
    project_structure=$(get_project_structure "$NEW_PROJECT_TYPE")
    
    local commands
    commands=$(get_commands_for_language "$NEW_LANG")
    
    local language_conventions
    language_conventions=$(get_language_conventions "$NEW_LANG")
    
    # Perform substitutions with error checking using safer approach
    # Escape special characters for sed by using a different delimiter or escaping
    local escaped_lang=$(printf '%s\n' "$NEW_LANG" | sed 's/[\[\.*^$()+{}|]/\\&/g')
    local escaped_framework=$(printf '%s\n' "$NEW_FRAMEWORK" | sed 's/[\[\.*^$()+{}|]/\\&/g')
    local escaped_branch=$(printf '%s\n' "$CURRENT_BRANCH" | sed 's/[\[\.*^$()+{}|]/\\&/g')
    
    # Build technology stack and recent change strings conditionally
    local tech_stack
    if [[ -n "$escaped_lang" && -n "$escaped_framework" ]]; then
        tech_stack="- $escaped_lang + $escaped_framework ($escaped_branch)"
    elif [[ -n "$escaped_lang" ]]; then
        tech_stack="- $escaped_lang ($escaped_branch)"
    elif [[ -n "$escaped_framework" ]]; then
        tech_stack="- $escaped_framework ($escaped_branch)"
    else
        tech_stack="- ($escaped_branch)"
    fi

    local recent_change
    if [[ -n "$escaped_lang" && -n "$escaped_framework" ]]; then
        recent_change="- $escaped_branch: Added $escaped_lang + $escaped_framework"
    elif [[ -n "$escaped_lang" ]]; then
        recent_change="- $escaped_branch: Added $escaped_lang"
    elif [[ -n "$escaped_framework" ]]; then
        recent_change="- $escaped_branch: Added $escaped_framework"
    else
        recent_change="- $escaped_branch: Added"
    fi

    local substitutions=(
        "s|\[PROJECT NAME\]|$project_name|"
        "s|\[DATE\]|$current_date|"
        "s|\[EXTRACTED FROM ALL PLAN.MD FILES\]|$tech_stack|"
        "s|\[ACTUAL STRUCTURE FROM PLANS\]|$project_structure|g"
        "s|\[ONLY COMMANDS FOR ACTIVE TECHNOLOGIES\]|$commands|"
        "s|\[LANGUAGE-SPECIFIC, ONLY FOR LANGUAGES IN USE\]|$language_conventions|"
        "s|\[LAST 3 FEATURES AND WHAT THEY ADDED\]|$recent_change|"
    )
    
    for substitution in "${substitutions[@]}"; do
        if ! sed -i.bak -e "$substitution" "$temp_file"; then
            log_error "Failed to perform substitution: $substitution"
            rm -f "$temp_file" "$temp_file.bak"
            return 1
        fi
    done
    
    # Convert \n sequences to actual newlines
    newline=$(printf '\n')
    sed -i.bak2 "s/\\\\n/${newline}/g" "$temp_file"
    
    # Clean up backup files
    rm -f "$temp_file.bak" "$temp_file.bak2"
    
    return 0
}




update_existing_agent_file() {
    local target_file="$1"
    local current_date="$2"
    
    log_info "Updating existing agent context file..."
    
    # Use a single temporary file for atomic update
    local temp_file
    temp_file=$(mktemp) || {
        log_error "Failed to create temporary file"
        return 1
    }
    
    # Process the file in one pass
    local tech_stack=$(format_technology_stack "$NEW_LANG" "$NEW_FRAMEWORK")
    local new_tech_entries=()
    local new_change_entry=""
    
    # Prepare new technology entries
    if [[ -n "$tech_stack" ]] && ! grep -q "$tech_stack" "$target_file"; then
        new_tech_entries+=("- $tech_stack ($CURRENT_BRANCH)")
    fi
    
    if [[ -n "$NEW_DB" ]] && [[ "$NEW_DB" != "N/A" ]] && [[ "$NEW_DB" != "NEEDS CLARIFICATION" ]] && ! grep -q "$NEW_DB" "$target_file"; then
        new_tech_entries+=("- $NEW_DB ($CURRENT_BRANCH)")
    fi
    
    # Prepare new change entry
    if [[ -n "$tech_stack" ]]; then
        new_change_entry="- $CURRENT_BRANCH: Added $tech_stack"
    elif [[ -n "$NEW_DB" ]] && [[ "$NEW_DB" != "N/A" ]] && [[ "$NEW_DB" != "NEEDS CLARIFICATION" ]]; then
        new_change_entry="- $CURRENT_BRANCH: Added $NEW_DB"
    fi
    
    # Check if sections exist in the file
    local has_active_technologies=0
    local has_recent_changes=0
    
    if grep -q "^## Active Technologies" "$target_file" 2>/dev/null; then
        has_active_technologies=1
    fi
    
    if grep -q "^## Recent Changes" "$target_file" 2>/dev/null; then
        has_recent_changes=1
    fi
    
    # Process file line by line
    local in_tech_section=false
    local in_changes_section=false
    local tech_entries_added=false
    local changes_entries_added=false
    local existing_changes_count=0
    local file_ended=false
    
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Handle Active Technologies section
        if [[ "$line" == "## Active Technologies" ]]; then
            echo "$line" >> "$temp_file"
            in_tech_section=true
            continue
        elif [[ $in_tech_section == true ]] && [[ "$line" =~ ^##[[:space:]] ]]; then
            # Add new tech entries before closing the section
            if [[ $tech_entries_added == false ]] && [[ ${#new_tech_entries[@]} -gt 0 ]]; then
                printf '%s\n' "${new_tech_entries[@]}" >> "$temp_file"
                tech_entries_added=true
            fi
            echo "$line" >> "$temp_file"
            in_tech_section=false
            continue
        elif [[ $in_tech_section == true ]] && [[ -z "$line" ]]; then
            # Add new tech entries before empty line in tech section
            if [[ $tech_entries_added == false ]] && [[ ${#new_tech_entries[@]} -gt 0 ]]; then
                printf '%s\n' "${new_tech_entries[@]}" >> "$temp_file"
                tech_entries_added=true
            fi
            echo "$line" >> "$temp_file"
            continue
        fi
        
        # Handle Recent Changes section
        if [[ "$line" == "## Recent Changes" ]]; then
            echo "$line" >> "$temp_file"
            # Add new change entry right after the heading
            if [[ -n "$new_change_entry" ]]; then
                echo "$new_change_entry" >> "$temp_file"
            fi
            in_changes_section=true
            changes_entries_added=true
            continue
        elif [[ $in_changes_section == true ]] && [[ "$line" =~ ^##[[:space:]] ]]; then
            echo "$line" >> "$temp_file"
            in_changes_section=false
            continue
        elif [[ $in_changes_section == true ]] && [[ "$line" == "- "* ]]; then
            # Keep only first 2 existing changes
            if [[ $existing_changes_count -lt 2 ]]; then
                echo "$line" >> "$temp_file"
                ((existing_changes_count++))
            fi
            continue
        fi
        
        # Update timestamp
        if [[ "$line" =~ \*\*Last\ updated\*\*:.*[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] ]]; then
            echo "$line" | sed "s/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]/$current_date/" >> "$temp_file"
        else
            echo "$line" >> "$temp_file"
        fi
    done < "$target_file"
    
    # Post-loop check: if we're still in the Active Technologies section and haven't added new entries
    if [[ $in_tech_section == true ]] && [[ $tech_entries_added == false ]] && [[ ${#new_tech_entries[@]} -gt 0 ]]; then
        printf '%s\n' "${new_tech_entries[@]}" >> "$temp_file"
        tech_entries_added=true
    fi
    
    # If sections don't exist, add them at the end of the file
    if [[ $has_active_technologies -eq 0 ]] && [[ ${#new_tech_entries[@]} -gt 0 ]]; then
        echo "" >> "$temp_file"
        echo "## Active Technologies" >> "$temp_file"
        printf '%s\n' "${new_tech_entries[@]}" >> "$temp_file"
        tech_entries_added=true
    fi
    
    if [[ $has_recent_changes -eq 0 ]] && [[ -n "$new_change_entry" ]]; then
        echo "" >> "$temp_file"
        echo "## Recent Changes" >> "$temp_file"
        echo "$new_change_entry" >> "$temp_file"
        changes_entries_added=true
    fi
    
    # Move temp file to target atomically
    if ! mv "$temp_file" "$target_file"; then
        log_error "Failed to update target file"
        rm -f "$temp_file"
        return 1
    fi
    
    return 0
}
#==============================================================================
# Main Agent File Update Function
#==============================================================================

update_agent_file() {
    local target_file="$1"
    local agent_name="$2"
    
    if [[ -z "$target_file" ]] || [[ -z "$agent_name" ]]; then
        log_error "update_agent_file requires target_file and agent_name parameters"
        return 1
    fi
    
    log_info "Updating $agent_name context file: $target_file"
    
    local project_name
    project_name=$(basename "$REPO_ROOT")
    local current_date
    current_date=$(date +%Y-%m-%d)
    
    # Create directory if it doesn't exist
    local target_dir
    target_dir=$(dirname "$target_file")
    if [[ ! -d "$target_dir" ]]; then
        if ! mkdir -p "$target_dir"; then
            log_error "Failed to create directory: $target_dir"
            return 1
        fi
    fi
    
    if [[ ! -f "$target_file" ]]; then
        # Create new file from template
        local temp_file
        temp_file=$(mktemp) || {
            log_error "Failed to create temporary file"
            return 1
        }
        
        if create_new_agent_file "$target_file" "$temp_file" "$project_name" "$current_date"; then
            if mv "$temp_file" "$target_file"; then
                log_success "Created new $agent_name context file"
            else
                log_error "Failed to move temporary file to $target_file"
                rm -f "$temp_file"
                return 1
            fi
        else
            log_error "Failed to create new agent file"
            rm -f "$temp_file"
            return 1
        fi
    else
        # Update existing file
        if [[ ! -r "$target_file" ]]; then
            log_error "Cannot read existing file: $target_file"
            return 1
        fi
        
        if [[ ! -w "$target_file" ]]; then
            log_error "Cannot write to existing file: $target_file"
            return 1
        fi
        
        if update_existing_agent_file "$target_file" "$current_date"; then
            log_success "Updated existing $agent_name context file"
        else
            log_error "Failed to update existing agent file"
            return 1
        fi
    fi
    
    return 0
}

#==============================================================================
# Agent Selection and Processing
#==============================================================================

update_specific_agent() {
    local agent_type="$1"
    
    case "$agent_type" in
        claude)
            update_agent_file "$CLAUDE_FILE" "Claude Code"
            ;;
        gemini)
            update_agent_file "$GEMINI_FILE" "Gemini CLI"
            ;;
        copilot)
            update_agent_file "$COPILOT_FILE" "GitHub Copilot"
            ;;
        cursor-agent)
            update_agent_file "$CURSOR_FILE" "Cursor IDE"
            ;;
        qwen)
            update_agent_file "$QWEN_FILE" "Qwen Code"
            ;;
        opencode)
            update_agent_file "$AGENTS_FILE" "opencode"
            ;;
        codex)
            rebuild_codex_agent_file "$AGENTS_FILE" "$(date +%Y-%m-%d)"
            ;;
        windsurf)
            update_agent_file "$WINDSURF_FILE" "Windsurf"
            ;;
        kilocode)
            update_agent_file "$KILOCODE_FILE" "Kilo Code"
            ;;
        auggie)
            update_agent_file "$AUGGIE_FILE" "Auggie CLI"
            ;;
        roo)
            update_agent_file "$ROO_FILE" "Roo Code"
            ;;
        codebuddy)
            update_agent_file "$CODEBUDDY_FILE" "CodeBuddy CLI"
            ;;
        qoder)
            update_agent_file "$QODER_FILE" "Qoder CLI"
            ;;
        amp)
            update_agent_file "$AMP_FILE" "Amp"
            ;;
        shai)
            update_agent_file "$SHAI_FILE" "SHAI"
            ;;
        q)
            update_agent_file "$Q_FILE" "Amazon Q Developer CLI"
            ;;
        bob)
            update_agent_file "$BOB_FILE" "IBM Bob"
            ;;
        *)
            log_error "Unknown agent type '$agent_type'"
            log_error "Expected: claude|gemini|copilot|cursor-agent|qwen|opencode|codex|windsurf|kilocode|auggie|roo|amp|shai|q|bob|qoder"
            exit 1
            ;;
    esac
}

update_all_existing_agents() {
    local found_agent=false
    
    # Check each possible agent file and update if it exists
    if [[ -f "$CLAUDE_FILE" ]]; then
        update_agent_file "$CLAUDE_FILE" "Claude Code"
        found_agent=true
    fi
    
    if [[ -f "$GEMINI_FILE" ]]; then
        update_agent_file "$GEMINI_FILE" "Gemini CLI"
        found_agent=true
    fi
    
    if [[ -f "$COPILOT_FILE" ]]; then
        update_agent_file "$COPILOT_FILE" "GitHub Copilot"
        found_agent=true
    fi
    
    if [[ -f "$CURSOR_FILE" ]]; then
        update_agent_file "$CURSOR_FILE" "Cursor IDE"
        found_agent=true
    fi
    
    if [[ -f "$QWEN_FILE" ]]; then
        update_agent_file "$QWEN_FILE" "Qwen Code"
        found_agent=true
    fi
    
    if [[ -f "$AGENTS_FILE" ]]; then
        update_agent_file "$AGENTS_FILE" "Codex/opencode"
        found_agent=true
    fi
    
    if [[ -f "$WINDSURF_FILE" ]]; then
        update_agent_file "$WINDSURF_FILE" "Windsurf"
        found_agent=true
    fi
    
    if [[ -f "$KILOCODE_FILE" ]]; then
        update_agent_file "$KILOCODE_FILE" "Kilo Code"
        found_agent=true
    fi

    if [[ -f "$AUGGIE_FILE" ]]; then
        update_agent_file "$AUGGIE_FILE" "Auggie CLI"
        found_agent=true
    fi
    
    if [[ -f "$ROO_FILE" ]]; then
        update_agent_file "$ROO_FILE" "Roo Code"
        found_agent=true
    fi

    if [[ -f "$CODEBUDDY_FILE" ]]; then
        update_agent_file "$CODEBUDDY_FILE" "CodeBuddy CLI"
        found_agent=true
    fi

    if [[ -f "$SHAI_FILE" ]]; then
        update_agent_file "$SHAI_FILE" "SHAI"
        found_agent=true
    fi

    if [[ -f "$QODER_FILE" ]]; then
        update_agent_file "$QODER_FILE" "Qoder CLI"
        found_agent=true
    fi

    if [[ -f "$Q_FILE" ]]; then
        update_agent_file "$Q_FILE" "Amazon Q Developer CLI"
        found_agent=true
    fi
    
    if [[ -f "$BOB_FILE" ]]; then
        update_agent_file "$BOB_FILE" "IBM Bob"
        found_agent=true
    fi
    
    # If no agent files exist, create a default Claude file
    if [[ "$found_agent" == false ]]; then
        log_info "No existing agent files found, creating default Claude file..."
        update_agent_file "$CLAUDE_FILE" "Claude Code"
    fi
}
print_summary() {
    echo
    log_info "Summary of changes:"
    
    if [[ -n "$NEW_LANG" ]]; then
        echo "  - Added language: $NEW_LANG"
    fi
    
    if [[ -n "$NEW_FRAMEWORK" ]]; then
        echo "  - Added framework: $NEW_FRAMEWORK"
    fi
    
    if [[ -n "$NEW_DB" ]] && [[ "$NEW_DB" != "N/A" ]]; then
        echo "  - Added database: $NEW_DB"
    fi
    
    echo

    log_info "Usage: $0 [claude|gemini|copilot|cursor-agent|qwen|opencode|codex|windsurf|kilocode|auggie|codebuddy|shai|q|bob|qoder]"
}

#==============================================================================
# Main Execution
#==============================================================================

main() {
    # Validate environment before proceeding
    validate_environment
    
    log_info "=== Updating agent context files for feature $CURRENT_BRANCH ==="
    
    # Parse the plan file to extract project information
    if ! parse_plan_data "$NEW_PLAN"; then
        log_error "Failed to parse plan data"
        exit 1
    fi
    
    # Process based on agent type argument
    local success=true
    
    if [[ -z "$AGENT_TYPE" ]]; then
        # No specific agent provided - update all existing agent files
        log_info "No agent specified, updating all existing agent files..."
        if ! update_all_existing_agents; then
            success=false
        fi
    else
        # Specific agent provided - update only that agent
        log_info "Updating specific agent: $AGENT_TYPE"
        if ! update_specific_agent "$AGENT_TYPE"; then
            success=false
        fi
    fi
    
    # Print summary
    print_summary
    
    if [[ "$success" == true ]]; then
        log_success "Agent context update completed successfully"
        exit 0
    else
        log_error "Agent context update completed with errors"
        exit 1
    fi
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
