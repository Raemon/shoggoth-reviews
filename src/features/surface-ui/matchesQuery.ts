export function matchesQuery(text: string, query: string): boolean {
  const wanted = query.trim().toLowerCase();
  return wanted === '' || text.toLowerCase().includes(wanted);
}
