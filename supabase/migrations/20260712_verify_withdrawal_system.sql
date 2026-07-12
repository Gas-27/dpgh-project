-- Comprehensive verification and debugging script for withdrawal system
-- This script verifies that all necessary tables exist and have proper data

-- =============================================
-- 1. VERIFY payout_requests TABLE EXISTS
-- =============================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'payout_requests'
  ) THEN
    RAISE EXCEPTION 'payout_requests table does not exist! This is critical - withdrawals cannot be tracked.';
  END IF;
END $$;

-- Check payout_requests columns
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'payout_requests' 
ORDER BY ordinal_position;

-- =============================================
-- 2. VERIFY transfer_recipients TABLE EXISTS
-- =============================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'transfer_recipients'
  ) THEN
    RAISE EXCEPTION 'transfer_recipients table does not exist! Recipient management will fail.';
  END IF;
END $$;

-- Check transfer_recipients columns
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'transfer_recipients' 
ORDER BY ordinal_position;

-- =============================================
-- 3. VERIFY subagent_stores HAS NECESSARY COLUMNS
-- =============================================
-- Check if wallet_balance exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'subagent_stores' AND column_name = 'wallet_balance'
  ) THEN
    ALTER TABLE public.subagent_stores ADD COLUMN wallet_balance numeric DEFAULT 0;
  END IF;
END $$;

-- Check if last_withdrawal_at exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'subagent_stores' AND column_name = 'last_withdrawal_at'
  ) THEN
    ALTER TABLE public.subagent_stores ADD COLUMN last_withdrawal_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
  END IF;
END $$;

-- =============================================
-- 4. VERIFY agent_stores HAS NECESSARY COLUMNS
-- =============================================
-- Check if wallet_balance exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'agent_stores' AND column_name = 'wallet_balance'
  ) THEN
    ALTER TABLE public.agent_stores ADD COLUMN wallet_balance numeric DEFAULT 0;
  END IF;
END $$;

-- Check if last_withdrawal_at exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'agent_stores' AND column_name = 'last_withdrawal_at'
  ) THEN
    ALTER TABLE public.agent_stores ADD COLUMN last_withdrawal_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
  END IF;
END $$;

-- =============================================
-- 5. LIST ALL PAYOUT REQUESTS (for debugging)
-- =============================================
-- Show all payout requests
SELECT 
  id,
  requester_type,
  requester_id,
  amount,
  source_balance_before,
  source_balance_after,
  status,
  transfer_code,
  failure_reason,
  created_at,
  completed_at
FROM public.payout_requests
ORDER BY created_at DESC
LIMIT 20;

-- =============================================
-- 6. CHECK CURRENT WALLET BALANCES
-- =============================================
-- Subagent wallet balances
SELECT 
  id,
  store_name,
  wallet_balance,
  last_withdrawal_at,
  created_at
FROM public.subagent_stores
ORDER BY created_at DESC;

-- Agent wallet balances
SELECT 
  id,
  store_name,
  wallet_balance,
  last_withdrawal_at,
  created_at
FROM public.agent_stores
ORDER BY created_at DESC;
