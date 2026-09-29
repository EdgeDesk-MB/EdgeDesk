/**
 * Posts preview check results (EDGE-226). Run by the Preview checks workflow
 * after journeys.ts and publish-assets.sh.
 *
 * - One PR comment, found by COMMENT_MARKER and edited in place.
 * - When LINEAR_API_KEY is set and the branch names a ticket (edge-123),
 *   one Linear comment starting with **Screenshots**, also edited in place.
 *   Images are uploaded to Linear so they outlive the assets branch.
 *   A Linear failure is a warning, it never fails the run.
 *
 * Env: GITHUB_TOKEN, GITHUB_REPOSITORY, SHA, RUN_URL, ASSET_BASE_URL,
 * BRANCH (fallback when there is no PR), RESULTS_DIR, LINEAR_API_KEY.
 */
import { appendFileSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  COMMENT_MARKER,
  DEFAULT_OUT_DIR,
  buildLinearComment,
  buildPrComment,
  isOwnLinearComment,
  pickPullRequest,
  ticketFromBranch,
  type RunResult,
} from "./lib";

type Pull = {
  number: number;
  state: string;
  html_url: string;
  head: { sha: string; ref: string };
};

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

async function github<T>(method: string, route: string, body?: unknown): Promise<T> {
  const res = await fetch(`https://api.github.com${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${required("GITHUB_TOKEN")}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`GitHub ${method} ${route}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function findPull(repo: string, sha: string): Promise<Pull | null> {
  const prs = await github<Pull[]>("GET", `/repos/${repo}/commits/${sha}/pulls`);
  return pickPullRequest(prs, sha);
}

async function upsertPrComment(repo: string, pr: number, body: string) {
  for (let page = 1; page <= 10; page++) {
    const comments = await github<{ id: number; body?: string }[]>(
      "GET",
      `/repos/${repo}/issues/${pr}/comments?per_page=100&page=${page}`,
    );
    const mine = comments.find((c) => c.body?.includes(COMMENT_MARKER));
    if (mine) {
      await github("PATCH", `/repos/${repo}/issues/comments/${mine.id}`, { body });
      return "updated";
    }
    if (comments.length < 100) break;
  }
  await github("POST", `/repos/${repo}/issues/${pr}/comments`, { body });
  return "created";
}

async function linear<T>(key: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { Authorization: key, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json().catch(() => null)) as { data?: T; errors?: { message: string }[] } | null;
  if (!res.ok || !json?.data || json.errors?.length) {
    const why = json?.errors?.map((e) => e.message).join("; ") ?? `HTTP ${res.status}`;
    throw new Error(`Linear: ${why}`);
  }
  return json.data;
}

async function uploadToLinear(key: string, filePath: string): Promise<string> {
  const size = statSync(filePath).size;
  const data = await linear<{
    fileUpload: {
      uploadFile: { uploadUrl: string; assetUrl: string; headers: { key: string; value: string }[] } | null;
    };
  }>(
    key,
    `mutation($contentType: String!, $filename: String!, $size: Int!) {
      fileUpload(contentType: $contentType, filename: $filename, size: $size) {
        uploadFile { uploadUrl assetUrl headers { key value } }
      }
    }`,
    { contentType: "image/png", filename: path.basename(filePath), size },
  );
  const upload = data.fileUpload.uploadFile;
  if (!upload) throw new Error("Linear: no upload URL returned");
  const headers: Record<string, string> = {
    "Content-Type": "image/png",
    "Cache-Control": "public, max-age=31536000",
  };
  for (const h of upload.headers) headers[h.key] = h.value;
  const put = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers,
    body: readFileSync(filePath),
  });
  if (!put.ok) throw new Error(`Linear upload: HTTP ${put.status}`);
  return upload.assetUrl;
}

async function upsertLinearComment(
  key: string,
  ticket: string,
  result: RunResult,
  ctx: { resultsDir: string; sha: string; runUrl: string; prUrl: string | null },
) {
  const found = await linear<{
    viewer: { id: string };
    issue: { id: string; comments: { nodes: { id: string; body: string; user: { id: string } | null }[] } } | null;
  }>(
    key,
    `query($id: String!) {
      viewer { id }
      issue(id: $id) { id comments(first: 100) { nodes { id body user { id } } } }
    }`,
    { id: ticket },
  );
  if (!found.issue) {
    console.log(`Linear: ${ticket} not found, skipped`);
    return;
  }

  const assets = new Map<string, string>();
  for (const j of result.journeys) {
    for (const s of j.shots) {
      assets.set(s.file, await uploadToLinear(key, path.join(ctx.resultsDir, s.file)));
    }
  }
  const body = buildLinearComment(result, {
    imageUrl: (f) => assets.get(f) ?? null,
    sha: ctx.sha,
    runUrl: ctx.runUrl,
    baseUrl: result.baseUrl,
    prUrl: ctx.prUrl,
  });

  const mine = found.issue.comments.nodes.find(
    (c) => c.user?.id === found.viewer.id && isOwnLinearComment(c.body),
  );
  if (mine) {
    await linear(key, `mutation($id: String!, $body: String!) { commentUpdate(id: $id, input: { body: $body }) { success } }`, {
      id: mine.id,
      body,
    });
    console.log(`Linear: updated the Screenshots comment on ${ticket}`);
  } else {
    await linear(
      key,
      `mutation($issueId: String!, $body: String!) { commentCreate(input: { issueId: $issueId, body: $body }) { success } }`,
      { issueId: found.issue.id, body },
    );
    console.log(`Linear: posted a Screenshots comment on ${ticket}`);
  }
}

async function main() {
  const repo = required("GITHUB_REPOSITORY");
  const sha = required("SHA");
  const runUrl = required("RUN_URL");
  const resultsDir = process.env.RESULTS_DIR || DEFAULT_OUT_DIR;
  const assetBase = process.env.ASSET_BASE_URL?.replace(/\/+$/, "") || null;
  const result = JSON.parse(readFileSync(path.join(resultsDir, "results.json"), "utf8")) as RunResult;

  const prBody = buildPrComment(result, {
    imageUrl: (f) => (assetBase ? `${assetBase}/${f}` : null),
    sha,
    runUrl,
    baseUrl: result.baseUrl,
  });
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${prBody}\n`);

  const pr = await findPull(repo, sha);
  if (pr) {
    const how = await upsertPrComment(repo, pr.number, prBody);
    console.log(`GitHub: ${how} the preview checks comment on PR #${pr.number}`);
  } else {
    console.log(`GitHub: no open PR for ${sha.slice(0, 7)}, no comment posted`);
  }

  const key = process.env.LINEAR_API_KEY;
  const ticket = ticketFromBranch(pr?.head.ref ?? process.env.BRANCH);
  if (!key) {
    console.log("Linear: LINEAR_API_KEY not set, skipped");
  } else if (!ticket) {
    console.log("Linear: branch names no EDGE ticket, skipped");
  } else {
    try {
      await upsertLinearComment(key, ticket, result, {
        resultsDir,
        sha,
        runUrl,
        prUrl: pr?.html_url ?? null,
      });
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err);
      console.log(`::warning::Linear comment not posted: ${why}`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
