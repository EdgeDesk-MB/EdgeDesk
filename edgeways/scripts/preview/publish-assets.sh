#!/usr/bin/env bash
# Publishes preview check screenshots (EDGE-226) to the preview-checks-assets
# branch so PR comments can embed them from raw.githubusercontent.com.
#
# The branch is always one squashed commit holding the newest KEEP_RUNS run
# folders, so it never builds up history. It carries edgeways/vercel.json
# with deployments off, because Vercel builds every pushed branch.
#
# Run from the repo checkout (actions/checkout leaves push credentials).
# Env: RESULTS_DIR, GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT,
# GITHUB_OUTPUT. Writes asset_base_url to GITHUB_OUTPUT.
set -euo pipefail

BRANCH="preview-checks-assets"
KEEP_RUNS="${KEEP_RUNS:-40}"
RUN_DIR="runs/${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT:-1}"
SRC="$(cd "${RESULTS_DIR:?}" && pwd)"

shopt -s nullglob
shots=("$SRC"/*.png)
if [ ${#shots[@]} -eq 0 ]; then
  echo "No screenshots to publish"
  exit 0
fi

git config --global user.name "github-actions[bot]"
git config --global user.email "41898282+github-actions[bot]@users.noreply.github.com"

publish() {
  local work lease
  work="$(mktemp -d)"
  if git fetch --quiet --depth=1 origin "refs/heads/${BRANCH}" 2>/dev/null; then
    lease="${BRANCH}:$(git rev-parse FETCH_HEAD)"
    git worktree add --quiet --detach "$work" FETCH_HEAD
  else
    lease="${BRANCH}:"
    git worktree add --quiet --detach "$work" HEAD
    git -C "$work" rm -rq --cached .
    find "$work" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
  fi

  mkdir -p "$work/$RUN_DIR" "$work/edgeways"
  cp "${shots[@]}" "$work/$RUN_DIR/"
  printf '{\n  "git": { "deploymentEnabled": false }\n}\n' > "$work/edgeways/vercel.json"
  printf '# Preview check screenshots\n\nWritten by the Preview checks workflow (EDGE-226). Force-pushed as one commit on every run, do not branch from it.\n' > "$work/README.md"
  ls -1 "$work/runs" | sort -t- -k1,1n -k2,2n \
    | awk -v keep="$KEEP_RUNS" '{ a[NR] = $0 } END { for (i = 1; i <= NR - keep; i++) print a[i] }' \
    | while read -r old; do rm -rf "${work:?}/runs/$old"; done

  local status=0
  (
    cd "$work" &&
      git checkout --quiet --orphan "assets-${GITHUB_RUN_ID}" &&
      git add -A &&
      git commit --quiet -m "Preview check screenshots, run ${GITHUB_RUN_ID}" &&
      git push --quiet --force-with-lease="$lease" origin "HEAD:refs/heads/${BRANCH}"
  ) || status=$?
  git worktree remove --force "$work"
  git branch -D --quiet "assets-${GITHUB_RUN_ID}" 2>/dev/null || true
  return $status
}

for attempt in 1 2 3; do
  if publish; then
    echo "asset_base_url=https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/${BRANCH}/${RUN_DIR}" >> "$GITHUB_OUTPUT"
    echo "Published ${#shots[@]} screenshots to ${BRANCH}/${RUN_DIR}"
    exit 0
  fi
  echo "Push raced another run, retrying (${attempt})"
  sleep $((attempt * 3))
done
echo "::warning::Could not publish screenshots, the PR comment will point at the artefact"
