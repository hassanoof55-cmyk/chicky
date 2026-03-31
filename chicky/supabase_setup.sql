
-- 1. Create site_settings table for website configuration
CREATE TABLE IF NOT EXISTS site_settings (
    id TEXT PRIMARY KEY,
    config_data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Create menu_items table
CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    nameAr TEXT NOT NULL,
    price NUMERIC NOT NULL,
    originalPrice NUMERIC,
    description TEXT,
    descriptionAr TEXT,
    image TEXT,
    category TEXT NOT NULL,
    isSpicy BOOLEAN DEFAULT false,
    spicinessOption BOOLEAN DEFAULT false,
    hasSizes BOOLEAN DEFAULT false,
    sizes JSONB DEFAULT '[]'::jsonb,
    tags TEXT[] DEFAULT '{}'::text[]
);

-- 3. Enable RLS (Row Level Security)
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies for site_settings (Public access as requested by existing patterns)
CREATE POLICY "Public select site_settings" ON site_settings FOR SELECT USING (true);
CREATE POLICY "Public all access site_settings" ON site_settings FOR ALL USING (true);

-- 5. Create Policies for menu_items
CREATE POLICY "Public select menu_items" ON menu_items FOR SELECT USING (true);
CREATE POLICY "Public all access menu_items" ON menu_items FOR ALL USING (true);

-- 6. Ensure orders table has all access (Full sync with existing orders_schema.sql)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public all access" ON orders;
CREATE POLICY "Public all access orders" ON orders FOR ALL USING (true);

-- 7. Insert initial config if not exists (Optional but helpful)
-- INSERT INTO site_settings (id, config_data) 
-- VALUES ('active_config', '{...}') 
-- ON CONFLICT (id) DO NOTHING;
