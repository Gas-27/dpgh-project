/**
 * Datahubnet Mashup Package ID Mappings
 * These are the IDs that datahubnet provider recognizes for mashup packages
 * This mapping is used to ensure the correct data_package_id is sent to the fulfill-order API
 */

export const DATAHUBNET_MASHUP_IDS: Record<string, number> = {
  // Format: "size_gb_text" or "size_gb" -> datahubnet ID
  "1.7": 14, // 1.7GB MASHUP
  "3": 3, // 5.1GB MASHUP - Note: 5.1 rounds to 5
  "2.6": 16, // 2.6GB + 1,077 mins
  "8.2": 17, // 8.2GB MASHUP
  "11.9": 18, // 11.9GB MASHUP
  "3.61": 20, // 3.61GB + 1485 mins
  "15.3": 19, // 15.3GB MASHUP
  // Alternative text formats
  "2.6 GB + 1,077 mins": 16,
  "1077mins + 2.6GB": 16,
  "1077 mins + 2.6GB": 16,
  "3.61GB + 1485Mins": 20,
  "1485mins + 3.61GB": 20,
  "1485 mins + 3.61GB": 20,
};

/**
 * Get the datahubnet package ID for a mashup package
 * @param sizeGbText - The size_gb_text value from the package (e.g., "1.7GB")
 * @param sizeGb - Fallback: the size_gb numeric value
 * @param packageId - Fallback: the package's database ID
 * @returns The datahubnet ID, or undefined if not found
 */
export function getDatahubnetPackageId(
  sizeGbText?: string,
  sizeGb?: number,
  packageId?: string
): number | undefined {
  // Try matching by size_gb_text first
  if (sizeGbText) {
    const normalized = sizeGbText.toLowerCase();
    
    // Direct lookups for common patterns
    if (normalized.includes("1.7")) return DATAHUBNET_MASHUP_IDS["1.7"];
    if (normalized.includes("5.1")) return DATAHUBNET_MASHUP_IDS["3"]; // 5.1GB uses ID 3
    if (normalized.includes("2.6")) return DATAHUBNET_MASHUP_IDS["2.6"];
    if (normalized.includes("8.2")) return DATAHUBNET_MASHUP_IDS["8.2"];
    if (normalized.includes("11.9")) return DATAHUBNET_MASHUP_IDS["11.9"];
    if (normalized.includes("3.61")) return DATAHUBNET_MASHUP_IDS["3.61"];
    if (normalized.includes("15.3")) return DATAHUBNET_MASHUP_IDS["15.3"];
  }

  // Try matching by numeric size_gb
  if (sizeGb !== undefined) {
    const rounded = sizeGb.toFixed(1);
    for (const [key, value] of Object.entries(DATAHUBNET_MASHUP_IDS)) {
      if (key === rounded) return value;
    }
  }

  // If we have a packageId, log for debugging
  if (packageId) {
    console.warn("[v0] Could not find datahubnet ID for mashup package:", {
      packageId,
      sizeGbText,
      sizeGb,
    });
  }

  return undefined;
}
