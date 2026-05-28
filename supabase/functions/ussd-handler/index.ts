// supabase/functions/ussd-handler/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYSTACK_FEE_PERCENT = 1.98;
const PACKAGES_PER_PAGE = 5;

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

    console.log(`[USSD] Parsed values:`);
    console.log(`  - sessionID: "${sessionID}"`);
    console.log(`  - ussdServiceOp: "${ussdServiceOp}"`);
    console.log(`  - ussdString: "${ussdString}"`);
    console.log(`  - msisdn: "${msisdn}"`);
    console.log(`  - network: "${network}"`);

    if (!sessionID) {
      console.error(`[USSD] ERROR: Missing sessionID!`);
      return sendResponse("", "Technical error. Please try again.", "17", corsHeaders);
    }
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let msg = "";
    let responseOp = "17";

    // START SESSION
    if (ussdServiceOp === "1") {
      console.log(`[USSD] Starting new session: ${sessionID}`);
      
      const newSession = {
        step: "main_menu",
        created_at: Date.now(),
        caller_msisdn: msisdn,
        caller_network: network,
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
      } else {
        console.log(`[USSD] Session saved to database`);
      }
      
      msg = "Welcome to DataPlug\n\n1. Buy MTN Data\n2. Buy Telecel Data\n3. Buy AT Data\n4. Track Order";
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
        responseOp = "17";
      } else if (!sessionData) {
        console.log(`[USSD] WARNING: Session ${sessionID} not found in database!`);
        msg = "Session expired. Please dial again.";
        responseOp = "17";
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
        
        // MAIN MENU - Select network or track order
        if (session.step === "main_menu") {
          const selection = ussdString.trim();
          console.log(`[USSD] Main menu selection: "${selection}"`);
          
          const networkMap: Record<string, string> = {
            "1": "mtn",
            "2": "telecel",
            "3": "airteltigo",
          };
          const selectedNetwork = networkMap[selection];
          
          if (selection === "4") {
            // Track Order
            await updateSession({ step: "enter_tracking_number" });
            msg = "Enter your phone number to track orders:";
            responseOp = "2";
          } else if (!selectedNetwork) {
            msg = "Invalid selection.\n\n1. Buy MTN Data\n2. Buy Telecel Data\n3. Buy AT Data\n4. Track Order";
            responseOp = "2";
          } else {
            console.log(`[USSD] Fetching packages for ${selectedNetwork}`);
            
            // Fetch packages with default prices (no agent)
            const { data, error } = await supabase
              .from("data_packages")
              .select("id, size_gb, price")
              .eq("active", true)
              .eq("network", selectedNetwork)
              .order("size_gb", { ascending: true });
            
            let packages: any[] = [];
            if (!error && data) {
              packages = data.map(pkg => ({
                id: pkg.id,
                size_gb: pkg.size_gb,
                price: pkg.price, // Use customer price
              }));
            }
            
            if (packages.length === 0) {
              msg = "No packages available.\n\n0. Back";
              await updateSession({ step: "no_packages" });
              responseOp = "2";
            } else {
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
                packageMenu += `\n98. Next (1/${totalPages})\n`;
              }
              packageMenu += "0. Back";
              
              msg = packageMenu;
              responseOp = "2";
            }
          }
        }
        // TRACK ORDER - Enter phone number
        else if (session.step === "enter_tracking_number") {
          const phoneInput = ussdString.trim();
          
          if (phoneInput === "0") {
            await updateSession({ step: "main_menu" });
            msg = "Welcome to DataPlug\n\n1. Buy MTN Data\n2. Buy Telecel Data\n3. Buy AT Data\n4. Track Order";
            responseOp = "2";
          } else if (!phoneInput.match(/^0[2-9]\d{8}$/)) {
            msg = "Invalid phone number.\nEnter your phone number (e.g., 024XXXXXXX):\n\n0. Back";
            responseOp = "2";
          } else {
            // Look up recent orders for this phone number
            const { data: orders, error: ordersError } = await supabase
              .from("orders")
              .select("id, size_gb, network, status, fulfillment_status, created_at")
              .eq("customer_number", phoneInput)
              .order("created_at", { ascending: false })
              .limit(5);
            
            if (ordersError || !orders || orders.length === 0) {
              msg = `No orders found for ${phoneInput}.\n\n0. Back to menu`;
              await updateSession({ step: "no_orders" });
              responseOp = "2";
            } else {
              let orderList = `Recent orders for ${phoneInput}:\n\n`;
              orders.forEach((order, idx) => {
                const statusText = order.fulfillment_status === "completed" ? "Delivered" : 
                                   order.fulfillment_status === "failed" ? "Failed" : "Processing";
                const networkName = order.network === "mtn" ? "MTN" : 
                                   order.network === "telecel" ? "Telecel" : "AT";
                orderList += `${idx + 1}. ${order.size_gb}GB ${networkName} - ${statusText}\n`;
              });
              orderList += "\n0. Back to menu";
              
              msg = orderList;
              await updateSession({ step: "view_orders" });
              responseOp = "2";
            }
          }
        }
        // VIEW ORDERS - Back to menu
        else if (session.step === "view_orders" || session.step === "no_orders") {
          if (ussdString === "0") {
            await updateSession({ step: "main_menu" });
            msg = "Welcome to DataPlug\n\n1. Buy MTN Data\n2. Buy Telecel Data\n3. Buy AT Data\n4. Track Order";
            responseOp = "2";
          } else {
            msg = "Press 0 to go back to menu.";
            responseOp = "2";
          }
        }
        // NO PACKAGES - Back
        else if (session.step === "no_packages") {
          if (ussdString === "0") {
            await updateSession({ step: "main_menu" });
            msg = "Welcome to DataPlug\n\n1. Buy MTN Data\n2. Buy Telecel Data\n3. Buy AT Data\n4. Track Order";
            responseOp = "2";
          } else {
            msg = "Press 0 to go back.";
            responseOp = "2";
          }
        }
        // VIEW PACKAGES - Package selection with pagination
        else if (session.step === "view_packages") {
          const selection = ussdString;
          const totalPages = Math.ceil(session.packages.length / PACKAGES_PER_PAGE);
          const currentPage = session.current_page || 0;
          
          if (selection === "98") {
            // Next page
            const nextPage = currentPage + 1;
            if (nextPage < totalPages) {
              const start = nextPage * PACKAGES_PER_PAGE;
              const end = start + PACKAGES_PER_PAGE;
              const pagePackages = session.packages.slice(start, end);
              
              let packageMenu = "Select package:\n";
              pagePackages.forEach((pkg: any, idx: number) => {
                packageMenu += `${idx + 1}. ${pkg.size_gb}GB - GHS ${pkg.price.toFixed(2)}\n`;
              });
              
              packageMenu += `\n97. Previous (${nextPage + 1}/${totalPages})\n`;
              if (nextPage + 1 < totalPages) {
                packageMenu += "98. Next\n";
              }
              packageMenu += "0. Back";
              
              await updateSession({ current_page: nextPage });
              msg = packageMenu;
              responseOp = "2";
            } else {
              // Already on last page, show same page
              const start = currentPage * PACKAGES_PER_PAGE;
              const pagePackages = session.packages.slice(start, start + PACKAGES_PER_PAGE);
              
              let packageMenu = "Select package:\n";
              pagePackages.forEach((pkg: any, idx: number) => {
                packageMenu += `${idx + 1}. ${pkg.size_gb}GB - GHS ${pkg.price.toFixed(2)}\n`;
              });
              
              if (currentPage > 0) packageMenu += `\n97. Previous (${currentPage + 1}/${totalPages})\n`;
              packageMenu += "0. Back";
              
              msg = packageMenu;
              responseOp = "2";
            }
          }
          else if (selection === "97") {
            // Previous page
            const prevPage = currentPage - 1;
            if (prevPage >= 0) {
              const start = prevPage * PACKAGES_PER_PAGE;
              const pagePackages = session.packages.slice(start, start + PACKAGES_PER_PAGE);
              
              let packageMenu = "Select package:\n";
              pagePackages.forEach((pkg: any, idx: number) => {
                packageMenu += `${idx + 1}. ${pkg.size_gb}GB - GHS ${pkg.price.toFixed(2)}\n`;
              });
              
              if (prevPage > 0) packageMenu += `\n97. Previous (${prevPage + 1}/${totalPages})\n`;
              if (prevPage + 1 < totalPages) packageMenu += "98. Next\n";
              packageMenu += "0. Back";
              
              await updateSession({ current_page: prevPage });
              msg = packageMenu;
              responseOp = "2";
            } else {
              // Already on first page
              const pagePackages = session.packages.slice(0, PACKAGES_PER_PAGE);
              
              let packageMenu = "Select package:\n";
              pagePackages.forEach((pkg: any, idx: number) => {
                packageMenu += `${idx + 1}. ${pkg.size_gb}GB - GHS ${pkg.price.toFixed(2)}\n`;
              });
              
              if (totalPages > 1) packageMenu += `\n98. Next (1/${totalPages})\n`;
              packageMenu += "0. Back";
              
              msg = packageMenu;
              responseOp = "2";
            }
          }
          else if (selection === "0") {
            // Back to main menu
            await updateSession({ step: "main_menu" });
            msg = "Welcome to DataPlug\n\n1. Buy MTN Data\n2. Buy Telecel Data\n3. Buy AT Data\n4. Track Order";
            responseOp = "2";
          }
          else {
            // Package selection
            const selectionNum = parseInt(selection);
            const start = currentPage * PACKAGES_PER_PAGE;
            const selectedIndex = start + selectionNum - 1;
            
            if (isNaN(selectionNum) || selectionNum < 1 || selectionNum > PACKAGES_PER_PAGE || selectedIndex >= session.packages.length) {
              const pagePackages = session.packages.slice(start, start + PACKAGES_PER_PAGE);
              
              let packageMenu = "Invalid selection.\nSelect package:\n";
              pagePackages.forEach((pkg: any, idx: number) => {
                packageMenu += `${idx + 1}. ${pkg.size_gb}GB - GHS ${pkg.price.toFixed(2)}\n`;
              });
              
              if (currentPage > 0) packageMenu += `\n97. Previous\n`;
              if (currentPage + 1 < totalPages) packageMenu += "98. Next\n";
              packageMenu += "0. Back";
              
              msg = packageMenu;
              responseOp = "2";
            } else {
              const selectedPackage = session.packages[selectedIndex];
              console.log(`[USSD] Package selected: ${selectedPackage.size_gb}GB at GHS ${selectedPackage.price}`);
              await updateSession({
                step: "enter_recipient",
                package_id: selectedPackage.id,
                package_price: selectedPackage.price,
                package_size: selectedPackage.size_gb,
              });
              msg = "Enter recipient phone number\n(e.g., 024XXXXXXX):";
              responseOp = "2";
            }
          }
        }
        // ENTER RECIPIENT - Phone number input
        else if (session.step === "enter_recipient") {
          const recipient = ussdString.trim();
          
          if (recipient === "0") {
            // Back to package selection
            const totalPages = Math.ceil(session.packages.length / PACKAGES_PER_PAGE);
            const currentPage = session.current_page || 0;
            const start = currentPage * PACKAGES_PER_PAGE;
            const pagePackages = session.packages.slice(start, start + PACKAGES_PER_PAGE);
            
            let packageMenu = "Select package:\n";
            pagePackages.forEach((pkg: any, idx: number) => {
              packageMenu += `${idx + 1}. ${pkg.size_gb}GB - GHS ${pkg.price.toFixed(2)}\n`;
            });
            
            if (currentPage > 0) packageMenu += `\n97. Previous\n`;
            if (currentPage + 1 < totalPages) packageMenu += "98. Next\n";
            packageMenu += "0. Back";
            
            await updateSession({ step: "view_packages" });
            msg = packageMenu;
            responseOp = "2";
          } else if (!recipient.match(/^0[2-9]\d{8}$/)) {
            msg = "Invalid phone number.\nEnter recipient number\n(e.g., 024XXXXXXX):\n\n0. Back";
            responseOp = "2";
          } else {
            await updateSession({
              step: "confirm_payment",
              recipient_number: recipient,
            });

            const fee = session.package_price * (PAYSTACK_FEE_PERCENT / 100);
            const total = session.package_price + fee;
            
            const displayNetwork = session.network === "mtn" ? "MTN" : 
                                  session.network === "telecel" ? "Telecel" : "AT";

            msg = `Confirm purchase:\n\nPackage: ${session.package_size}GB ${displayNetwork}\nPrice: GHS ${session.package_price.toFixed(2)}\nFee: GHS ${fee.toFixed(2)}\nTotal: GHS ${total.toFixed(2)}\nRecipient: ${recipient}\n\n1. Confirm\n2. Cancel`;
            responseOp = "2";
          }
        }
        // CONFIRM PAYMENT - Process payment
        else if (session.step === "confirm_payment") {
          if (ussdString === "2") {
            msg = "Transaction cancelled.\nThank you for using DataPlug!";
            responseOp = "17";
            await deleteSession();
          } else if (ussdString !== "1") {
            const fee = session.package_price * (PAYSTACK_FEE_PERCENT / 100);
            const total = session.package_price + fee;
            msg = `Invalid option.\n\n1. Confirm (GHS ${total.toFixed(2)})\n2. Cancel`;
            responseOp = "2";
          } else {
            // Process payment
            const fee = session.package_price * (PAYSTACK_FEE_PERCENT / 100);
            const totalWithFee = session.package_price + fee;
            const amountInPesewas = Math.round(totalWithFee * 100);
            const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
            const reference = `USS_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

            // Format phone number to international format (233XXXXXXXXX)
            let formattedPhone = msisdn;
            if (msisdn.startsWith("0")) {
              formattedPhone = "233" + msisdn.substring(1);
            } else if (msisdn.startsWith("+233")) {
              formattedPhone = msisdn.substring(1);
            } else if (msisdn.startsWith("+")) {
              formattedPhone = msisdn.substring(1);
            } else if (!msisdn.startsWith("233")) {
              formattedPhone = "233" + msisdn;
            }
            console.log(`[USSD] Formatted phone: ${msisdn} -> ${formattedPhone}`);

            // Provider codes for Ghana Mobile Money USSD Push
            const providerCodes: Record<string, string> = {
              "mtn": "mtn",
              "telecel": "vod",
              "airteltigo": "tgo"
            };
            const provider = providerCodes[session.network] || "mtn";

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

            const customerEmail = `${formattedPhone}@ussd.dataplug.store`;

            console.log(`[USSD] Initiating Paystack charge:`);
            console.log(`  - Amount: GHS ${totalWithFee.toFixed(2)} (${amountInPesewas} pesewas)`);
            console.log(`  - Provider: ${provider}`);
            console.log(`  - Phone: ${formattedPhone}`);
            console.log(`  - Reference: ${reference}`);

            try {
              const chargePayload = {
                email: customerEmail,
                amount: amountInPesewas,
                currency: "GHS",
                reference: reference,
                mobile_money: {
                  phone: formattedPhone,
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
                console.error(`[USSD] Paystack charge failed:`, result);
                msg = `Payment failed.\n${result.message || "Please try again."}\n\nThank you!`;
                responseOp = "17";
                await deleteSession();
              } else {
                const chargeStatus = result.data?.status;
                console.log(`[USSD] Charge status: ${chargeStatus}`);
                
                // Store reference for webhook
                await updateSession({
                  step: "payment_pending",
                  payment_reference: result.data?.reference || reference,
                  payment_initiated_at: Date.now(),
                });

                // Show payment instructions to user
                msg = `A payment prompt will be sent to your phone shortly.\n\nIf the prompt does not appear:\nDial *170#\n> Select Wallet\n> Choose My Approvals\n> Approve the transaction.\n\nThank you for using DataPlug!`;
                responseOp = "17";
                await deleteSession();
              }
            } catch (paystackError) {
              console.error(`[USSD] Paystack error:`, paystackError);
              msg = "Payment service unavailable.\nPlease try again later.";
              responseOp = "17";
              await deleteSession();
            }
          }
        }
        else {
          msg = "Session expired.\nPlease dial again.";
          responseOp = "17";
          await deleteSession();
        }
      }
    }
    else {
      msg = "An error occurred.\nPlease try again.";
      responseOp = "17";
    }

    console.log(`[USSD] Sending response - sessionID: "${sessionID}", op: ${responseOp}`);
    return sendResponse(sessionID, msg, responseOp, corsHeaders);

  } catch (err) {
    console.error("[USSD] Fatal error:", err);
    return sendResponse("", "Service unavailable.\nPlease try again later.", "17", corsHeaders);
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
