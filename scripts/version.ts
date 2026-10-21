/**
 * Build id shown on /version.txt and /health. The git SHA in CI (GITHUB_SHA) or on Railway
 * (RAILWAY_GIT_COMMIT_SHA), "dev" locally.
 */
export function resolveVersion(env: Record<string, string | undefined>): string {
  const sha = env.GITHUB_SHA?.trim() || env.RAILWAY_GIT_COMMIT_SHA?.trim();
  return sha ? sha : 'dev';
}
