export type PageParams = Record<string, string | string[] | undefined>;

export function paramList(params: PageParams, name: string): string[] {
  const value = params[name];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export function paramValue(params: PageParams, name: string): string | null {
  return paramList(params, name)[0] ?? null;
}
