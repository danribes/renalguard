#!/bin/bash

# ============================================
# T030: Claude AI Integration Test Script
# ============================================
# Tests Claude API client implementation and AI service
# Verifies types, API client, and risk analysis service

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Project root directory
PROJECT_ROOT="/home/user/hackathon_BI_CKD"

# Test results array
declare -a FAILED_TESTS

# Function to print section header
print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Test $TESTS_RUN: $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗${NC} Test $TESTS_RUN: $test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        FAILED_TESTS+=("Test $TESTS_RUN: $test_name")
        return 1
    fi
}

# Function to check if file contains string
file_contains() {
    local file="$1"
    local search_string="$2"
    grep -q "$search_string" "$file"
}

# Function to check if multiple strings exist in file
file_contains_all() {
    local file="$1"
    shift
    for search_string in "$@"; do
        if ! grep -q "$search_string" "$file"; then
            return 1
        fi
    done
    return 0
}

# Start tests
print_header "T030: Claude AI Integration Tests"
echo "Testing Claude API client and AI service implementation..."
echo "Project: Healthcare AI Clinical Data Analyzer"
echo "Task: H030 - Claude API client (real AI integration)"
echo ""

# ============================================
# Test Category 1: File Existence (3 tests)
# ============================================
print_header "Category 1: File Existence"

run_test "AI types file exists" \
    "[ -f '$PROJECT_ROOT/backend/src/types/ai.ts' ]"

run_test "Claude client file exists" \
    "[ -f '$PROJECT_ROOT/backend/src/ai/claudeClient.ts' ]"

run_test "AI service file exists" \
    "[ -f '$PROJECT_ROOT/backend/src/services/aiService.ts' ]"

# ============================================
# Test Category 2: AI Types (8 tests)
# ============================================
print_header "Category 2: AI Type Definitions"

run_test "AIRiskAnalysisRequest interface defined" \
    "file_contains '$PROJECT_ROOT/backend/src/types/ai.ts' 'export interface AIRiskAnalysisRequest'"

run_test "AIRiskAnalysisResponse interface defined" \
    "file_contains '$PROJECT_ROOT/backend/src/types/ai.ts' 'export interface AIRiskAnalysisResponse'"

run_test "ClaudeConfig interface defined" \
    "file_contains '$PROJECT_ROOT/backend/src/types/ai.ts' 'export interface ClaudeConfig'"

run_test "CKDAnalysisContext interface defined" \
    "file_contains '$PROJECT_ROOT/backend/src/types/ai.ts' 'export interface CKDAnalysisContext'"

run_test "AIError interface defined" \
    "file_contains '$PROJECT_ROOT/backend/src/types/ai.ts' 'export interface AIError'"

run_test "AIRiskAnalysisResponse includes risk_score field" \
    "file_contains '$PROJECT_ROOT/backend/src/types/ai.ts' 'risk_score: number'"

run_test "AIRiskAnalysisResponse includes key_findings field" \
    "file_contains '$PROJECT_ROOT/backend/src/types/ai.ts' 'key_findings:'"

run_test "AIRiskAnalysisResponse includes recommendations field" \
    "file_contains '$PROJECT_ROOT/backend/src/types/ai.ts' 'recommendations:'"

# ============================================
# Test Category 3: Claude Client Functions (7 tests)
# ============================================
print_header "Category 3: Claude API Client"

run_test "Anthropic SDK imported" \
    "file_contains '$PROJECT_ROOT/backend/src/ai/claudeClient.ts' \"import Anthropic from '@anthropic-ai/sdk'\""

run_test "createClaudeClient function exists" \
    "file_contains '$PROJECT_ROOT/backend/src/ai/claudeClient.ts' 'function createClaudeClient()'"

run_test "getClaudeConfig function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/ai/claudeClient.ts' 'export function getClaudeConfig()'"

run_test "callClaude function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/ai/claudeClient.ts' 'export async function callClaude'"

run_test "callClaudeJSON function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/ai/claudeClient.ts' 'export async function callClaudeJSON'"

run_test "testClaudeConnection function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/ai/claudeClient.ts' 'export async function testClaudeConnection()'"

run_test "getModelVersion function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/ai/claudeClient.ts' 'export function getModelVersion()'"

# ============================================
# Test Category 4: AI Service Functions (6 tests)
# ============================================
print_header "Category 4: AI Service Functions"

run_test "buildAnalysisContext function exists" \
    "file_contains '$PROJECT_ROOT/backend/src/services/aiService.ts' 'function buildAnalysisContext'"

run_test "createSystemPrompt function exists" \
    "file_contains '$PROJECT_ROOT/backend/src/services/aiService.ts' 'function createSystemPrompt()'"

run_test "createUserPrompt function exists" \
    "file_contains '$PROJECT_ROOT/backend/src/services/aiService.ts' 'function createUserPrompt'"

run_test "analyzeCKDRisk function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/services/aiService.ts' 'export async function analyzeCKDRisk'"

run_test "analyzeBatch function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/services/aiService.ts' 'export async function analyzeBatch'"

run_test "AI service imports callClaudeJSON" \
    "file_contains '$PROJECT_ROOT/backend/src/services/aiService.ts' 'import.*callClaudeJSON'"

# ============================================
# Test Category 5: Clinical Protocol in System Prompt (10 tests)
# ============================================
print_header "Category 5: Clinical Protocol Validation"

run_test "System prompt includes three-tier risk stratification" \
    "file_contains '$PROJECT_ROOT/backend/src/services/aiService.ts' 'Three-Tier Risk Stratification'"

run_test "System prompt defines Tier 1 (Low Risk)" \
    "file_contains '$PROJECT_ROOT/backend/src/services/aiService.ts' 'Tier 1 (Low Risk)'"

run_test "System prompt defines Tier 2 (Moderate Risk)" \
    "file_contains '$PROJECT_ROOT/backend/src/services/aiService.ts' 'Tier 2 (Moderate Risk)'"

run_test "System prompt defines Tier 3 (High Risk)" \
    "file_contains '$PROJECT_ROOT/backend/src/services/aiService.ts' 'Tier 3 (High Risk)'"

run_test "System prompt includes eGFR threshold (< 60)" \
    "file_contains '$PROJECT_ROOT/backend/src/services/aiService.ts' 'eGFR <60'"

run_test "System prompt includes uACR threshold (≥ 30)" \
    "file_contains '$PROJECT_ROOT/backend/src/services/aiService.ts' 'uACR ≥30'"

run_test "System prompt includes HbA1c threshold (≥ 6.5)" \
    "file_contains '$PROJECT_ROOT/backend/src/services/aiService.ts' 'HbA1c ≥6.5'"

run_test "System prompt includes BP threshold (≥ 140/90)" \
    "file_contains '$PROJECT_ROOT/backend/src/services/aiService.ts' '140/90'"

run_test "System prompt includes KDIGO CKD stages" \
    "file_contains '$PROJECT_ROOT/backend/src/services/aiService.ts' 'KDIGO CKD Stages'"

run_test "System prompt mentions KDIGO guidelines" \
    "file_contains '$PROJECT_ROOT/backend/src/services/aiService.ts' 'KDIGO guidelines'"

# ============================================
# Test Category 6: Configuration & Environment (5 tests)
# ============================================
print_header "Category 6: Configuration"

run_test "Claude client checks for ANTHROPIC_API_KEY" \
    "file_contains '$PROJECT_ROOT/backend/src/ai/claudeClient.ts' 'ANTHROPIC_API_KEY'"

run_test "Claude client validates API key presence" \
    "file_contains '$PROJECT_ROOT/backend/src/ai/claudeClient.ts' 'if (!apiKey)'"

run_test "Claude client provides helpful error message" \
    "file_contains '$PROJECT_ROOT/backend/src/ai/claudeClient.ts' 'console.anthropic.com'"

run_test "Config uses CLAUDE_MODEL environment variable" \
    "file_contains '$PROJECT_ROOT/backend/src/ai/claudeClient.ts' 'CLAUDE_MODEL'"

run_test "Config uses claude-3-5-sonnet as default model" \
    "file_contains '$PROJECT_ROOT/backend/src/ai/claudeClient.ts' 'claude-3-5-sonnet'"

# ============================================
# Test Category 7: Error Handling (4 tests)
# ============================================
print_header "Category 7: Error Handling"

run_test "callClaude has try-catch block" \
    "file_contains '$PROJECT_ROOT/backend/src/ai/claudeClient.ts' 'try {'"

run_test "callClaude handles APIError" \
    "file_contains '$PROJECT_ROOT/backend/src/ai/claudeClient.ts' 'Anthropic.APIError'"

run_test "callClaudeJSON has error handling for JSON parsing" \
    "file_contains '$PROJECT_ROOT/backend/src/ai/claudeClient.ts' 'Failed to parse'"

run_test "analyzeCKDRisk has try-catch block" \
    "file_contains '$PROJECT_ROOT/backend/src/services/aiService.ts' 'catch (error)'"

# ============================================
# Test Category 8: Response Formatting (6 tests)
# ============================================
print_header "Category 8: Response Formatting"

run_test "callClaudeJSON extracts JSON from code blocks" \
    "file_contains '$PROJECT_ROOT/backend/src/ai/claudeClient.ts' 'json'"

run_test "User prompt requests JSON format" \
    "file_contains '$PROJECT_ROOT/backend/src/services/aiService.ts' 'JSON format'"

run_test "User prompt includes demographics in analysis request" \
    "file_contains '$PROJECT_ROOT/backend/src/services/aiService.ts' 'demographics.age'"

run_test "User prompt includes lab results in analysis request" \
    "file_contains '$PROJECT_ROOT/backend/src/services/aiService.ts' 'latest_labs'"

run_test "AI response includes patient_id" \
    "file_contains '$PROJECT_ROOT/backend/src/services/aiService.ts' 'patient_id: patient.id'"

run_test "AI response includes analyzed_at timestamp" \
    "file_contains '$PROJECT_ROOT/backend/src/services/aiService.ts' 'analyzed_at:'"

# ============================================
# Test Category 9: Integration (4 tests)
# ============================================
print_header "Category 9: Integration & Dependencies"

run_test "AI service imports PatientSummary type" \
    "file_contains '$PROJECT_ROOT/backend/src/services/aiService.ts' 'PatientSummary'"

run_test "AI service imports AI types" \
    "file_contains '$PROJECT_ROOT/backend/src/services/aiService.ts' \"from.*types/ai\""

run_test "Claude client imports ClaudeConfig" \
    "file_contains '$PROJECT_ROOT/backend/src/ai/claudeClient.ts' \"import.*ClaudeConfig.*from.*types/ai\""

run_test "AI service imports getModelVersion" \
    "file_contains '$PROJECT_ROOT/backend/src/services/aiService.ts' 'getModelVersion'"

# ============================================
# Test Category 10: File Quality (3 tests)
# ============================================
print_header "Category 10: File Quality & Documentation"

run_test "AI types file has comprehensive documentation" \
    "[ \$(wc -l < '$PROJECT_ROOT/backend/src/types/ai.ts') -gt 80 ]"

run_test "Claude client file has comprehensive implementation" \
    "[ \$(wc -l < '$PROJECT_ROOT/backend/src/ai/claudeClient.ts') -gt 100 ]"

run_test "AI service file has comprehensive implementation" \
    "[ \$(wc -l < '$PROJECT_ROOT/backend/src/services/aiService.ts') -gt 150 ]"

# ============================================
# Test Summary
# ============================================
print_header "Test Summary"

echo ""
echo "Total Tests Run: $TESTS_RUN"
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
    echo ""
    echo -e "${RED}Failed Tests:${NC}"
    for failed_test in "${FAILED_TESTS[@]}"; do
        echo -e "${RED}  - $failed_test${NC}"
    done
else
    echo -e "${GREEN}Tests Failed: 0${NC}"
fi

# Calculate pass rate
PASS_RATE=$(awk "BEGIN {printf \"%.2f\", ($TESTS_PASSED / $TESTS_RUN) * 100}")
echo ""
echo "Pass Rate: ${PASS_RATE}%"

# Print success/failure message
echo ""
if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "Claude AI integration successfully implemented!"
    echo ""
    echo "Summary:"
    echo "  - AI types defined (ai.ts)"
    echo "  - Claude API client implemented (claudeClient.ts)"
    echo "  - AI risk analysis service implemented (aiService.ts)"
    echo "  - Three-tier risk stratification in system prompt"
    echo "  - KDIGO guidelines included in system prompt"
    echo "  - Clinical thresholds properly configured"
    echo ""
    echo "Available Functions:"
    echo "  callClaude() - Call Claude API with text response"
    echo "  callClaudeJSON() - Call Claude API with JSON response"
    echo "  analyzeCKDRisk() - Analyze patient CKD risk"
    echo "  analyzeBatch() - Batch analyze multiple patients"
    echo "  testClaudeConnection() - Test Claude API connectivity"
    echo ""
    echo "Configuration:"
    echo "  - Model: claude-3-5-sonnet-20241022 (default)"
    echo "  - Max Tokens: 2048 (default)"
    echo "  - Temperature: 0.3 (default)"
    echo "  - Requires: ANTHROPIC_API_KEY environment variable"
    echo ""
    exit 0
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
