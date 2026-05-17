// Domain configuration for DataStore Shop
export const DOMAINS = {
  // Main agent store domain
  AGENT_STORE: "datastores.shop",
  
  // Subagent store domain
  SUBAGENT_STORE: "agentsstore.shop",
  
  // Get full agent store URL
  getAgentStoreUrl: (storeName: string) => {
    const slug = storeName.toLowerCase().replace(/\s+/g, "-");
    return `https://${slug}.${DOMAINS.AGENT_STORE}`;
  },
  
  // Get subagent dashboard URL
  getSubagentDashboardUrl: () => {
    return `https://${DOMAINS.SUBAGENT_STORE}/subagent-dashboard`;
  },
};
