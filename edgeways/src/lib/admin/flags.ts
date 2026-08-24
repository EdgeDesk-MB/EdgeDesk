import "server-only";

export type PosthogFlag = {
  id: number;
  key: string;
  name: string;
  active: boolean;
};

export type FlagsOverview = {
  configured: boolean;
  host: string;
  projectUrl: string;
  projectHomeUrl: string;
  vercelUrl: string;
  currentDeployUrl: string;
  flags: PosthogFlag[];
  message?: string;
};

function posthogHost(): string {
  return (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.posthog.com").replace(
    /\/$/,
    ""
  );
}

function currentDeployUrl(): string {
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) {
    return production.startsWith("http") ? production : `https://${production}`;
  }
  const deployment = process.env.VERCEL_URL?.trim();
  if (deployment) {
    return deployment.startsWith("http") ? deployment : `https://${deployment}`;
  }
  return "https://vercel.com/dashboard";
}

export function loadFlagsLinks(): Pick<
  FlagsOverview,
  "host" | "projectUrl" | "projectHomeUrl" | "vercelUrl" | "currentDeployUrl"
> {
  const host = posthogHost();
  const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
  return {
    host,
    projectUrl: projectId
      ? `${host}/project/${projectId}/feature_flags`
      : `${host}/project`,
    projectHomeUrl: projectId ? `${host}/project/${projectId}` : host,
    vercelUrl: "https://vercel.com/dashboard",
    currentDeployUrl: currentDeployUrl(),
  };
}

export async function loadFlagsOverview(): Promise<FlagsOverview> {
  const links = loadFlagsLinks();
  const token = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
  const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
  if (!token || !projectId) {
    return {
      configured: false,
      ...links,
      flags: [],
      message:
        "Set POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID to list and toggle flags here. Until then, use PostHog.",
    };
  }

  try {
    const res = await fetch(
      `${links.host}/api/projects/${projectId}/feature_flags/`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      return {
        configured: false,
        ...links,
        flags: [],
        message: `PostHog returned ${res.status}. Check the personal API key.`,
      };
    }
    const body = (await res.json()) as {
      results?: Array<{ id: number; key: string; name: string; active: boolean }>;
    };
    return {
      configured: true,
      ...links,
      flags: (body.results ?? []).map((flag) => ({
        id: flag.id,
        key: flag.key,
        name: flag.name || flag.key,
        active: Boolean(flag.active),
      })),
    };
  } catch (error) {
    return {
      configured: false,
      ...links,
      flags: [],
      message: error instanceof Error ? error.message : "Could not reach PostHog.",
    };
  }
}

export async function setPosthogFlagActive(
  id: number,
  active: boolean
): Promise<{ ok: boolean; message: string }> {
  const token = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
  const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
  const host = posthogHost();
  if (!token || !projectId) {
    return { ok: false, message: "PostHog API key is not configured." };
  }
  try {
    const res = await fetch(`${host}/api/projects/${projectId}/feature_flags/${id}/`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ active }),
    });
    if (!res.ok) {
      return { ok: false, message: `PostHog returned ${res.status}.` };
    }
    return { ok: true, message: active ? "Flag is on." : "Flag is off." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not reach PostHog.",
    };
  }
}
