# AFA Bundle Deploy Edge Function - Quick Start

## 1-Minute Setup

### Step 1: Add Secrets to Supabase
```
Settings → Edge Functions → Add Secret

CLEDANET_API_KEY = <your_api_key_here>
CLEDANET_API_URL = https://api.cledanet.com
```

### Step 2: Deploy Function
```bash
supabase functions deploy afa-bundle-deploy
```

### Step 3: Get Function URL
```
https://your_project_ref.functions.supabase.co/afa-bundle-deploy
```

## How to Call the Function

### Via JavaScript/TypeScript
```typescript
const deployAFABundle = async (packageData) => {
  const response = await fetch(
    'https://your_project.functions.supabase.co/afa-bundle-deploy',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        package_name: 'Premium AFA',
        base_price: 50,
        description: 'Premium agricultural package',
        commission_percent: 15,
      }),
    }
  );

  return await response.json();
};
```

### Via cURL
```bash
curl -X POST https://your_project.functions.supabase.co/afa-bundle-deploy \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "package_name": "Standard AFA",
    "base_price": 35.00,
    "commission_percent": 10
  }'
```

### Via Admin Dashboard (React)
```tsx
import { useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

export function CreateAFAPackage() {
  const supabase = useSupabaseClient();
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.functions.invoke(
      'afa-bundle-deploy',
      {
        body: {
          package_name: e.target.packageName.value,
          base_price: parseFloat(e.target.basePrice.value),
          commission_percent: parseFloat(e.target.commission.value),
        },
      }
    );

    if (error) {
      console.error('Error:', error.message);
    } else {
      console.log('Success:', data);
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleCreate}>
      <input name="packageName" placeholder="Package Name" required />
      <input name="basePrice" type="number" placeholder="Base Price" required />
      <input name="commission" type="number" placeholder="Commission %" />
      <button disabled={loading} type="submit">
        {loading ? 'Creating...' : 'Create Package'}
      </button>
    </form>
  );
}
```

## What Happens When You Call It

1. ✅ Validates your authentication token
2. ✅ Checks required fields (package_name, base_price)
3. ✅ Verifies package doesn't already exist
4. ✅ Calls CLEDANET API to register bundle
5. ✅ Creates record in Supabase afa_packages table
6. ✅ Logs deployment for audit trail
7. ✅ Returns success/error response

## Expected Response

### Success (201 Created)
```json
{
  "success": true,
  "message": "AFA bundle \"Premium AFA\" deployed successfully",
  "package": {
    "id": "uuid-here",
    "name": "Premium AFA",
    "base_price": 50.00,
    "external_id": "cledanet-id-here",
    "created_at": "2024-06-02T12:00:00Z"
  },
  "cledanet_response": {
    "id": "cledanet-id",
    "status": "active"
  }
}
```

### Error (400/409/500)
```json
{
  "error": "Error description",
  "message": "Detailed error message"
}
```

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| Missing authorization header | No Bearer token | Add `Authorization: Bearer TOKEN` header |
| Missing required fields | Missing package_name or base_price | Include both fields in request |
| Already exists | Package with same name | Use unique package name |
| CLEDANET API error | Invalid API key or URL | Check CLEDANET_API_KEY and CLEDANET_API_URL in secrets |
| Timeout | Request takes too long | Check CLEDANET API is responding |

## Test the Function

### Using Supabase Dashboard
1. Go to your project → Edge Functions
2. Click "afa-bundle-deploy"
3. Click "Test" tab
4. Paste this JSON:
```json
{
  "package_name": "Test Package",
  "base_price": 25.00,
  "commission_percent": 10
}
```
5. Click "Send Request"

### Using Terminal
```bash
curl -X POST https://your_project.functions.supabase.co/afa-bundle-deploy \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "package_name": "Test AFA",
    "base_price": 45.00
  }'
```

## View Deployment Logs

### In Supabase Dashboard
1. Project → Edge Functions → afa-bundle-deploy → Logs

### Via CLI
```bash
supabase functions logs afa-bundle-deploy
```

### Query Database
```sql
SELECT * FROM afa_deployment_logs 
ORDER BY deployment_time DESC 
LIMIT 10;
```

## Parameter Reference

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| package_name | string | Yes | Must be unique |
| base_price | number | Yes | Must be > 0 |
| description | string | No | Optional description |
| min_price | number | No | Min price agents can set |
| max_price | number | No | Max price agents can set |
| commission_percent | number | No | Default: 10% |
| is_active | boolean | No | Default: true |

## Next Steps

1. Test the function with a sample request
2. Integrate into Admin Dashboard
3. Connect payment processing
4. Monitor deployment logs regularly
5. Scale based on usage

## Need Help?

- See full guide: `EDGE_FUNCTION_DEPLOYMENT.md`
- Check logs: Supabase Dashboard → Edge Functions → Logs
- Debug with console.log in function code
- Test with curl before integrating into frontend
