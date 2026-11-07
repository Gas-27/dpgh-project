-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  phone_number VARCHAR(20),
  country VARCHAR(100),
  city VARCHAR(100),
  address TEXT,
  profile_picture_url TEXT,
  total_purchases DECIMAL(15, 2) DEFAULT 0.00,
  total_orders INT DEFAULT 0,
  last_purchase_date TIMESTAMP,
  customer_since TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone_number);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own customer profile
CREATE POLICY "Users can view own customer profile" ON customers
  FOR SELECT USING (auth.uid() = user_id);

-- RLS Policy: Admins can view all customer profiles
CREATE POLICY "Admins can view all customers" ON customers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_permissions 
      WHERE user_id = auth.uid() 
      AND admin_permissions.user_id = auth.uid()
    )
  );

-- RLS Policy: Admins can update customer records
CREATE POLICY "Admins can update customers" ON customers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM admin_permissions 
      WHERE user_id = auth.uid() 
      AND admin_permissions.user_id = auth.uid()
    )
  );

-- RLS Policy: Users can update their own profile
CREATE POLICY "Users can update own profile" ON customers
  FOR UPDATE USING (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customers_updated_at_trigger
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION update_customers_updated_at();

-- Create function to sync customer data when user purchases
CREATE OR REPLACE FUNCTION update_customer_purchase_stats(
  p_user_id UUID,
  p_purchase_amount DECIMAL
) RETURNS VOID AS $$
BEGIN
  UPDATE customers
  SET 
    total_purchases = total_purchases + p_purchase_amount,
    total_orders = total_orders + 1,
    last_purchase_date = CURRENT_TIMESTAMP
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Insert a customer record for each existing user (if they don't have one)
INSERT INTO customers (user_id, email)
SELECT id, email FROM auth.users
WHERE id NOT IN (SELECT user_id FROM customers)
ON CONFLICT (user_id) DO NOTHING;
