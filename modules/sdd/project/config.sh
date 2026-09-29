PROJECT_PATH="{{PROJECT_PATH}}"

BASE_BRANCH="{{BASE_BRANCH}}"

INSTALL_COMMAND=""
TEST_COMMAND=""
TEST_MODULE_COMMAND=""
LINT_COMMAND=""
E2E_COMMAND=""
RUN_COMMAND=""

MODULE_GLOBS=("src/*")

IGNORE_PATHS=("docs/" ".github/" "README.md" "CHANGELOG.md")

SHARED_PATHS=("package.json" "package-lock.json" "pnpm-lock.yaml" "yarn.lock" "tsconfig.json" "Dockerfile")

SCOPE_MODE="strict"

FORBIDDEN_PATHS=("deploy/")

MAX_AGENT_CALLS_PER_RUN=150

COMMAND_TIMEOUT_SECONDS=900

VAGUE_WORDS=("nhanh" "hợp lý" "thân thiện" "dễ dùng" "phù hợp" "tối ưu" "mượt" "đẹp" "ổn định" "v.v")
