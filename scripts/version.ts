/** Build id shown on /version.txt. Uses the git SHA in CI, "dev" locally. */
export function resolveVersion(env: Record<string, string | undefined>): string {
  const sha = env.GITHUB_SHA?.trim();
  return sha ? sha : 'dev';
}
