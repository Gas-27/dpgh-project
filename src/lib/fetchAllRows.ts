const PAGE_SIZE = 1000;

// PostgREST caps a single response at 1,000 rows, so large catalogs must be read in ranges.
export async function fetchAllRows<T = any>(buildQuery: () => any): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = Array.isArray(data) ? data : [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}
