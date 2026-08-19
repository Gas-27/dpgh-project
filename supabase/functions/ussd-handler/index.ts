// supabase/functions/ussd-handler/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYSTACK_FEE_PERCENT = 1.98;
const PACKAGES_PER_PAGE = 6;

// Detect network from phone number prefix
function detectNetworkFromPhone(phone: string): string {
  let cleaned = phone.replace(/^\+/, "").replace(/^233/, "0");
  if (!cleaned.startsWith("0")) {
    cleaned = "0" + cleaned;
  }
  
  // MTN prefixes: 024, 053, 054, 055, 059
  if (/^0(24|53|54|55|59)/.test(cleaned)) {
    return "mtn";
  }
  // Telecel/Vodafone prefixes: 020, 050
  if (/^0(20|50)/.test(cleaned)) {
    return "telecel";
  }
  // AirtelTigo prefixes: 026, 027, 056, 057
  if (/^0(26|27|56|57)/.test(cleaned)) {
    return "airteltigo";
  }
  return "unknown";
}

// Get display name for network
function getNetworkDisplayName(network: string): string {
  if (network === "mtn") return "MTN";
  if (network === "telecel") return "Telecel";
  if (network === "airteltigo") return "AirtelTigo";
  if (network === "mtn_mashup") return "MTN Mashup";
  if (network === "mashup") return "Mashup";
  return "Unknown";
}

// Get Paystack provider code based on network
function getProviderCode(network: string): string {
  if (network === "telecel") return "vod";
  if (network === "airteltigo") return "tgo";
  return "mtn";
}

// Get approval instructions based on network
function getApprovalInstructions(network: string): string {
  if (network === "telecel") {
    return "*110# > My Wallet > Approvals";
  } else if (network === "airteltigo") {
    return "*500# > My Approvals";
  }
  return "*170# > Wallet > My Approvals";
}

// Format date/time for display
function formatOrderTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    return `${day}/${month} ${hours}:${mins}`;
  } catch {
    return "";
  }
}

// Format phone for Paystack - LOCAL format (0XXXXXXXXX)
function formatPhoneForPaystack(phone: string): string {
  let cleaned = phone.replace(/^\+/, "");
  
  if (cleaned.startsWith("233")) {
    cleaned = "0" + cleaned.substring(3);
  }
  if (!cleaned.startsWith("0")) {
    cleaned = "0" + cleaned;
  }
  
  return cleaned;
}

function sendResponse(sessionID: string, msg: string, op: string, headers: any) {
  return new Response(JSON.stringify({ sessionID, USSD_RETURN_OP: op, USSD_RETURN_MSG: msg }), {
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  console.log(`[USSD] ========== NEW REQUEST ==========`);
  console.log(`[USSD] Method: ${req.method}`);
  
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let sessionID = "";
    let ussdServiceOp = "";
    let ussdString = "";
    let msisdn = "";
    let network = "";
    
    const contentType = req.headers.get("content-type") || "";
    
    if (contentType.includes("application/json")) {
      const body = await req.json();
      console.log(`[USSD] Request body (JSON):`, JSON.stringify(body));
      sessionID = body.sessionID || "";
      ussdServiceOp = String(body.ussdServiceOp || "");
      ussdString = body.ussdString || "";
      msisdn = body.msisdn || "";
      network = body.network || "";
    } else {
      const formData = await req.formData();
      console.log(`[USSD] FormData entries:`, Array.from(formData.entries()));
      sessionID = formData.get("sessionID") as string || "";
      ussdServiceOp = formData.get("ussdServiceOp") as string || "";
      ussdString = (formData.get("ussdString") as string) || "";
      msisdn = formData.get("msisdn") as string || "";
      network = formData.get("network") as string || "";
    }

    // Detect network from phone number
    const detectedNetwork = detectNetworkFromPhone(msisdn);
    console.log(`[USSD] Parsed values:`);
    console.log(`  - sessionID: "${sessionID}"`);
    console.log(`  - ussdServiceOp: "${ussdServiceOp}"`);
    console.log(`  - ussdString: "${ussdString}"`);
    console.log(`  - msisdn: "${msisdn}"`);
    console.log(`  - detected network: "${detectedNetwork}"`);

    if (!sessionID) {
      console.error(`[USSD] ERROR: Missing sessionID!`);
      return sendResponse("", "Technical error. Please try again.", "3", corsHeaders);
    }
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let msg = "";
    let responseOp = "3"; // Default to end session

    // START SESSION
    if (ussdServiceOp === "1") {
      console.log(`[USSD] Starting new session: ${sessionID}`);
      
      const newSession = {
        step: "enter_access_code",
        created_at: Date.now(),
        caller_msisdn: msisdn,
        caller_network: detectedNetwork,
      };
      
      const { error: upsertError } = await supabase
        .from("ussd_sessions")
        .upsert({
          session_id: sessionID,
          data: newSession,
          updated_at: new Date().toISOString()
        });
      
      if (upsertError) {
        console.error(`[USSD] Failed to save session:`, upsertError);
      }
      
      msg = "Welcome\nEnter access code:";
      responseOp = "2";
    }
    // CONTINUE SESSION
    else if (ussdServiceOp === "18") {
      console.log(`[USSD] Continuing session: ${sessionID}`);
      
      const { data: sessionData, error: fetchError } = await supabase
        .from("ussd_sessions")
        .select("data")
        .eq("session_id", sessionID)
        .maybeSingle();
      
      if (fetchError) {
        console.error(`[USSD] Error fetching session:`, fetchError);
        msg = "Technical error. Please try again.";
        responseOp = "3";
      } else if (!sessionData) {
        msg = "Session expired. Please dial again.";
        responseOp = "3";
      } else {
        const session = sessionData.data;
        console.log(`[USSD] Session found. Step: ${session.step}`);
        
        const updateSession = async (newData: any) => {
          const { error: updateError } = await supabase
            .from("ussd_sessions")
            .upsert({
              session_id: sessionID,
              data: { ...session, ...newData, updated_at: Date.now() },
              updated_at: new Date().toISOString()
            });
          
          if (updateError) {
            console.error(`[USSD] Failed to update session:`, updateError);
          }
          return updateError;
        };
        
        const deleteSession = async () => {
          const { error: deleteError } = await supabase
            .from("ussd_sessions")
            .delete()
            .eq("session_id", sessionID);
          
          if (deleteError) {
            console.error(`[USSD] Failed to delete session:`, deleteError);
          }
        };
        
        // STEP 1: Enter agent code
        if (session.step === "enter_access_code") {
          const agentCode = ussdString.trim().toUpperCase();
          console.log(`[USSD] Processing agent code: "${agentCode}"`);
          let agentStoreId: string | null = null;
          let subagentStoreId: string | null = null;
          let subsubagentStoreId: string | null = null;
          let supportContact: string | null = null;

          if (agentCode !== "0") {
            // First check agent_stores for the code
            const { data: agent, error: agentError } = await supabase
              .from("agent_stores")
              .select("id, support_number")
              .eq("topup_reference", agentCode)
              .eq("approved", true)
              .single();

            if (!agentError && agent) {
              agentStoreId = agent.id;
              supportContact = agent.support_number;
              console.log(`[USSD] Found agent store: ${agentStoreId}`);
            } else {
              // If not found in agent_stores, check subagent_stores
              const { data: subagent, error: subagentError } = await supabase
                .from("subagent_stores")
                .select("id, agent_store_id, support_number")
                .eq("topup_reference", agentCode)
                .eq("approved", true)
                .single();

              if (!subagentError && subagent) {
                subagentStoreId = subagent.id;
                agentStoreId = subagent.agent_store_id; // Get parent agent for pricing
                supportContact = subagent.support_number;
                console.log(`[USSD] Found subagent store: ${subagentStoreId}, parent agent: ${agentStoreId}`);
              } else {
                const { data: subsubagent, error: subsubagentError } = await supabase
                  .from("sub_subagent_stores")
                  .select("id, subagent_store_id, agent_store_id, support_number")
                  .eq("topup_reference", agentCode)
                  .eq("approved", true)
                  .single();
                if (!subsubagentError && subsubagent) {
                  subsubagentStoreId = subsubagent.id;
                  subagentStoreId = subsubagent.subagent_store_id;
                  agentStoreId = subsubagent.agent_store_id;
                  supportContact = subsubagent.support_number;
                  console.log(`[USSD] Found sub-subagent store: ${subsubagentStoreId}`);
                } else {
                msg = "Invalid code.\nEnter a valid code:";
                responseOp = "2";
                await updateSession({ step: "enter_access_code" });
                return sendResponse(sessionID, msg, responseOp, corsHeaders);
              }
            }
          }

          await updateSession({
            step: "select_network",
            agent_store_id: agentStoreId,
            subagent_store_id: subagentStoreId,
            subsubagent_store_id: subsubagentStoreId,
            support_contact: supportContact,
          });

          msg = "Select network:\n1. MTN\n2. Telecel\n3. AT\n4. MTN Mashup\n5. Track Order\n6. Support";
          if (supportContact) {
            msg += `\n0. Back\n\nSupport: ${supportContact}`;
          } else {
            msg += "\n0. Back";
          }
          responseOp = "2";
        }
        // STEP 2: Select network
        else if (session.step === "select_network") {
          const networkMap: Record<string, string> = {
            "1": "mtn",
            "2": "telecel",
            "3": "airteltigo",
            "4": "mtn_mashup",
          };
          const selectedNetwork = networkMap[ussdString];

          if (ussdString === "0") {
            await updateSession({ step: "enter_access_code" });
            msg = "Enter access code:";
            responseOp = "2";
          } else if (ussdString === "6") {
            // Show support contact
            await updateSession({ step: "view_support" });
            if (session.support_contact) {
              msg = `Support Contact:\n${session.support_contact}\n\n0. Back`;
            } else {
              msg = "No support contact available.\n0. Back";
            }
            responseOp = "2";
          } else if (ussdString === "5") {
            await updateSession({ step: "track_order_enter_phone" });
            msg = `Enter phone number for order\nor 0 to use your number (${msisdn}):`;
            responseOp = "2";
          } else if (!selectedNetwork) {
            msg = "Invalid option.\n1. MTN\n2. Telecel\n3. AT\n4. MTN Mashup\n5. Track Order\n6. Support\n0. Back";
            responseOp = "2";
          } else {
            let packages: any[] = [];

            // If subagent code was used, get packages with subagent's custom prices (fallback to agent prices, then default)
            if (session.subsubagent_store_id) {
              const { data: allPackages, error: pkgError } = await supabase.from("data_packages").select("id, size_gb, network, agent_price").eq("active", true).eq("network", selectedNetwork);
              const { data: customPrices } = await supabase.from("sub_subagent_package_prices").select("package_id, customer_sell_price").eq("sub_subagent_store_id", session.subsubagent_store_id);
              const priceMap = new Map((customPrices || []).map((p: any) => [p.package_id, p.customer_sell_price]));
              if (!pkgError && allPackages) packages = allPackages.map((pkg: any) => ({ id: pkg.id, size_gb: pkg.size_gb, price: priceMap.get(pkg.id) ?? pkg.agent_price }));
            } else if (session.subagent_store_id) {
              // First get all active packages for this network
              const { data: allPackages, error: pkgError } = await supabase
                .from("data_packages")
                .select("id, size_gb, network, agent_price")
                .eq("active", true)
                .eq("network", selectedNetwork);

              if (!pkgError && allPackages) {
                // Get subagent's custom prices
                const { data: subagentPrices } = await supabase
                  .from("subagent_package_prices")
                  .select("package_id, sell_price")
                  .eq("subagent_store_id", session.subagent_store_id);

                // Get parent agent's custom prices as fallback
                const { data: agentPrices } = await supabase
                  .from("agent_package_prices")
                  .select("package_id, sell_price")
                  .eq("agent_store_id", session.agent_store_id);

                const subagentPriceMap = new Map((subagentPrices || []).map(p => [p.package_id, p.sell_price]));
                const agentPriceMap = new Map((agentPrices || []).map(p => [p.package_id, p.sell_price]));

                packages = allPackages.map(pkg => ({
                  id: pkg.id,
                  size_gb: pkg.size_gb,
                  // Priority: subagent price > agent price > default agent_price
                  price: subagentPriceMap.get(pkg.id) ?? agentPriceMap.get(pkg.id) ?? pkg.agent_price,
                }));
              }
            }
            // If agent code was used, get agent's custom prices
            else if (session.agent_store_id) {
              // First get all active packages for this network
              const { data: allPackages, error: pkgError } = await supabase
                .from("data_packages")
                .select("id, size_gb, network, agent_price")
                .eq("active", true)
                .eq("network", selectedNetwork);

              if (!pkgError && allPackages) {
                // Get agent's custom prices
                const { data: agentPrices } = await supabase
                  .from("agent_package_prices")
                  .select("package_id, sell_price")
                  .eq("agent_store_id", session.agent_store_id);

                const agentPriceMap = new Map((agentPrices || []).map(p => [p.package_id, p.sell_price]));

                packages = allPackages.map(pkg => ({
                  id: pkg.id,
                  size_gb: pkg.size_gb,
                  // Priority: agent price > default agent_price
                  price: agentPriceMap.get(pkg.id) ?? pkg.agent_price,
                }));
              }
            } 
            // No code entered (code "0"), use default agent prices
            else {
              const { data, error } = await supabase
                .from("data_packages")
                .select("id, size_gb, agent_price")
                .eq("active", true)
                .eq("network", selectedNetwork);

              if (!error && data) {
                packages = data.map(pkg => ({
                  id: pkg.id,
                  size_gb: pkg.size_gb,
                  price: pkg.agent_price,
                }));
              }
            }

            if (packages.length === 0) {
              msg = "No packages available.\n0. Back";
              responseOp = "2";
            } else {
              packages.sort((a, b) => a.size_gb - b.size_gb);
              
              await updateSession({
                step: "view_packages",
                network: selectedNetwork,
                packages: packages,
                current_page: 0,
              });

              const totalPages = Math.ceil(packages.length / PACKAGES_PER_PAGE);
              const pagePackages = packages.slice(0, PACKAGES_PER_PAGE);
              
              let packageMenu = "Select package:\n";
              pagePackages.forEach((pkg: any, idx: number) => {
                packageMenu += `${idx + 1}. ${pkg.size_gb}GB - GHS ${pkg.price.toFixed(2)}\n`;
              });
              
              if (totalPages > 1) {
                packageMenu += `6. Next\n`;
              }
              packageMenu += "0. Back";
              
              msg = packageMenu;
              responseOp = "2";
            }
          }
        }
        // VIEW SUPPORT CONTACT
        else if (session.step === "view_support") {
          if (ussdString === "0") {
            await updateSession({ step: "select_network" });
            msg = "Select network:\n1. MTN\n2. Telecel\n3. AT\n4. MTN Mashup\n5. Track Order\n6. Support\n0. Back";
            responseOp = "2";
          } else {
            msg = "Invalid option.\n0. Back";
            responseOp = "2";
          }
        }
        // TRACK ORDER - Enter phone number
        else if (session.step === "track_order_enter_phone") {
          const phone = ussdString.trim();
          
          if (phone === "0") {
            await updateSession({ step: "select_network" });
            msg = "Select network:\n1. MTN\n2. Telecel\n3. AT\n4. MTN Mashup\n5. Track Order\n6. Support\n0. Back";
            responseOp = "2";
          } else if (!phone.match(/^0[2-9]\d{8}$/)) {
            msg = "Invalid number.\nEnter phone (e.g., 024XXXXXXX):\n0. Back";
            responseOp = "2";
          } else {
            // Fetch support contact from agent or subagent
            let supportContact = "";
            
            if (session.subsubagent_store_id) {
              const { data: allPackages, error: pkgError } = await supabase.from("data_packages").select("id, size_gb, network, agent_price").eq("active", true).eq("network", selectedNetwork);
              const { data: customPrices } = await supabase.from("sub_subagent_package_prices").select("package_id, customer_sell_price").eq("sub_subagent_store_id", session.subsubagent_store_id);
              const priceMap = new Map((customPrices || []).map((p: any) => [p.package_id, p.customer_sell_price]));
              if (!pkgError && allPackages) packages = allPackages.map((pkg: any) => ({ id: pkg.id, size_gb: pkg.size_gb, price: priceMap.get(pkg.id) ?? pkg.agent_price }));
            } else if (session.subagent_store_id) {
              // Get support contact from subagent
              const { data: subagent } = await supabase
                .from("subagent_stores")
                .select("support_number")
                .eq("id", session.subagent_store_id)
                .single();
              
              if (subagent?.support_number) {
                supportContact = subagent.support_number;
              }
            } else if (session.agent_store_id) {
              // Get support contact from agent
              const { data: agent } = await supabase
                .from("agent_stores")
                .select("support_number")
                .eq("id", session.agent_store_id)
                .single();
              
              if (agent?.support_number) {
                supportContact = agent.support_number;
              }
            }

            // Fetch only 2 most recent orders
            const { data: orders, error: orderError } = await supabase
              .from("orders")
              .select("id, size_gb, network, status, fulfillment_status, created_at")
              .eq("customer_number", phone)
              .order("created_at", { ascending: false })
              .limit(2);
            
            if (orderError || !orders || orders.length === 0) {
              msg = `No orders for ${phone}.\n0. Back`;
              if (supportContact) {
                msg += `\nSupport: ${supportContact}`;
              }
              await updateSession({ step: "no_orders_found" });
              responseOp = "2";
            } else {
              let orderList = `Recent Orders:\n\n`;
              orders.forEach((order, idx) => {
                let net = "";
                if (order.network === "mtn") net = "MTN";
                else if (order.network === "telecel") net = "Tel";
                else if (order.network === "airteltigo") net = "AT";
                else if (order.network === "mtn_mashup") net = "Mashup";
                else if (order.network === "mashup") net = "Mashup";
                else net = "Unknown";
                const time = formatOrderTime(order.created_at);
                orderList += `${idx + 1}. ${order.size_gb}GB ${net}\nOrder made will be\ndelivered soon\nTime: ${time}\n\n`;
              });
              orderList += "0. Back";
              
              if (supportContact) {
                orderList += `\nSupport: ${supportContact}`;
              }
              
              await updateSession({ step: "view_orders" });
              msg = orderList;
              responseOp = "2";
            }
          }
        }
        // NO ORDERS FOUND - Back handler
        else if (session.step === "no_orders_found") {
          if (ussdString === "0") {
            await updateSession({ step: "select_network" });
            msg = "Select network:\n1. MTN\n2. Telecel\n3. AT\n4. MTN Mashup\n5. Track Order\n6. Support\n0. Back";
            responseOp = "2";
          } else {
            msg = "Invalid option.\n0. Back";
            responseOp = "2";
          }
        }
        // VIEW ORDERS - Back handler
        else if (session.step === "view_orders") {
          if (ussdString === "0") {
            await updateSession({ step: "select_network" });
            msg = "Select network:\n1. MTN\n2. Telecel\n3. AT\n4. MTN Mashup\n5. Track Order\n6. Support\n0. Back";
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
          
          if (selection === "6") {
            const nextPage = currentPage + 1;
            if (nextPage < totalPages) {
              const start = nextPage * PACKAGES_PER_PAGE;
              const end = start + PACKAGES_PER_PAGE;
              const pagePackages = session.packages.slice(start, end);
              
              let packageMenu = "Select package:\n";
              pagePackages.forEach((pkg: any, idx: number) => {
                packageMenu += `${idx + 1}. ${pkg.size_gb}GB - GHS ${pkg.price.toFixed(2)}\n`;
              });
              
              packageMenu += `7. Prev\n`;
              if (nextPage + 1 < totalPages) {
                packageMenu += "6. Next\n";
              }
              packageMenu += "0. Back";
              
              await updateSession({ current_page: nextPage });
              msg = packageMenu;
              responseOp = "2";
            } else {
              msg = "No more pages.\n0. Back";
              responseOp = "2";
            }
          }
          else if (selection === "7") {
            const prevPage = currentPage - 1;
            if (prevPage >= 0) {
              const start = prevPage * PACKAGES_PER_PAGE;
              const end = start + PACKAGES_PER_PAGE;
              const pagePackages = session.packages.slice(start, end);
              
              let packageMenu = "Select package:\n";
              pagePackages.forEach((pkg: any, idx: number) => {
                packageMenu += `${idx + 1}. ${pkg.size_gb}GB - GHS ${pkg.price.toFixed(2)}\n`;
              });
              
              if (prevPage > 0) {
                packageMenu += `7. Prev\n`;
              }
              if (prevPage + 1 < totalPages) {
                packageMenu += "6. Next\n";
              }
              packageMenu += "0. Back";
              
              await updateSession({ current_page: prevPage });
              msg = packageMenu;
              responseOp = "2";
            } else {
              msg = "No previous pages.\n0. Back";
              responseOp = "2";
            }
          }
          else if (selection === "0") {
            await updateSession({ step: "select_network" });
            msg = "Select network:\n1. MTN\n2. Telecel\n3. AT\n4. MTN Mashup\n5. Track Order\n6. Support\n0. Back";
            responseOp = "2";
          }
          else {
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
              });
              
              msg = `Enter recipient number\nor 0 to use your number (${msisdn}):`;
              responseOp = "2";
            }
          }
        }
        // STEP 4: Enter recipient
        else if (session.step === "enter_recipient") {
          const recipient = ussdString === "0" ? msisdn : ussdString.trim();
          
          if (!recipient.match(/^0[2-9]\d{8}$/)) {
            msg = `Invalid number.\nEnter recipient (e.g., 024XXXXXXX):\nor 0 to use your number (${msisdn}):`;
            responseOp = "2";
          } else {
            await updateSession({
              step: "confirm_payment",
              recipient_number: recipient,
            });
            
            const fee = session.package_price * (PAYSTACK_FEE_PERCENT / 100);
            const total = session.package_price + fee;
            const displayNetwork = getNetworkDisplayName(session.network);
            
            msg = `Confirm:\n${session.package_size}GB ${displayNetwork}\nGHS ${total.toFixed(2)}\nTo: ${recipient}\n\n1. Pay\n2. Cancel`;
            responseOp = "2";
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
            // Start Paystack payment
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
              network: session.network,
              phone: session.recipient_number,
              customer_msisdn: msisdn,
              base_amount: session.package_price,
              fee_amount: fee,
            };

            if (session.agent_store_id) metadata.agent_store_id = session.agent_store_id;
            if (session.subagent_store_id) metadata.subagent_store_id = session.subagent_store_id;

            const customerEmail = `233${phoneLocal.substring(1)}@ussd.dataplug.store`;

            try {
              const paystackRes = await fetch("https://api.paystack.co/charge", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                  "Content-Type": "application/json",
                },
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
                    paystack_transaction_ref: result.data?.reference || reference,
                  });
                  msg = `Enter the OTP sent to ${msisdn}:\n0. Cancel`;
                  responseOp = "2";
                } else if (result.data?.status === "success") {
                  msg = `Payment sent!\n\nApprove at:\n${getApprovalInstructions(callerNetwork)}`;
                  responseOp = "3";
                  
                  await supabase.from("ussd_transactions").insert({
                    session_id: sessionID,
                    customer_msisdn: msisdn,
                    recipient_number: session.recipient_number,
                    package_size: session.package_size,
                    network: session.network,
                    amount: totalWithFee,
                    paystack_reference: reference,
                    agent_store_id: session.agent_store_id,
                    subagent_store_id: session.subagent_store_id,
                    status: "processing",
                  });
                  
                  await deleteSession();
                } else {
                  msg = `Payment initiated.\n\nApprove at:\n${getApprovalInstructions(callerNetwork)}`;
                  responseOp = "3";
                  
                  await supabase.from("ussd_transactions").insert({
                    session_id: sessionID,
                    customer_msisdn: msisdn,
                    recipient_number: session.recipient_number,
                    package_size: session.package_size,
                    network: session.network,
                    amount: totalWithFee,
                    paystack_reference: reference,
                    agent_store_id: session.agent_store_id,
                    subagent_store_id: session.subagent_store_id,
                    status: "pending",
                  });
                  
                  await deleteSession();
                }
              } else {
                console.error(`[USSD] Paystack error:`, result.message);
                msg = `Payment failed: ${result.message}\nTry again later.\n0. Back`;
                responseOp = "2";
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
            await deleteSession();
          } else {
            const otpCode = ussdString.trim();
            const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
            
            try {
              const paystackRes = await fetch("https://api.paystack.co/charge/submit_otp", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  otp: otpCode,
                  reference: session.paystack_reference,
                }),
              });
              
              const result = await paystackRes.json();
              console.log(`[USSD] Paystack OTP response:`, JSON.stringify(result));
              
              if (result.status) {
                if (result.data?.status === "success") {
                  msg = `Payment sent!\n\nApprove at:\n${getApprovalInstructions(detectedNetwork)}`;
                  responseOp = "3";
                  
                  await supabase.from("ussd_transactions").insert({
                    session_id: sessionID,
                    customer_msisdn: msisdn,
                    recipient_number: session.recipient_number,
                    package_size: session.package_size,
                    network: session.network,
                    amount: session.package_price + (session.package_price * (PAYSTACK_FEE_PERCENT / 100)),
                    paystack_reference: session.paystack_reference,
                    agent_store_id: session.agent_store_id,
                    subagent_store_id: session.subagent_store_id,
                    status: "processing",
                  });
                  
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
        }
        else {
          msg = "Session expired. Dial again.";
          responseOp = "3";
          await deleteSession();
        }
      }
    }
    else {
      msg = "Error. Please try again.";
      responseOp = "3";
    }

    return sendResponse(sessionID, msg, responseOp, corsHeaders);

  } catch (err) {
    console.error("[USSD] Fatal error:", err);
    return sendResponse("", "Service unavailable.", "3", corsHeaders);
  }
});


// Get Paystack provider code based on network
function getProviderCode(network: string): string {
  if (network === "telecel") return "vod";
  if (network === "airteltigo") return "tgo";
  return "mtn";
}

// Get approval instructions based on network
function getApprovalInstructions(network: string): string {
  if (network === "telecel") {
    return "*110# > My Wallet > Approvals";
  } else if (network === "airteltigo") {
    return "*500# > My Approvals";
  }
  return "*170# > Wallet > My Approvals";
}

// Format date/time for display
function formatOrderTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    return `${day}/${month} ${hours}:${mins}`;
  } catch {
    return "";
  }
}

// Format phone for Paystack - LOCAL format (0XXXXXXXXX)
function formatPhoneForPaystack(phone: string): string {
  let cleaned = phone.replace(/^\+/, "");
  
  if (cleaned.startsWith("233")) {
    cleaned = "0" + cleaned.substring(3);
  }
  if (!cleaned.startsWith("0")) {
    cleaned = "0" + cleaned;
  }
  
  return cleaned;
}

function sendResponse(sessionID: string, msg: string, op: string, headers: any) {
  return new Response(JSON.stringify({ sessionID, USSD_RETURN_OP: op, USSD_RETURN_MSG: msg }), {
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  console.log(`[USSD] ========== NEW REQUEST ==========`);
  console.log(`[USSD] Method: ${req.method}`);
  
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let sessionID = "";
    let ussdServiceOp = "";
    let ussdString = "";
    let msisdn = "";
    let network = "";
    
    const contentType = req.headers.get("content-type") || "";
    
    if (contentType.includes("application/json")) {
      const body = await req.json();
      console.log(`[USSD] Request body (JSON):`, JSON.stringify(body));
      sessionID = body.sessionID || "";
      ussdServiceOp = String(body.ussdServiceOp || "");
      ussdString = body.ussdString || "";
      msisdn = body.msisdn || "";
      network = body.network || "";
    } else {
      const formData = await req.formData();
      console.log(`[USSD] FormData entries:`, Array.from(formData.entries()));
      sessionID = formData.get("sessionID") as string || "";
      ussdServiceOp = formData.get("ussdServiceOp") as string || "";
      ussdString = (formData.get("ussdString") as string) || "";
      msisdn = formData.get("msisdn") as string || "";
      network = formData.get("network") as string || "";
    }

    // Detect network from phone number
    const detectedNetwork = detectNetworkFromPhone(msisdn);
    console.log(`[USSD] Parsed values:`);
    console.log(`  - sessionID: "${sessionID}"`);
    console.log(`  - ussdServiceOp: "${ussdServiceOp}"`);
    console.log(`  - ussdString: "${ussdString}"`);
    console.log(`  - msisdn: "${msisdn}"`);
    console.log(`  - detected network: "${detectedNetwork}"`);

    if (!sessionID) {
      console.error(`[USSD] ERROR: Missing sessionID!`);
      return sendResponse("", "Technical error. Please try again.", "3", corsHeaders);
    }
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let msg = "";
    let responseOp = "3"; // Default to end session

    // START SESSION
    if (ussdServiceOp === "1") {
      console.log(`[USSD] Starting new session: ${sessionID}`);
      
      const newSession = {
        step: "enter_access_code",
        created_at: Date.now(),
        caller_msisdn: msisdn,
        caller_network: detectedNetwork,
      };
      
      const { error: upsertError } = await supabase
        .from("ussd_sessions")
        .upsert({
          session_id: sessionID,
          data: newSession,
          updated_at: new Date().toISOString()
        });
      
      if (upsertError) {
        console.error(`[USSD] Failed to save session:`, upsertError);
      }
      
      msg = "Welcome\nEnter access code:";
      responseOp = "2";
    }
    // CONTINUE SESSION
    else if (ussdServiceOp === "18") {
      console.log(`[USSD] Continuing session: ${sessionID}`);
      
      const { data: sessionData, error: fetchError } = await supabase
        .from("ussd_sessions")
        .select("data")
        .eq("session_id", sessionID)
        .maybeSingle();
      
      if (fetchError) {
        console.error(`[USSD] Error fetching session:`, fetchError);
        msg = "Technical error. Please try again.";
        responseOp = "3";
      } else if (!sessionData) {
        msg = "Session expired. Please dial again.";
        responseOp = "3";
      } else {
        const session = sessionData.data;
        console.log(`[USSD] Session found. Step: ${session.step}`);
        
        const updateSession = async (newData: any) => {
          const { error: updateError } = await supabase
            .from("ussd_sessions")
            .upsert({
              session_id: sessionID,
              data: { ...session, ...newData, updated_at: Date.now() },
              updated_at: new Date().toISOString()
            });
          
          if (updateError) {
            console.error(`[USSD] Failed to update session:`, updateError);
          }
          return updateError;
        };
        
        const deleteSession = async () => {
          const { error: deleteError } = await supabase
            .from("ussd_sessions")
            .delete()
            .eq("session_id", sessionID);
          
          if (deleteError) {
            console.error(`[USSD] Failed to delete session:`, deleteError);
          }
        };
        
        // STEP 1: Enter agent code
        if (session.step === "enter_access_code") {
          const agentCode = ussdString.trim().toUpperCase();
          console.log(`[USSD] Processing agent code: "${agentCode}"`);
          let agentStoreId: string | null = null;
          let subagentStoreId: string | null = null;

          if (agentCode !== "0") {
            // First check agent_stores for the code
            const { data: agent, error: agentError } = await supabase
              .from("agent_stores")
              .select("id")
              .eq("topup_reference", agentCode)
              .eq("approved", true)
              .single();

            if (!agentError && agent) {
              agentStoreId = agent.id;
              console.log(`[USSD] Found agent store: ${agentStoreId}`);
            } else {
              // If not found in agent_stores, check subagent_stores
              const { data: subagent, error: subagentError } = await supabase
                .from("subagent_stores")
                .select("id, agent_store_id")
                .eq("topup_reference", agentCode)
                .eq("approved", true)
                .single();

              if (!subagentError && subagent) {
                subagentStoreId = subagent.id;
                agentStoreId = subagent.agent_store_id; // Get parent agent for pricing
                console.log(`[USSD] Found subagent store: ${subagentStoreId}, parent agent: ${agentStoreId}`);
              } else {
                msg = "Invalid code.\nEnter a valid code:";
                responseOp = "2";
                await updateSession({ step: "enter_access_code" });
                return sendResponse(sessionID, msg, responseOp, corsHeaders);
              }
            }
          }

          await updateSession({
            step: "select_network",
            agent_store_id: agentStoreId,
            subagent_store_id: subagentStoreId,
          });

          msg = "Select network:\n1. MTN\n2. Telecel\n3. AT\n4. Track Order\n0. Back";
          responseOp = "2";
        }
        // STEP 2: Select network
        else if (session.step === "select_network") {
          const networkMap: Record<string, string> = {
            "1": "mtn",
            "2": "telecel",
            "3": "airteltigo",
          };
          const selectedNetwork = networkMap[ussdString];

          if (ussdString === "0") {
            await updateSession({ step: "enter_access_code" });
            msg = "Enter access code:";
            responseOp = "2";
          } else if (ussdString === "4") {
            await updateSession({ step: "track_order_enter_phone" });
            msg = "Enter phone number for order\n(e.g., 024XXXXXXX):";
            responseOp = "2";
          } else if (!selectedNetwork) {
            msg = "Invalid option.\n1. MTN\n2. Telecel\n3. AT\n4. Track Order\n0. Back";
            responseOp = "2";
          } else {
            let packages: any[] = [];

            // If subagent code was used, get packages with subagent's custom prices (fallback to agent prices, then default)
            if (session.subsubagent_store_id) {
              const { data: allPackages, error: pkgError } = await supabase.from("data_packages").select("id, size_gb, network, agent_price").eq("active", true).eq("network", selectedNetwork);
              const { data: customPrices } = await supabase.from("sub_subagent_package_prices").select("package_id, customer_sell_price").eq("sub_subagent_store_id", session.subsubagent_store_id);
              const priceMap = new Map((customPrices || []).map((p: any) => [p.package_id, p.customer_sell_price]));
              if (!pkgError && allPackages) packages = allPackages.map((pkg: any) => ({ id: pkg.id, size_gb: pkg.size_gb, price: priceMap.get(pkg.id) ?? pkg.agent_price }));
            } else if (session.subagent_store_id) {
              // First get all active packages for this network
              const { data: allPackages, error: pkgError } = await supabase
                .from("data_packages")
                .select("id, size_gb, network, agent_price")
                .eq("active", true)
                .eq("network", selectedNetwork);

              if (!pkgError && allPackages) {
                // Get subagent's custom prices
                const { data: subagentPrices } = await supabase
                  .from("subagent_package_prices")
                  .select("package_id, sell_price")
                  .eq("subagent_store_id", session.subagent_store_id);

                // Get parent agent's custom prices as fallback
                const { data: agentPrices } = await supabase
                  .from("agent_package_prices")
                  .select("package_id, sell_price")
                  .eq("agent_store_id", session.agent_store_id);

                const subagentPriceMap = new Map((subagentPrices || []).map(p => [p.package_id, p.sell_price]));
                const agentPriceMap = new Map((agentPrices || []).map(p => [p.package_id, p.sell_price]));

                packages = allPackages.map(pkg => ({
                  id: pkg.id,
                  size_gb: pkg.size_gb,
                  // Priority: subagent price > agent price > default agent_price
                  price: subagentPriceMap.get(pkg.id) ?? agentPriceMap.get(pkg.id) ?? pkg.agent_price,
                }));
              }
            }
            // If agent code was used, get agent's custom prices
            else if (session.agent_store_id) {
              // First get all active packages for this network
              const { data: allPackages, error: pkgError } = await supabase
                .from("data_packages")
                .select("id, size_gb, network, agent_price")
                .eq("active", true)
                .eq("network", selectedNetwork);

              if (!pkgError && allPackages) {
                // Get agent's custom prices
                const { data: agentPrices } = await supabase
                  .from("agent_package_prices")
                  .select("package_id, sell_price")
                  .eq("agent_store_id", session.agent_store_id);

                const agentPriceMap = new Map((agentPrices || []).map(p => [p.package_id, p.sell_price]));

                packages = allPackages.map(pkg => ({
                  id: pkg.id,
                  size_gb: pkg.size_gb,
                  // Priority: agent price > default agent_price
                  price: agentPriceMap.get(pkg.id) ?? pkg.agent_price,
                }));
              }
            } 
            // No code entered (code "0"), use default agent prices
            else {
              const { data, error } = await supabase
                .from("data_packages")
                .select("id, size_gb, agent_price")
                .eq("active", true)
                .eq("network", selectedNetwork);

              if (!error && data) {
                packages = data.map(pkg => ({
                  id: pkg.id,
                  size_gb: pkg.size_gb,
                  price: pkg.agent_price,
                }));
              }
            }

            if (packages.length === 0) {
              msg = "No packages available.\n0. Back";
              responseOp = "2";
            } else {
              packages.sort((a, b) => a.size_gb - b.size_gb);
              
              await updateSession({
                step: "view_packages",
                network: selectedNetwork,
                packages: packages,
                current_page: 0,
              });

              const totalPages = Math.ceil(packages.length / PACKAGES_PER_PAGE);
              const pagePackages = packages.slice(0, PACKAGES_PER_PAGE);
              
              let packageMenu = "Select package:\n";
              pagePackages.forEach((pkg: any, idx: number) => {
                packageMenu += `${idx + 1}. ${pkg.size_gb}GB - GHS ${pkg.price.toFixed(2)}\n`;
              });
              
              if (totalPages > 1) {
                packageMenu += `6. Next\n`;
              }
              packageMenu += "0. Back";
              
              msg = packageMenu;
              responseOp = "2";
            }
          }
        }
        // TRACK ORDER - Enter phone number
        else if (session.step === "track_order_enter_phone") {
          const phone = ussdString.trim();
          
          if (phone === "0") {
            await updateSession({ step: "select_network" });
            msg = "Select network:\n1. MTN\n2. Telecel\n3. AT\n4. Track Order\n0. Back";
            responseOp = "2";
          } else if (!phone.match(/^0[2-9]\d{8}$/)) {
            msg = "Invalid number.\nEnter phone (e.g., 024XXXXXXX):\n0. Back";
            responseOp = "2";
          } else {
            // Fetch support contact from agent or subagent
            let supportContact = "";
            
            if (session.subsubagent_store_id) {
              const { data: allPackages, error: pkgError } = await supabase.from("data_packages").select("id, size_gb, network, agent_price").eq("active", true).eq("network", selectedNetwork);
              const { data: customPrices } = await supabase.from("sub_subagent_package_prices").select("package_id, customer_sell_price").eq("sub_subagent_store_id", session.subsubagent_store_id);
              const priceMap = new Map((customPrices || []).map((p: any) => [p.package_id, p.customer_sell_price]));
              if (!pkgError && allPackages) packages = allPackages.map((pkg: any) => ({ id: pkg.id, size_gb: pkg.size_gb, price: priceMap.get(pkg.id) ?? pkg.agent_price }));
            } else if (session.subagent_store_id) {
              // Get support contact from subagent
              const { data: subagent } = await supabase
                .from("subagent_stores")
                .select("support_number")
                .eq("id", session.subagent_store_id)
                .single();
              
              if (subagent?.support_number) {
                supportContact = subagent.support_number;
              }
            } else if (session.agent_store_id) {
              // Get support contact from agent
              const { data: agent } = await supabase
                .from("agent_stores")
                .select("support_number")
                .eq("id", session.agent_store_id)
                .single();
              
              if (agent?.support_number) {
                supportContact = agent.support_number;
              }
            }

            // Fetch only 2 most recent orders
            const { data: orders, error: orderError } = await supabase
              .from("orders")
              .select("id, size_gb, network, status, fulfillment_status, created_at")
              .eq("customer_number", phone)
              .order("created_at", { ascending: false })
              .limit(2);
            
            if (orderError || !orders || orders.length === 0) {
              msg = `No orders for ${phone}.\n0. Back`;
              if (supportContact) {
                msg += `\nSupport: ${supportContact}`;
              }
              await updateSession({ step: "no_orders_found" });
              responseOp = "2";
            } else {
              let orderList = `Recent Orders:\n\n`;
              orders.forEach((order, idx) => {
                const net = order.network === "mtn" ? "MTN" : 
                           order.network === "telecel" ? "Tel" : "AT";
                const time = formatOrderTime(order.created_at);
                orderList += `${idx + 1}. ${order.size_gb}GB ${net}\nOrder made will be\ndelivered soon\nTime: ${time}\n\n`;
              });
              orderList += "0. Back";
              
              if (supportContact) {
                orderList += `\nSupport: ${supportContact}`;
              }
              
              await updateSession({ step: "view_orders" });
              msg = orderList;
              responseOp = "2";
            }
          }
        }
        // NO ORDERS FOUND - Back handler
        else if (session.step === "no_orders_found") {
          if (ussdString === "0") {
            await updateSession({ step: "select_network" });
            msg = "Select network:\n1. MTN\n2. Telecel\n3. AT\n4. Track Order\n0. Back";
            responseOp = "2";
          } else {
            msg = "Invalid option.\n0. Back";
            responseOp = "2";
          }
        }
        // VIEW ORDERS - Back handler
        else if (session.step === "view_orders") {
          if (ussdString === "0") {
            await updateSession({ step: "select_network" });
            msg = "Select network:\n1. MTN\n2. Telecel\n3. AT\n4. Track Order\n0. Back";
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
          
          if (selection === "6") {
            const nextPage = currentPage + 1;
            if (nextPage < totalPages) {
              const start = nextPage * PACKAGES_PER_PAGE;
              const end = start + PACKAGES_PER_PAGE;
              const pagePackages = session.packages.slice(start, end);
              
              let packageMenu = "Select package:\n";
              pagePackages.forEach((pkg: any, idx: number) => {
                packageMenu += `${idx + 1}. ${pkg.size_gb}GB - GHS ${pkg.price.toFixed(2)}\n`;
              });
              
              packageMenu += `7. Prev\n`;
              if (nextPage + 1 < totalPages) {
                packageMenu += "6. Next\n";
              }
              packageMenu += "0. Back";
              
              await updateSession({ current_page: nextPage });
              msg = packageMenu;
              responseOp = "2";
            } else {
              msg = "No more pages.\n0. Back";
              responseOp = "2";
            }
          }
          else if (selection === "7") {
            const prevPage = currentPage - 1;
            if (prevPage >= 0) {
              const start = prevPage * PACKAGES_PER_PAGE;
              const end = start + PACKAGES_PER_PAGE;
              const pagePackages = session.packages.slice(start, end);
              
              let packageMenu = "Select package:\n";
              pagePackages.forEach((pkg: any, idx: number) => {
                packageMenu += `${idx + 1}. ${pkg.size_gb}GB - GHS ${pkg.price.toFixed(2)}\n`;
              });
              
              if (prevPage > 0) packageMenu += `7. Prev\n`;
              packageMenu += "6. Next\n";
              packageMenu += "0. Back";
              
              await updateSession({ current_page: prevPage });
              msg = packageMenu;
              responseOp = "2";
            } else {
              msg = "Already first page.\n0. Back";
              responseOp = "2";
            }
          }
          else if (selection === "0") {
            await updateSession({ step: "select_network" });
            msg = "Select network:\n1. MTN\n2. Telecel\n3. AT\n4. Track Order\n0. Back";
            responseOp = "2";
          }
          else {
            const selectionNum = parseInt(selection);
            const start = currentPage * PACKAGES_PER_PAGE;
            const selectedIndex = start + selectionNum - 1;
            
            if (isNaN(selectionNum) || selectionNum < 1 || selectionNum > PACKAGES_PER_PAGE || selectedIndex >= session.packages.length) {
              msg = "Invalid option. Try again.\n0. Back";
              responseOp = "2";
            } else {
              const selectedPackage = session.packages[selectedIndex];
              await updateSession({
                step: "enter_recipient",
                package_id: selectedPackage.id,
                package_price: selectedPackage.price,
                package_size: selectedPackage.size_gb,
              });
              msg = "Enter recipient number\n(e.g., 024XXXXXXX):";
              responseOp = "2";
            }
          }
        }
        // STEP 4: Enter recipient number - VALIDATE NETWORK MATCHES & CHECK IF FIRST-TIME BUYER
        else if (session.step === "enter_recipient") {
          const recipient = ussdString.trim();
          
          if (!recipient.match(/^0[2-9]\d{8}$/)) {
            msg = "Invalid number.\nEnter recipient (e.g., 024XXXXXXX):";
            responseOp = "2";
          } else {
            const recipientNetwork = detectNetworkFromPhone(recipient);
            const selectedNetwork = session.network;
            
            if (recipientNetwork !== selectedNetwork) {
              const selectedNetworkName = getNetworkDisplayName(selectedNetwork);
              const recipientNetworkName = recipientNetwork === "unknown" ? "unknown network" : getNetworkDisplayName(recipientNetwork);
              
              msg = `This is not a ${selectedNetworkName} number.\nThis looks like ${recipientNetworkName}.\nPlease enter correct number:`;
              responseOp = "2";
            } else {
              // Check if customer exists (first-time buyer check)
              const { data: existingCustomer } = await supabase
                .from("customers")
                .select("id")
                .eq("phone_number", recipient)
                .maybeSingle();

              if (!existingCustomer) {
                // First-time buyer - generate and send OTP
                console.log(`[USSD] First-time buyer detected: ${recipient}`);
                const otp = Math.floor(100000 + Math.random() * 900000).toString();
                
                await updateSession({
                  step: "enter_otp",
                  recipient_number: recipient,
                  otp_code: otp,
                  otp_sent: true,
                  otp_attempts: 0,
                });
                
                msg = `OTP sent to ${recipient}.\nEnter OTP:`;
                responseOp = "2";
                console.log(`[USSD] OTP generated: ${otp}`);
              } else {
                // Returning customer - proceed to confirmation
                console.log(`[USSD] Returning customer: ${recipient}`);
                await updateSession({
                  step: "confirm_payment",
                  recipient_number: recipient,
                });

                const fee = session.package_price * (PAYSTACK_FEE_PERCENT / 100);
                const total = session.package_price + fee;
                
                const displayNetwork = session.network === "mtn" ? "MTN" : 
                                      session.network === "telecel" ? "Telecel" : "AT";

                msg = `Confirm:\n${session.package_size}GB ${displayNetwork}\nGHS ${total.toFixed(2)}\nTo: ${recipient}\n\n1. Pay\n2. Cancel`;
                responseOp = "2";
              }
            }
          }
        }
        // STEP 4.5: Enter OTP (NEW - Only for first-time buyers)
        else if (session.step === "enter_otp") {
          const enteredOtp = ussdString.trim();
          const maxAttempts = 3;
          const attempts = (session.otp_attempts || 0) + 1;
          
          console.log(`[USSD] OTP entry attempt ${attempts}/${maxAttempts}`);
          
          if (enteredOtp === session.otp_code) {
            // OTP correct - create customer and proceed to payment confirmation
            console.log(`[USSD] OTP verified correctly for ${session.recipient_number}`);
            
            // Create new customer record
            const { error: createError } = await supabase
              .from("customers")
              .insert({
                phone_number: session.recipient_number,
                network: session.network,
                created_at: new Date().toISOString(),
              });
            
            if (createError) {
              console.error(`[USSD] Failed to create customer:`, createError);
              msg = "Error processing. Try again.\n0. Back";
              responseOp = "2";
              await updateSession({ step: "enter_recipient" });
            } else {
              await updateSession({
                step: "confirm_payment",
                otp_verified: true,
              });

              const fee = session.package_price * (PAYSTACK_FEE_PERCENT / 100);
              const total = session.package_price + fee;
              
              const displayNetwork = session.network === "mtn" ? "MTN" : 
                                    session.network === "telecel" ? "Telecel" : "AT";

              msg = `Confirm:\n${session.package_size}GB ${displayNetwork}\nGHS ${total.toFixed(2)}\nTo: ${session.recipient_number}\n\n1. Pay\n2. Cancel`;
              responseOp = "2";
            }
          } else if (attempts >= maxAttempts) {
            // Too many failed attempts
            console.log(`[USSD] OTP verification failed - max attempts reached for ${session.recipient_number}`);
            
            msg = `Incorrect OTP. Max attempts reached.\n0. Back`;
            responseOp = "2";
            
            await updateSession({
              step: "enter_recipient",
            });
          } else {
            // Incorrect OTP - allow retry
            const remaining = maxAttempts - attempts;
            console.log(`[USSD] OTP incorrect. Remaining attempts: ${remaining}`);
            
            msg = `Incorrect OTP.\nAttempts remaining: ${remaining}\nEnter OTP:`;
            responseOp = "2";
            
            await updateSession({
              otp_attempts: attempts,
            });
          }
        }
        // STEP 5: Confirm payment - Initiate Paystack Charge
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

            const callerNetwork = session.caller_network || detectNetworkFromPhone(msisdn);
            const provider = getProviderCode(callerNetwork);
            const phoneLocal = formatPhoneForPaystack(msisdn);
            
            console.log(`[USSD] ===== PAYSTACK CHARGE =====`);
            console.log(`[USSD] Caller network: ${callerNetwork}`);
            console.log(`[USSD] Provider code: ${provider}`);
            console.log(`[USSD] Phone: ${phoneLocal}`);
            console.log(`[USSD] Amount: ${amountInPesewas} pesewas`);

            const metadata: any = {
              type: "ussd_purchase",
              package_id: session.package_id,
              package_name: `${session.package_size}GB`,
              network: session.network,
              phone: session.recipient_number,
              customer_msisdn: msisdn,
              base_amount: session.package_price,
              fee_amount: fee,
            };

            if (session.agent_store_id) {
              metadata.agent_store_id = session.agent_store_id;
            }
            
            if (session.subsubagent_store_id) {
              const { data: allPackages, error: pkgError } = await supabase.from("data_packages").select("id, size_gb, network, agent_price").eq("active", true).eq("network", selectedNetwork);
              const { data: customPrices } = await supabase.from("sub_subagent_package_prices").select("package_id, customer_sell_price").eq("sub_subagent_store_id", session.subsubagent_store_id);
              const priceMap = new Map((customPrices || []).map((p: any) => [p.package_id, p.customer_sell_price]));
              if (!pkgError && allPackages) packages = allPackages.map((pkg: any) => ({ id: pkg.id, size_gb: pkg.size_gb, price: priceMap.get(pkg.id) ?? pkg.agent_price }));
            } else if (session.subagent_store_id) {
              metadata.subagent_store_id = session.subagent_store_id;
            }

            const customerEmail = `233${phoneLocal.substring(1)}@ussd.dataplug.store`;

            try {
              const chargePayload = {
                email: customerEmail,
                amount: amountInPesewas,
                currency: "GHS",
                reference: reference,
                mobile_money: {
                  phone: phoneLocal,
                  provider: provider
                },
                metadata: metadata,
              };

              console.log(`[USSD] Paystack payload:`, JSON.stringify(chargePayload));

              const paystackRes = await fetch("https://api.paystack.co/charge", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(chargePayload),
              });

              const result = await paystackRes.json();
              console.log(`[USSD] Paystack response:`, JSON.stringify(result));

              if (!result.status) {
                console.error(`[USSD] Paystack failed:`, result);
                msg = `Failed: ${result.message || "Try again"}`;
                responseOp = "3";
                await deleteSession();
              } else {
                // Payment initiated - tell user to approve
                // For ALL networks, the payment goes to pending approvals
                const approvalSteps = getApprovalInstructions(callerNetwork);
                msg = `Payment sent!\n\nApprove at:\n${approvalSteps}`;
                responseOp = "3";
                await deleteSession();
              }
            } catch (paystackError) {
              console.error(`[USSD] Paystack error:`, paystackError);
              msg = "Service unavailable. Try again.";
              responseOp = "3";
              await deleteSession();
            }
          }
        }
        else {
          msg = "Session expired. Dial again.";
          responseOp = "3";
          await deleteSession();
        }
      }
    }
    else {
      msg = "Error. Please try again.";
      responseOp = "3";
    }

    console.log(`[USSD] Response - op: ${responseOp}, msg: ${msg.substring(0, 50)}...`);
    return sendResponse(sessionID, msg, responseOp, corsHeaders);

  } catch (err) {
    console.error("[USSD] Fatal error:", err);
    return sendResponse("", "Service unavailable.", "3", corsHeaders);
  }
});

function sendResponse(sessionID: string, message: string, ussdServiceOp: string, corsHeaders: any) {
  const responseBody = {
    message: message,
    ussdServiceOp: ussdServiceOp,
    sessionID: sessionID,
  };
  
  console.log(`[USSD] Response body:`, JSON.stringify(responseBody));
  
  return new Response(
    JSON.stringify(responseBody),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
