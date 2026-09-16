import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'
import { corsHeaders } from '../_shared/cors.ts'

interface AFABundleRequest {
  package_name: string
  base_price: number
  description?: string
  min_price?: number
  max_price?: number
  commission_percent?: number
  is_active?: boolean
}

interface CledanetResponse {
  success: boolean
  data?: {
    id: string
    name: string
    status: string
  }
  error?: string
  message?: string
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify API Key from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = authHeader.substring(7)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const body: AFABundleRequest = await req.json()

    // Validate required fields
    if (!body.package_name || body.base_price === undefined) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: package_name, base_price',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate price
    if (body.base_price <= 0) {
      return new Response(
        JSON.stringify({ error: 'base_price must be greater than 0' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get CLEDANET API credentials from Supabase secrets
    const cledanetApiKey = Deno.env.get('CLEDANET_API_KEY')
    const cledanetApiUrl = Deno.env.get('CLEDANET_API_URL')

    if (!cledanetApiKey || !cledanetApiUrl) {
      throw new Error('Missing CLEDANET API configuration')
    }

    console.log('[AFA Bundle Deploy] Starting deployment for package:', body.package_name)

    // Step 1: Create package in Supabase first
    const { data: existingPackage, error: checkError } = await supabase
      .from('afa_packages')
      .select('id')
      .eq('name', body.package_name)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError
    }

    if (existingPackage) {
      return new Response(
        JSON.stringify({
          error: `Package "${body.package_name}" already exists`,
          package_id: existingPackage.id,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 2: Call CLEDANET API to register the bundle
    const cledanetPayload = {
      name: body.package_name,
      description: body.description || `AFA Bundle: ${body.package_name}`,
      price: body.base_price,
      type: 'afa',
      is_active: body.is_active !== false,
    }

    console.log('[AFA Bundle Deploy] Calling CLEDANET API with payload:', cledanetPayload)

    const cledanetResponse = await fetch(`${cledanetApiUrl}/afa/bundles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cledanetApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(cledanetPayload),
    })

    const cledanetData: CledanetResponse = await cledanetResponse.json()

    if (!cledanetResponse.ok || !cledanetData.success) {
      console.error('[AFA Bundle Deploy] CLEDANET API error:', cledanetData)
      return new Response(
        JSON.stringify({
          error: 'Failed to create bundle on CLEDANET',
          details: cledanetData.error || cledanetData.message,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 3: Create package record in Supabase
    const { data: newPackage, error: insertError } = await supabase
      .from('afa_packages')
      .insert({
        name: body.package_name,
        description: body.description,
        base_price: body.base_price,
        min_price: body.min_price,
        max_price: body.max_price,
        commission_percent: body.commission_percent || 10,
        is_active: body.is_active !== false,
        external_id: cledanetData.data?.id, // Store CLEDANET bundle ID
      })
      .select()
      .single()

    if (insertError) {
      console.error('[AFA Bundle Deploy] Database error:', insertError)
      throw insertError
    }

    console.log('[AFA Bundle Deploy] Package created successfully:', newPackage.id)

    // Step 4: Log deployment in audit table (optional)
    await supabase.from('afa_deployment_logs').insert({
      package_id: newPackage.id,
      package_name: body.package_name,
      cledanet_id: cledanetData.data?.id,
      status: 'deployed',
      base_price: body.base_price,
      deployment_time: new Date().toISOString(),
    }).catch(err => {
      console.warn('[AFA Bundle Deploy] Could not log deployment:', err)
      // Don't fail if audit logging fails
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: `AFA bundle "${body.package_name}" deployed successfully`,
        package: {
          id: newPackage.id,
          name: newPackage.name,
          base_price: newPackage.base_price,
          external_id: cledanetData.data?.id,
          created_at: newPackage.created_at,
        },
        cledanet_response: {
          id: cledanetData.data?.id,
          status: cledanetData.data?.status,
        },
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('[AFA Bundle Deploy] Error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
