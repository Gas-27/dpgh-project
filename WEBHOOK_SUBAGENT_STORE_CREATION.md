# Webhook Code for Subagent Store Creation After Payment

## Location in Paystack Webhook:
Add this code **AFTER line 259** (after the subagent registration payment handler returns) and **BEFORE line 261** (before the AFA registration handler).

---

## CODE TO ADD:

```typescript
    // =====================================
    // SUBAGENT STORE CREATION AFTER PAYMENT
    // =====================================
    const isSubagentStoreCreation =
      paymentType === "subagent_registration_fee" ||
      paymentType === "subagent_registration_no_fee" ||
      (metadata?.create_approved_store === true);

    if (isSubagentStoreCreation && !isSubagentRegistration) {
      console.log(`[SUBAGENT STORE CREATION] === STARTING ===`);

      const userId = metadata.user_id;
      const agentStoreId = metadata.agent_store_id;
      const storeName = metadata.store_name;
      const storeData = metadata.store_data;

      if (!userId || !agentStoreId || !storeName || !storeData) {
        console.error(`[SUBAGENT STORE CREATION] Missing required data`);
        return new Response(JSON.stringify({ error: "Missing store creation data" }), {
          status: 400, headers: corsHeaders,
        });
      }

      // Check if store already exists
      const { data: existingStore } = await supabaseClient
        .from("subagent_stores")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingStore) {
        console.log(`[SUBAGENT STORE CREATION] Store already exists for user ${userId}`);
        return new Response(
          JSON.stringify({ 
            message: "Store already created",
            store_id: existingStore.id,
            store_url: `${Deno.env.get("SUPABASE_URL")?.replace("https://", "").split(".")[0]}.subagentstore.shop/${storeName}`
          }),
          { status: 200, headers: corsHeaders }
        );
      }

      try {
        // Create subagent store with approved: true (payment already completed)
        const { data: newStore, error: storeError } = await supabaseClient
          .from("subagent_stores")
          .insert({
            user_id: userId,
            agent_store_id: agentStoreId,
            store_name: storeName,
            whatsapp_number: storeData.whatsapp_number || storeData.whatsappNumber || "",
            support_number: storeData.support_number || storeData.supportNumber || "",
            momo_name: storeData.momo_name || storeData.momoName || "",
            momo_number: storeData.momo_number || storeData.momoNumber || "",
            momo_network: storeData.momo_network || storeData.momoNetwork || "mtn",
            wallet_balance: 0,
            approved: true, // ALWAYS approved after payment
            payment_reference: reference,
          })
          .select()
          .single();

        if (storeError) {
          console.error(`[SUBAGENT STORE CREATION] Failed to create store:`, storeError);
          return new Response(JSON.stringify({ error: "Failed to create store" }), {
            status: 500, headers: corsHeaders,
          });
        }

        console.log(`[SUBAGENT STORE CREATION] ✅ Store created:`, newStore.id);

        // Mark registration as completed
        if (metadata.subagent_registration_id) {
          await supabaseClient
            .from("subagent_registrations")
            .update({
              status: "completed",
              payment_status: "paid",
              store_id: newStore.id,
            })
            .eq("id", metadata.subagent_registration_id);
        }

        const storeUrl = `https://${storeName}.subagentstore.shop`;

        console.log(`[SUBAGENT STORE CREATION] === COMPLETED ===`);

        return new Response(
          JSON.stringify({
            message: "Subagent store created successfully",
            store_id: newStore.id,
            user_id: userId,
            store_url: storeUrl,
            redirect_url: storeUrl,
          }),
          { status: 200, headers: corsHeaders }
        );
      } catch (err) {
        console.error(`[SUBAGENT STORE CREATION] Error:`, err);
        return new Response(JSON.stringify({ error: "Failed to create store" }), {
          status: 500, headers: corsHeaders,
        });
      }
    }
```

---

## EXACT LOCATION TO INSERT:

**Find this section in your webhook (around line 259):**
```typescript
      return new Response(
        JSON.stringify({
          message: "Subagent registration payment processed successfully",
          ...
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // =====================================
    // AFA REGISTRATION PAYMENT HANDLER    <-- INSERT BEFORE THIS LINE
    // =====================================
```

---

## Summary of Changes:

1. **SubagentRegistrationForm.tsx** - Now only creates user account, doesn't create the store
2. **Paystack Webhook** - New handler that creates the subagent_stores record with `approved: true` after payment completes
3. **Redirect** - After payment, agent is redirected to their subagent storefront URL

The store is created **only after successful payment**, fixing your `approved_always_true` constraint error.
