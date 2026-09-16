// supabase/functions/ussd-handler/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYSTACK_FEE_PERCENT = 1.98;
const PACKAGES_PER_PAGE = 5;

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/^\+/, "").trim();
  if (cleaned.startsWith("0")) cleaned = cleaned.substring(1);
  if (cleaned.startsWith("233")) cleaned = cleaned.substring(3);
  return "0" + cleaned;
}

function getNetworkFromProviderCode(providerCode: string): string {
  switch (providerCode) {
    case "01": return "mtn";
    case "02": return "telecel";
    case "04": return "airteltigo";
    default: return "unknown";
  }
}

function getNetworkDisplayName(network: string): string {
  if (network === "mtn") return "MTN";
  if (network === "telecel") return "Telecel";
  if (network === "airteltigo") return "AirtelTigo";
  if (network === "mtn_express") return "MTN Express";
  return "Unknown";
}

function getProviderCode(network: string): string {
  if (network === "telecel") return "vod";
  if (network === "airteltigo") return "tgo";
  return "mtn";
}

function getApprovalInstructions(network: string): string {
  if (network === "telecel") return "Dail *110# > My Wallet > Approvals";
  if (network === "airteltigo") return "Dail *500# > My Approvals";
  return "Dail *170# > Wallet > My Approvals";
}

function formatOrderTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    return `${day}/${month} ${hours}:${mins}`;
  } catch { return ""; }
}

function formatPhoneForPaystack(phone: string): string {
  const formatted = formatPhoneNumber(phone);
  return formatted.startsWith("0") ? formatted : "0" + formatted;
}

function isExpressPackage(network: string): boolean {
  return network === "mtn_express";
}

function getStatusDisplay(status: string): string {
  switch (status) {
    case "delivered":
    case "completed":
      return "Delivered";
    case "processing":
    case "pending":
      return "Processing";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Processing";
  }
}

// Validate that a phone number belongs to the correct network
function getPhoneNetwork(phone: string): string | null {
  const prefix3 = phone.substring(0, 3);
  const mtnPrefixes = ["024", "054", "025", "055", "059", "053"];
  const telecelPrefixes = ["020", "050"];
  const airteltigoPrefixes = ["026", "056", "027", "057"];

  if (mtnPrefixes.includes(prefix3)) return "mtn";
  if (telecelPrefixes.includes(prefix3)) return "telecel";
  if (airteltigoPrefixes.includes(prefix3)) return "airteltigo";
  return null;
}

function networkMatchesPackage(phone: string, packageNetwork: string): boolean {
  const phoneNetwork = getPhoneNetwork(phone);
  if (!phoneNetwork) return true; // Unknown prefix — allow through
  if ((packageNetwork === "mtn" || packageNetwork === "mtn_express") && phoneNetwork !== "mtn") return false;
  if (packageNetwork === "telecel" && phoneNetwork !== "telecel") return false;
  if (packageNetwork === "airteltigo" && phoneNetwork !== "airteltigo") return false;
  return true;
}

async function storePaystackTransaction(supabase: any, sessionID: string, reference: string, amount: number, metadata: any) {
  await supabase.from("ussd_paystack_transactions").upsert({
    session_id: sessionID,
    reference: reference,
    amount: amount,
    metadata: metadata,
    status: "pending_otp",
    created_at: new Date().toISOString()
  });
}

async function updateTransactionStatus(supabase: any, reference: string, status: string, otpCode?: string) {
  await supabase
    .from("ussd_paystack_transactions")
    .update({ status: status, otp_code: otpCode, updated_at: new Date().toISOString() })
    .eq("reference", reference);
}

Deno.serve(async (req) => {
  console.log(`[USSD] ========== NEW REQUEST ==========`);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let sessionID = "";
    let ussdServiceOp = "";
    let ussdString = "";
    let msisdn = "";
    let networkCode = "";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      console.log(`[USSD] Request body:`, JSON.stringify(body));
      sessionID = body.sessionID || "";
      ussdServiceOp = String(body.ussdServiceOp || "");
      ussdString = body.ussdString || "";
      msisdn = body.msisdn || "";
      networkCode = body.network || "";
    } else {
      const formData = await req.formData();
      sessionID = formData.get("sessionID") as string || "";
      ussdServiceOp = formData.get("ussdServiceOp") as string || "";
      ussdString = (formData.get("ussdString") as string) || "";
      msisdn = formData.get("msisdn") as string || "";
      networkCode = formData.get("network") as string || "";
    }

    msisdn = formatPhoneNumber(msisdn);
    const detectedNetwork = getNetworkFromProviderCode(networkCode);

    console.log(`[USSD] Session: ${sessionID}, Op: ${ussdServiceOp}, Input: ${ussdString}, Phone: ${msisdn}, NetworkCode: ${networkCode}, Network: ${detectedNetwork}`);

    if (!sessionID) {
      return sendResponse("", "Technical error. Please try again.", "3", corsHeaders);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let msg = "";
    let responseOp = "3";

    // START SESSION
    if (ussdServiceOp === "1") {
      console.log(`[USSD] Starting new session`);
      await supabase.from("ussd_sessions").upsert({
        session_id: sessionID,
        data: {
          step: "enter_access_code",
          created_at: Date.now(),
          caller_msisdn: msisdn,
          caller_network: detectedNetwork,
        },
        updated_at: new Date().toISOString()
      });
      msg = "Welcome\nEnter access code:";
      responseOp = "2";
    }
    // CONTINUE SESSION
    else if (ussdServiceOp === "18") {
      const { data: sessionData } = await supabase
        .from("ussd_sessions")
        .select("data")
        .eq("session_id", sessionID)
        .maybeSingle();

      if (!sessionData) {
        msg = "Session expired. Please dial again.";
        responseOp = "3";
      } else {
        const session = sessionData.data;
        console.log(`[USSD] Step: ${session.step}`);

        const updateSession = async (newData: any) => {
          await supabase.from("ussd_sessions").upsert({
            session_id: sessionID,
            data: { ...session, ...newData, updated_at: Date.now() },
            updated_at: new Date().toISOString()
          });
        };

        const deleteSession = async () => {
          await supabase.from("ussd_sessions").delete().eq("session_id", sessionID);
        };

        const buildNetworkMenu = (storeName: string | null, isDefaultUser: boolean, supportContact: string | null): string => {
          let menu = "";
          if (storeName) {
            menu = `Welcome to ${storeName}\n\n`;
          } else if (isDefaultUser) {
            menu = "Welcome to DataPlug.Store\n\n";
          }
          menu += "Select network:\n1. MTN\n2. Telecel\n3. AT\n4. Track Order\n5. Support\n0. Back";
          if (supportContact) menu += `\n\nSupport: ${supportContact}`;
          return menu;
        };

        // STEP 1: Enter access code
        if (session.step === "enter_access_code") {
          const accessCode = ussdString.trim().toUpperCase();
          console.log(`[USSD] Access code entered: "${accessCode}"`);

          let agentStoreId: string | null = null;
          let subagentStoreId: string | null = null;
          let subSubagentStoreId: string | null = null;
          let supportContact: string | null = null;
          let storeName: string | null = null;
          let isDefaultUser = false;

          if (accessCode === ".") {
            console.log(`[USSD] Access code 0 entered - using default user pricing`);
            isDefaultUser = true;
          } else {
            console.log(`[USSD] Checking for store with topup_reference: "${accessCode}"`);

            const { data: agent, error: agentError } = await supabase
              .from("agent_stores")
              .select("id, support_number, store_name")
              .eq("topup_reference", accessCode)
              .eq("approved", true)
              .maybeSingle();

            if (agentError) console.log(`[USSD] Agent query error:`, agentError);

            if (agent) {
              agentStoreId = agent.id;
              supportContact = agent.support_number;
              storeName = agent.store_name;
              console.log(`[USSD] Found agent store: ${agentStoreId}, store_name: ${storeName}`);
            } else {
              const { data: subagent, error: subagentError } = await supabase
                .from("subagent_stores")
                .select("id, agent_store_id, support_number, store_name")
                .eq("topup_reference", accessCode)
                .eq("approved", true)
                .maybeSingle();

              if (subagentError) console.log(`[USSD] Subagent query error:`, subagentError);

              if (subagent) {
                subagentStoreId = subagent.id;
                agentStoreId = subagent.agent_store_id;
                supportContact = subagent.support_number;
                storeName = subagent.store_name;
                console.log(`[USSD] Found subagent store: ${subagentStoreId}, parent agent: ${agentStoreId}, store_name: ${storeName}`);
              } else {
                const { data: subSubagent, error: subSubagentError } = await supabase
                  .from("sub_subagent_stores")
                  .select("id, subagent_store_id, agent_store_id, support_number, store_name, topup_reference")
                  .eq("topup_reference", accessCode)
                  .eq("approved", true)
                  .maybeSingle();

                if (subSubagentError) console.log(`[USSD] Sub-subagent query error:`, subSubagentError);

                if (subSubagent) {
                  subSubagentStoreId = subSubagent.id;
                  subagentStoreId = subSubagent.subagent_store_id;
                  agentStoreId = subSubagent.agent_store_id;
                  supportContact = subSubagent.support_number;
                  storeName = subSubagent.store_name;
                  console.log(`[USSD] Found sub-subagent store: ${subSubagentStoreId}, store_name: ${storeName}`);
                  console.log(`[USSD] Database topup_reference: "${subSubagent.topup_reference}", User entered: "${accessCode}"`);
                } else {
                  // Fallback: case-insensitive search for sub-subagent
                  const { data: subSubagentCI, error: caseError } = await supabase
                    .from("sub_subagent_stores")
                    .select("id, subagent_store_id, agent_store_id, support_number, store_name, topup_reference")
                    .ilike("topup_reference", accessCode)
                    .eq("approved", true)
                    .maybeSingle();

                  if (caseError) console.log(`[USSD] Case-insensitive query error:`, caseError);

                  if (subSubagentCI) {
                    subSubagentStoreId = subSubagentCI.id;
                    subagentStoreId = subSubagentCI.subagent_store_id;
                    agentStoreId = subSubagentCI.agent_store_id;
                    supportContact = subSubagentCI.support_number;
                    storeName = subSubagentCI.store_name;
                    console.log(`[USSD] Found sub-subagent via case-insensitive search! ID: ${subSubagentStoreId}`);
                  } else {
                    console.log(`[USSD] No store found for access code: "${accessCode}"`);
                    msg = "Invalid code.\nEnter a valid code:";
                    responseOp = "2";
                    await updateSession({ step: "enter_access_code" });
                    return sendResponse(sessionID, msg, responseOp, corsHeaders);
                  }
                }
              }
            }
          }

          await updateSession({
            step: "select_network",
            agent_store_id: agentStoreId,
            subagent_store_id: subagentStoreId,
            sub_subagent_store_id: subSubagentStoreId,
            support_contact: supportContact,
            store_name: storeName,
            is_default_user: isDefaultUser,
          });

          msg = buildNetworkMenu(storeName, isDefaultUser, supportContact);
          responseOp = "2";
        }
        // STEP 2: Select network
        else if (session.step === "select_network") {
          const networkMap: Record<string, string> = { "1": "mtn", "2": "telecel", "3": "airteltigo" };
          const selectedNetwork = networkMap[ussdString];

          if (ussdString === "0") {
            await updateSession({ step: "enter_access_code" });
            msg = "Enter access code:";
            responseOp = "2";
          } else if (ussdString === "5") {
            await updateSession({ step: "view_support" });
            msg = session.support_contact
              ? `Support Contact:\n${session.support_contact}\n\n0. Back`
              : "No support contact available.\n0. Back";
            responseOp = "2";
          } else if (ussdString === "4") {
            await updateSession({ step: "track_order_enter_phone" });
            msg = `Enter phone number for order\nor 0 to use your number (${msisdn}):`;
            responseOp = "2";
          } else if (!selectedNetwork) {
            msg = buildNetworkMenu(session.store_name, session.is_default_user, session.support_contact);
            responseOp = "2";
          } else {
            console.log(`[USSD] Fetching packages for network: ${selectedNetwork}`);

            // Include mtn_express alongside mtn when the caller picked MTN
            const networksToFetch = selectedNetwork === "mtn" ? ["mtn", "mtn_express"] : [selectedNetwork];

            const { data: allPackages, error: pkgError } = await supabase
              .from("data_packages")
              .select("*")
              .eq("active", true)
              .in("network", networksToFetch);

            console.log(`[USSD] Packages query result:`, allPackages?.length || 0, "packages found");
            if (pkgError) console.log(`[USSD] Package query error:`, pkgError);

            if (pkgError || !allPackages || allPackages.length === 0) {
              msg = "No packages available.\n0. Back";
              responseOp = "2";
            } else {
              let subSubagentPriceMap = new Map<string, number>();
              let subagentPriceMap = new Map<string, number>();
              let agentPriceMap = new Map<string, number>();

              if (session.sub_subagent_store_id) {
                // The sub-subagent's own customer-facing price lives in
                // `customer_sell_price`, filtered by their OWN id
                // (`sub_subagent_store_id` column). `sell_price` on this table
                // is what the PARENT subagent charges this sub-subagent (their
                // cost), not what they charge their own customers.
                const { data: p } = await supabase
                  .from("sub_subagent_package_prices")
                  .select("package_id, customer_sell_price")
                  .eq("sub_subagent_store_id", session.sub_subagent_store_id);
                if (p) {
                  p.forEach((x: any) => {
                    if (x.customer_sell_price !== null && x.customer_sell_price !== undefined) {
                      subSubagentPriceMap.set(x.package_id, Number(x.customer_sell_price));
                    }
                  });
                }
                console.log(`[USSD] Sub-subagent prices found: ${subSubagentPriceMap.size}`);
              }

              if (session.subagent_store_id) {
                const { data: p } = await supabase
                  .from("subagent_package_prices")
                  .select("package_id, sell_price")
                  .eq("subagent_store_id", session.subagent_store_id);
                if (p) p.forEach((x: any) => subagentPriceMap.set(x.package_id, Number(x.sell_price)));
                console.log(`[USSD] Subagent prices found: ${subagentPriceMap.size}`);
              }

              if (session.agent_store_id) {
                const { data: p } = await supabase
                  .from("agent_package_prices")
                  .select("package_id, sell_price")
                  .eq("agent_store_id", session.agent_store_id);
                if (p) p.forEach((x: any) => agentPriceMap.set(x.package_id, Number(x.sell_price)));
                console.log(`[USSD] Agent prices found: ${agentPriceMap.size}`);
              }

              const packages = allPackages.map((pkg: any) => {
                let price = Number(pkg.agent_price) || 0;

                if (session.is_default_user) {
                  if (pkg.user_price !== undefined && pkg.user_price !== null && Number(pkg.user_price) > 0) {
                    price = Number(pkg.user_price);
                  } else if (pkg.sale_price !== undefined && pkg.sale_price !== null && Number(pkg.sale_price) > 0) {
                    price = Number(pkg.sale_price);
                  } else {
                    price = Number(pkg.agent_price) || 0;
                  }
                } else {
                  if (session.sub_subagent_store_id && subSubagentPriceMap.has(pkg.id)) {
                    price = subSubagentPriceMap.get(pkg.id)!;
                  } else if (session.subagent_store_id && subagentPriceMap.has(pkg.id)) {
                    price = subagentPriceMap.get(pkg.id)!;
                  } else if (session.agent_store_id && agentPriceMap.has(pkg.id)) {
                    price = agentPriceMap.get(pkg.id)!;
                  } else {
                    price = Number(pkg.agent_price) || 0;
                  }
                }

                return {
                  id: pkg.id,
                  size_gb: pkg.size_gb,
                  price,
                  network: pkg.network,
                  is_express: isExpressPackage(pkg.network)
                };
              });

              const validPackages = packages.filter((p: any) => p.price > 0);
              console.log(`[USSD] Valid packages with price > 0: ${validPackages.length}`);

              if (validPackages.length === 0) {
                msg = "No packages with valid prices.\n0. Back";
                responseOp = "2";
              } else {
                validPackages.sort((a: any, b: any) => a.size_gb - b.size_gb);
                console.log(`[USSD] Final packages:`, validPackages.map((p: any) => `${p.size_gb}GB=GHS${p.price}`).join(", "));

                await updateSession({
                  step: "view_packages",
                  network: selectedNetwork,
                  packages: validPackages,
                  current_page: 0,
                });

                const totalPages = Math.ceil(validPackages.length / PACKAGES_PER_PAGE);
                const pagePackages = validPackages.slice(0, PACKAGES_PER_PAGE);

                let packageMenu = "Select package:\n";
                pagePackages.forEach((pkg: any, idx: number) => {
                  const label = pkg.is_express ? ` (express)` : "";
                  packageMenu += `${idx + 1}. ${pkg.size_gb}GB${label} - GHS ${pkg.price.toFixed(2)}\n`;
                });
                if (totalPages > 1) packageMenu += `\n6. Next`;
                packageMenu += "\n0. Back";

                msg = packageMenu;
                responseOp = "2";
              }
            }
          }
        }
        // VIEW SUPPORT CONTACT
        else if (session.step === "view_support") {
          if (ussdString === "0") {
            await updateSession({ step: "select_network" });
            msg = buildNetworkMenu(session.store_name, session.is_default_user, session.support_contact);
            responseOp = "2";
          } else {
            msg = "Invalid option.\n0. Back";
            responseOp = "2";
          }
        }
        // TRACK ORDER - Enter phone number
        else if (session.step === "track_order_enter_phone") {
          let phone = ussdString === "0" ? msisdn : ussdString.trim();
          if (phone !== "0" || ussdString === "0") phone = formatPhoneNumber(phone);

          if (!phone.match(/^0[2-9]\d{8}$/)) {
            msg = `Invalid number.\nEnter phone (e.g., 024XXXXXXX):\nor 0 to use your number (${msisdn}):`;
            responseOp = "2";
          } else {
            let supportContact = "";
            if (session.sub_subagent_store_id) {
              const { data: sss } = await supabase.from("sub_subagent_stores").select("support_number").eq("id", session.sub_subagent_store_id).single();
              if (sss?.support_number) supportContact = sss.support_number;
            } else if (session.subagent_store_id) {
              const { data: sub } = await supabase.from("subagent_stores").select("support_number").eq("id", session.subagent_store_id).single();
              if (sub?.support_number) supportContact = sub.support_number;
            } else if (session.agent_store_id) {
              const { data: ag } = await supabase.from("agent_stores").select("support_number").eq("id", session.agent_store_id).single();
              if (ag?.support_number) supportContact = ag.support_number;
            }

            const { data: orders } = await supabase
              .from("orders")
              .select("id, size_gb, network, fulfillment_status, created_at")
              .eq("customer_number", phone)
              .order("created_at", { ascending: false })
              .limit(2);

            if (!orders || orders.length === 0) {
              msg = `No orders for ${phone}.\n0. Back`;
              if (supportContact) msg += `\nSupport: ${supportContact}`;
              await updateSession({ step: "no_orders_found" });
              responseOp = "2";
            } else {
              let orderList = "Recent Orders:\n\n";
              orders.forEach((order: any, idx: number) => {
                let net = "";
                if (order.network === "mtn") net = "MTN";
                else if (order.network === "telecel") net = "Telecel";
                else if (order.network === "airteltigo") net = "AirtelTigo";
                else if (order.network === "mtn_express") net = "MTN Express";
                else net = "Unknown";
                const time = formatOrderTime(order.created_at);
                const statusLabel = getStatusDisplay(order.fulfillment_status);
                orderList += `${idx + 1}. ${order.size_gb}GB ${net}\nStatus: ${statusLabel}\nTime: ${time}\n\n`;
              });
              orderList += "0. Back";
              if (supportContact) orderList += `\nSupport: ${supportContact}`;
              await updateSession({ step: "view_orders" });
              msg = orderList;
              responseOp = "2";
            }
          }
        }
        // Back handlers
        else if (session.step === "no_orders_found" || session.step === "view_orders") {
          if (ussdString === "0") {
            await updateSession({ step: "select_network" });
            msg = buildNetworkMenu(session.store_name, session.is_default_user, session.support_contact);
            responseOp = "2";
          } else {
            msg = "Invalid option.\n0. Back";
            responseOp = "2";
          }
        }
        // STEP 3: View packages with pagination
        else if (session.step === "view_packages") {
          const selection = ussdString;
          const totalPages = Math.ceil(session.packages.length / PACKAGES_PER_PAGE);
          const currentPage = session.current_page || 0;

          if (selection === "6" && currentPage + 1 < totalPages) {
            const nextPage = currentPage + 1;
            const start = nextPage * PACKAGES_PER_PAGE;
            const pagePackages = session.packages.slice(start, start + PACKAGES_PER_PAGE);
            let packageMenu = "Select package:\n";
            pagePackages.forEach((pkg: any, idx: number) => {
              const label = pkg.is_express ? ` (express)` : "";
              packageMenu += `${idx + 1}. ${pkg.size_gb}GB${label} - GHS ${pkg.price.toFixed(2)}\n`;
            });
            packageMenu += "\n";
            if (currentPage > 0) packageMenu += "7. Prev\n";
            if (nextPage + 1 < totalPages) packageMenu += "6. Next\n";
            packageMenu += "0. Back";
            await updateSession({ current_page: nextPage });
            msg = packageMenu;
            responseOp = "2";
          } else if (selection === "7" && currentPage > 0) {
            const prevPage = currentPage - 1;
            const start = prevPage * PACKAGES_PER_PAGE;
            const pagePackages = session.packages.slice(start, start + PACKAGES_PER_PAGE);
            let packageMenu = "Select package:\n";
            pagePackages.forEach((pkg: any, idx: number) => {
              const label = pkg.is_express ? ` (express)` : "";
              packageMenu += `${idx + 1}. ${pkg.size_gb}GB${label} - GHS ${pkg.price.toFixed(2)}\n`;
            });
            packageMenu += "\n";
            if (prevPage > 0) packageMenu += "7. Prev\n";
            if (prevPage + 1 < totalPages) packageMenu += "6. Next\n";
            packageMenu += "0. Back";
            await updateSession({ current_page: prevPage });
            msg = packageMenu;
            responseOp = "2";
          } else if (selection === "0") {
            await updateSession({ step: "select_network" });
            msg = buildNetworkMenu(session.store_name, session.is_default_user, session.support_contact);
            responseOp = "2";
          } else {
            const selectionNum = parseInt(selection);
            const start = currentPage * PACKAGES_PER_PAGE;
            const selectedIndex = start + selectionNum - 1;
            if (isNaN(selectionNum) || selectionNum < 1 || selectionNum > PACKAGES_PER_PAGE || selectedIndex >= session.packages.length) {
              msg = "Invalid option.\n0. Back";
              responseOp = "2";
            } else {
              const selectedPackage = session.packages[selectedIndex];
              await updateSession({
                step: "enter_recipient",
                package_id: selectedPackage.id,
                package_price: selectedPackage.price,
                package_size: selectedPackage.size_gb,
                package_network: selectedPackage.network,
              });
              msg = `Enter recipient number\nor 0 to use your number (${msisdn}):`;
              responseOp = "2";
            }
          }
        }
        // STEP 4: Enter recipient
        else if (session.step === "enter_recipient") {
          let recipient = ussdString === "0" ? msisdn : ussdString.trim();
          if (recipient !== "0" || ussdString === "0") recipient = formatPhoneNumber(recipient);

          if (!recipient.match(/^0[2-9]\d{8}$/)) {
            msg = `Invalid number.\nEnter recipient (e.g., 024XXXXXXX):\nor 0 to use your number (${msisdn}):`;
            responseOp = "2";
          } else {
            // ============================================================
            // NETWORK VALIDATION
            // Check that the recipient number belongs to the selected network
            // ============================================================
            const packageNetwork = session.package_network;
            if (!networkMatchesPackage(recipient, packageNetwork)) {
              const expectedNetwork = getNetworkDisplayName(packageNetwork);
              const actualNetwork = getNetworkDisplayName(getPhoneNetwork(recipient) || "");
              msg = `Wrong network!\n${recipient} is a ${actualNetwork} number.\nPlease enter a ${expectedNetwork} number\nor 0 to use your number (${msisdn}):`;
              responseOp = "2";
            } else {
              await updateSession({ step: "confirm_payment", recipient_number: recipient });
              const fee = session.package_price * (PAYSTACK_FEE_PERCENT / 100);
              const total = session.package_price + fee;
              const displayNetwork = getNetworkDisplayName(session.package_network);
              msg = `Confirm:\n${session.package_size}GB ${displayNetwork}\nGHS ${total.toFixed(2)}\nTo: ${recipient}\n\n1. Pay\n2. Cancel`;
              responseOp = "2";
            }
          }
        }
        // STEP 5: Confirm payment
        else if (session.step === "confirm_payment") {
          if (ussdString === "2") {
            msg = "Cancelled. Thank you!";
            responseOp = "3";
            await deleteSession();
          } else if (ussdString !== "1") {
            msg = `Invalid.\n1. Pay\n2. Cancel`;
            responseOp = "2";
          } else {
            const fee = session.package_price * (PAYSTACK_FEE_PERCENT / 100);
            const totalWithFee = session.package_price + fee;
            const amountInPesewas = Math.round(totalWithFee * 100);
            const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
            const reference = `USS_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            const callerNetwork = detectedNetwork;
            const provider = getProviderCode(callerNetwork);
            const phoneLocal = formatPhoneForPaystack(msisdn);

            const metadata: any = {
              type: "ussd_purchase",
              package_id: session.package_id,
              package_name: `${session.package_size}GB`,
              network: session.package_network,
              phone: session.recipient_number,
              customer_msisdn: msisdn,
              base_amount: session.package_price,
              fee_amount: fee,
              is_default_user: session.is_default_user || false,
            };

            if (session.agent_store_id) metadata.agent_store_id = session.agent_store_id;
            if (session.subagent_store_id) metadata.subagent_store_id = session.subagent_store_id;
            if (session.sub_subagent_store_id) metadata.sub_subagent_store_id = session.sub_subagent_store_id;

            const customerEmail = `233${phoneLocal.substring(1)}@ussd.dataplug.store`;
            await storePaystackTransaction(supabase, sessionID, reference, totalWithFee, metadata);

            try {
              const paystackRes = await fetch("https://api.paystack.co/charge", {
                method: "POST",
                headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: customerEmail,
                  amount: amountInPesewas,
                  currency: "GHS",
                  reference,
                  mobile_money: { phone: phoneLocal, provider },
                  metadata,
                }),
              });

              const result = await paystackRes.json();
              console.log(`[USSD] Paystack response:`, JSON.stringify(result));

              if (result.status) {
                if (result.data?.status === "send_otp" || result.data?.display_text === "Enter OTP") {
                  await updateSession({
                    step: "enter_paystack_otp",
                    paystack_reference: reference,
                    paystack_transaction_ref: result.data?.reference || reference
                  });
                  msg = `Enter the OTP sent to ${msisdn}:\n0. Cancel`;
                  responseOp = "2";
                } else if (result.data?.status === "success") {
                  msg = `Payment sent!\n\nApprove at:\n${getApprovalInstructions(callerNetwork)}`;
                  responseOp = "3";
                  await supabase.from("ussd_transactions").insert({
                    session_id: sessionID, customer_msisdn: msisdn,
                    recipient_number: session.recipient_number, package_size: session.package_size,
                    network: session.package_network, amount: totalWithFee,
                    paystack_reference: reference, agent_store_id: session.agent_store_id,
                    subagent_store_id: session.subagent_store_id, status: "processing",
                  });
                  await updateTransactionStatus(supabase, reference, "completed");
                  await deleteSession();
                } else {
                  msg = `Payment initiated.\n\nApprove at:\n${getApprovalInstructions(callerNetwork)}`;
                  responseOp = "3";
                  await supabase.from("ussd_transactions").insert({
                    session_id: sessionID, customer_msisdn: msisdn,
                    recipient_number: session.recipient_number, package_size: session.package_size,
                    network: session.package_network, amount: totalWithFee,
                    paystack_reference: reference, agent_store_id: session.agent_store_id,
                    subagent_store_id: session.subagent_store_id, status: "pending",
                  });
                  await updateTransactionStatus(supabase, reference, "pending");
                  await deleteSession();
                }
              } else {
                console.error(`[USSD] Paystack error:`, result.message);
                msg = `Payment failed: ${result.message}\nTry again later.\n0. Back`;
                responseOp = "2";
                await updateTransactionStatus(supabase, reference, "failed");
              }
            } catch (err) {
              console.error(`[USSD] Paystack request error:`, err);
              msg = `Payment error. Please try again.\n0. Back`;
              responseOp = "2";
            }
          }
        }
        // STEP 6: Enter Paystack OTP
        else if (session.step === "enter_paystack_otp") {
          if (ussdString === "0") {
            msg = "Payment cancelled.\nThank you!";
            responseOp = "3";
            await updateTransactionStatus(supabase, session.paystack_reference, "cancelled");
            await deleteSession();
          } else {
            const otpCode = ussdString.trim();
            const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
            try {
              const paystackRes = await fetch("https://api.paystack.co/charge/submit_otp", {
                method: "POST",
                headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ otp: otpCode, reference: session.paystack_reference }),
              });
              const result = await paystackRes.json();
              console.log(`[USSD] Paystack OTP response:`, JSON.stringify(result));
              if (result.status) {
                if (result.data?.status === "success") {
                  msg = `Payment sent!\n\nApprove at:\n${getApprovalInstructions(detectedNetwork)}`;
                  responseOp = "3";
                  await supabase.from("ussd_transactions").insert({
                    session_id: sessionID, customer_msisdn: msisdn,
                    recipient_number: session.recipient_number, package_size: session.package_size,
                    network: session.package_network,
                    amount: session.package_price + (session.package_price * (PAYSTACK_FEE_PERCENT / 100)),
                    paystack_reference: session.paystack_reference,
                    agent_store_id: session.agent_store_id,
                    subagent_store_id: session.subagent_store_id, status: "processing",
                  });
                  await updateTransactionStatus(supabase, session.paystack_reference, "completed", otpCode);
                  await deleteSession();
                } else {
                  msg = `Invalid OTP. Please try again.\nEnter OTP sent to ${msisdn}:\n0. Cancel`;
                  responseOp = "2";
                }
              } else {
                msg = `OTP verification failed: ${result.message}\nTry again:\n0. Cancel`;
                responseOp = "2";
              }
            } catch (err) {
              console.error(`[USSD] Paystack OTP error:`, err);
              msg = `Error verifying OTP.\nTry again:\n0. Cancel`;
              responseOp = "2";
            }
          }
        } else {
          msg = "Session expired. Dial again.";
          responseOp = "3";
          await deleteSession();
        }
      }
    } else {
      msg = "Error. Please try again.";
      responseOp = "3";
    }

    return sendResponse(sessionID, msg, responseOp, corsHeaders);

  } catch (err) {
    console.error("[USSD] Fatal error:", err);
    return sendResponse("", "Service unavailable.", "3", corsHeaders);
  }
});

function sendResponse(sessionID: string, message: string, ussdServiceOp: string, corsHeaders: any) {
  return new Response(
    JSON.stringify({ message, ussdServiceOp, sessionID }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
