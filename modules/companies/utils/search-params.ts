export function buildCompaniesHref(
  current: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>
): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...overrides };

  Object.entries(merged).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  const query = params.toString();
  return query ? `/companies?${query}` : "/companies";
}
