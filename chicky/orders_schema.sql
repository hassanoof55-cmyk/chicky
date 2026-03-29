-- Add orders table to Supabase
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    area TEXT NOT NULL,
    location JSONB NOT NULL,
    items JSONB NOT NULL,
    total_price NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL
);

-- RLS policies
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public insert orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Public select orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Public all access" ON orders FOR ALL USING (true);
