#!/usr/bin/env bash
# Publishes preview check screenshots (EDGE-226) to the preview-checks-assets
# branch so PR comments can embed them from raw.githubusercontent.com.
#
# The branch is always one squashed commit holding the newest KEEP_RUNS run
# folders and the visual baseline (EDGE-228), so it never builds up history.
# It carries edgeways/vercel.json with deployments off, because Vercel builds
# every pushed branch.
#
# MODE=preview (default) adds runs/<run id>/ with the screenshots and any
# diff-*.png side by sides. MODE=baseline replaces baseline/ with
# $RESULTS_DIR/baseline (written by visual.ts manifest). Each mode keeps the
# other's folders.
#
# Run from the repo checkout (actions/checkout leaves push credentials).
# Env: MODE, RESULTS_DIR, GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT,
# GITHUB_OUTPUT. Writes asset_base_url to GITHUB_OUTPUT.
set -euo pipefail

BRANCH="preview-checks-assets"
MODE="${MODE:-preview}"
KEEP_RUNS="${KEEP_RUNS:-40}"
SRC="$(cd "${RESULTS_DIR:?}" && pwd)"

shopt -s nullglob
if [ "$MODE" = "baseline" ]; then
  DEST="baseline"
  shots=("$SRC"/baseline/*.png)
  if [ ! -f "$SRC/baseline/baseline.json" ] || [ ${#shots[@]} -eq 0 ]; then
    echo "::warning::No baseline to publish, every baseline journey failed"
    exit 0
  fi
else
  DEST="runs/${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT:-1}"
  shots=("$SRC"/*.png)
  if [ ${#shots[@]} -eq 0 ]; then
    echo "No screenshots to publish"
    exit 0
  fi
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

  rm -rf "${work:?}/$DEST"
  mkdir -p "$work/$DEST" "$work/runs" "$work/edgeways"
  if [ "$MODE" = "baseline" ]; then
    cp "${shots[@]}" "$SRC/baseline/baseline.json" "$work/$DEST/"
  else
    cp "${shots[@]}" "$work/$DEST/"
  fi
  printf '{\n  "git": { "deploymentEnabled": false }\n}\n' > "$work/edgeways/vercel.json"
  printf '# Preview check screenshots\n\nWritten by the Preview checks workflow (EDGE-226, EDGE-228). `runs/` holds preview screenshots, `baseline/` the visual baseline from main'"'"'s production deploy. Force-pushed as one commit on every run, do not branch from it.\n' > "$work/README.md"
  ls -1 "$work/runs" | sort -t- -k1,1n -k2,2n \
    | awk -v keep="$KEEP_RUNS" '{ a[NR] = $0 } END { for (i = 1; i <= NR - keep; i++) print a[i] }' \
    | while read -r old; do rm -rf "${work:?}/runs/$old"; done

  local status=0
  (
    cd "$work" &&
      git checkout --quiet --orphan "assets-${GITHUB_RUN_ID}" &&
      git add -A &&
      git commit --quiet -m "Preview checks ${MODE}, run ${GITHUB_RUN_ID}" &&
      git push --quiet --force-with-lease="$lease" origin "HEAD:refs/heads/${BRANCH}"
  ) || status=$?
  git worktree remove --force "$work"
  git branch -D --quiet "assets-${GITHUB_RUN_ID}" 2>/dev/null || true
  return $status
}

for attempt in 1 2 3; do
  if publish; then
    echo "asset_base_url=https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/${BRANCH}/${DEST}" >> "$GITHUB_OUTPUT"
    echo "Published ${#shots[@]} images to ${BRANCH}/${DEST}"
    exit 0
  fi
  echo "Push raced another run, retrying (${attempt})"
  sleep $((attempt * 3))
done
echo "::warning::Could not publish ${MODE} images, the PR comment will point at the artefact"
