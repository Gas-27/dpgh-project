// Domain configuration for DataStore Shop
export const DOMAINS = {
  // Main agent store domain
  AGENT_STORE: "datastores.shop",
  
  // Subagent store domain
  SUBAGENT_STORE: "agentsstore.shop",
  
  // Sanitize store name for URL - removes special characters, trims spaces, handles edge cases
  sanitizeStoreName: (storeName: string): string => {
    return storeName
      .toLowerCase()
      .trim()                           // Remove leading/trailing spaces
      .replace(/'/g, "")                // Remove apostrophes (store'name -> storename)
      .replace(/\./g, "")               // Remove periods (store.name -> storename)
      .replace(/[^a-z0-9\s-]/g, "")     // Remove all other special characters
      .replace(/\s+/g, "-")             // Replace spaces with hyphens
      .replace(/-+/g, "-")              // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, "");         // Remove leading/trailing hyphens
  },
  
  // Get full agent store URL (subdomain)
  getAgentStoreUrl: (storeName: string) => {
    const slug = DOMAINS.sanitizeStoreName(storeName);
    return `https://${slug}.${DOMAINS.AGENT_STORE}`;
  },
  
  // Get subagent store URL (path-based)
  getSubagentStoreUrl: (storeName: string) => {
    const slug = DOMAINS.sanitizeStoreName(storeName);
    return `https://${DOMAINS.SUBAGENT_STORE}/${slug}`;
  },
  
  // Get subagent dashboard URL
  getSubagentDashboardUrl: () => {
    return `https://${DOMAINS.SUBAGENT_STORE}/dashboard`;
  },
};
