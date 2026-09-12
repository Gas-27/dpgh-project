# AFA Bundle Deploy Edge Function - Deployment Guide

## Overview

The `afa-bundle-deploy` Edge Function is a serverless function that:
- Creates new AFA packages in your Supabase database
- Registers them with CLEDANET API
- Validates data before deployment
- Logs all deployments for auditing
- Handles errors gracefully

## Prerequisites

1. Supabase project with CLI installed
2. CLEDANET API credentials:
   - API Key (CLEDANET_API_KEY)
   - API URL (CLEDANET_API_URL)
3. Admin access to your Supabase project

## Step 1: Set Environment Variables in Supabase

Go to your Supabase project → Settings → Edge Functions Secrets

Add these secrets:
```
CLEDANET_API_KEY = your_actual_api_key_from_cledanet
CLEDANET_API_URL = https://api.cledanet.com (or your provider's URL)
```

## Step 2: Deploy the Edge Function

Using Supabase CLI:

```bash
# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your_project_ref

# Deploy the function
supabase functions deploy afa-bundle-deploy
```

Or using Vercel:
```bash
# The function is already in supabase/functions/afa-bundle-deploy/
# Push to your repository and it will deploy automatically
```

## Step 3: Get Your Function URL

After deployment, your function URL will be:
```
https://your_project_ref.functions.supabase.co/afa-bundle-deploy
```

## How to Use the Function

### Request Example

```bash
curl -X POST https://your_project_ref.functions.supabase.co/afa-bundle-deploy \
  -H "Authorization: Bearer your_admin_token" \
  -H "Content-Type: application/json" \
  -d '{
    "package_name": "Premium AFA",
    "base_price": 50.00,
    "description": "Premium agricultural financing package",
    "min_price": 45.00,
    "max_price": 60.00,
    "commission_percent": 15,
    "is_active": true
  }'
```

### Request Body Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| package_name | string | Yes | Unique name for the AFA package |
| base_price | number | Yes | Base price set by admin (e.g., 50.00) |
| description | string | No | Package description |
| min_price | number | No | Minimum price agents can set |
| max_price | number | No | Maximum price agents can set |
| commission_percent | number | No | Commission percentage (default: 10) |
| is_active | boolean | No | Whether package is active (default: true) |

### Success Response (201)

```json
{
  "success": true,
  "message": "AFA bundle \"Premium AFA\" deployed successfully",
  "package": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Premium AFA",
    "base_price": 50.00,
    "external_id": "cledanet_bundle_123",
    "created_at": "2024-06-02T12:00:00Z"
  },
  "cledanet_response": {
    "id": "cledanet_bundle_123",
    "status": "active"
  }
}
```

### Error Responses

**400 - Missing Required Fields**
```json
{
  "error": "Missing required fields: package_name, base_price"
}
```

**401 - Unauthorized**
```json
{
  "error": "Missing or invalid authorization header"
}
```

**409 - Package Already Exists**
```json
{
  "error": "Package \"Premium AFA\" already exists",
  "package_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**500 - Server Error**
```json
{
  "error": "Internal server error",
  "message": "Detailed error message"
}
```

## Integration with Frontend

### Using in AdminDashboard

```tsx
import { useAuth } from '@/hooks/useAuth'; // or your auth hook
import { useToast } from '@/hooks/use-toast';

export function DeployAFABundle() {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleDeploy = async (formData: {
    package_name: string;
    base_price: number;
    description?: string;
  }) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/afa-bundle-deploy`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to deploy package');
      }

      toast({
        title: 'Success',
        description: `Package "${data.package.name}" deployed successfully!`,
      });

      // Refresh packages list
      refetchPackages();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    // Your form UI here
  );
}
```

## Monitoring and Debugging

### View Function Logs

```bash
# Using Supabase CLI
supabase functions logs afa-bundle-deploy

# Or in Supabase Dashboard:
# Project → Edge Functions → afa-bundle-deploy → Logs tab
```

### Check Deployment Status

```bash
# List all functions
supabase functions list

# Check specific function
supabase functions inspect afa-bundle-deploy
```

### Query Deployment Logs

```sql
-- View all AFA package deployments
SELECT * FROM public.afa_deployment_logs
ORDER BY deployment_time DESC;

-- View recent deployments
SELECT package_name, status, base_price, deployment_time
FROM public.afa_deployment_logs
WHERE deployment_time > now() - interval '24 hours'
ORDER BY deployment_time DESC;
```

## What the Function Does Step-by-Step

1. **Validates Authorization**: Checks Bearer token in header
2. **Validates Input**: Ensures required fields are present and valid
3. **Checks Duplicate**: Prevents creating packages with same name
4. **Calls CLEDANET API**: Registers bundle with CLEDANET provider
5. **Creates Database Record**: Stores package in afa_packages table
6. **Logs Deployment**: Records audit trail in afa_deployment_logs
7. **Returns Response**: Sends success/error response to client

## Troubleshooting

### Function Not Found (404)
- Verify function was deployed: `supabase functions list`
- Check function name is exactly: `afa-bundle-deploy`
- Wait a few seconds after deployment

### Authorization Failed (401)
- Ensure Bearer token is valid and not expired
- Token must be from authenticated user with admin role
- Check token format: `Bearer <token>`

### CLEDANET API Error
- Verify CLEDANET_API_KEY is correct in Supabase secrets
- Check CLEDANET_API_URL is correct (e.g., https://api.cledanet.com)
- Ensure your CLEDANET account has API access enabled

### Package Already Exists (409)
- Choose a unique package name
- Or update existing package via separate API

### Database Connection Error
- Verify Supabase URL and SERVICE_ROLE_KEY are set
- Check Supabase project is accessible
- Ensure afa_packages table exists (run SUPABASE_SETUP.sql)

## Performance Tips

- Function timeout: 30 seconds (sufficient for most cases)
- Memory: 256MB (adequate for this workload)
- For bulk deployments: Use a queue or batch processor
- Cache responses client-side to reduce API calls

## Security Notes

- Function requires Bearer token (authentication)
- CLEDANET API key stored in Supabase Secrets (not in code)
- RLS policies on afa_packages restrict admin-only operations
- All requests logged for audit trail
- Input validation prevents SQL injection
- CORS enabled for cross-origin requests

## Next Steps

1. Deploy this function to your Supabase project
2. Update AdminDashboard to use this function for package creation
3. Test with a sample package deployment
4. Monitor logs and deployment success rate
5. Integrate with payment processing

## Support

For issues or questions:
- Check Supabase Edge Functions documentation: https://supabase.com/docs/guides/functions
- Review function logs in Supabase dashboard
- Verify environment variables are set correctly
- Test function with curl before integrating into frontend
