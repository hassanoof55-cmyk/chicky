
-- 1. Create site_settings table for website configuration
CREATE TABLE IF NOT EXISTS site_settings (
    id TEXT PRIMARY KEY DEFAULT 'active_config',
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
    tags TEXT[] DEFAULT '{}'::text[],
    modifiers JSONB DEFAULT '[]'::jsonb
);

-- 3. Create logistics_config table for dedicated zones management
CREATE TABLE IF NOT EXISTS logistics_config (
    id INT8 PRIMARY KEY DEFAULT 1,
    areas JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'open',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    area TEXT,
    location JSONB,
    items JSONB NOT NULL,
    total_price NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending'
);

-- 5. Create promo_codes table
CREATE TABLE IF NOT EXISTS promo_codes (
    code TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    discount_type TEXT NOT NULL,
    discount_value NUMERIC NOT NULL,
    min_order_value NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    applicable_categories JSONB DEFAULT '[]'::jsonb,
    applicable_products JSONB DEFAULT '[]'::jsonb
);

-- 6. Create site_builder table
CREATE TABLE IF NOT EXISTS site_builder (
    id TEXT PRIMARY KEY,
    content JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 7. Enable RLS (Row Level Security)
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_builder ENABLE ROW LEVEL SECURITY;

-- 8. Create Policies for Public Access
CREATE POLICY "Public all access site_settings" ON site_settings FOR ALL USING (true);
CREATE POLICY "Public all access menu_items" ON menu_items FOR ALL USING (true);
CREATE POLICY "Public all access logistics_config" ON logistics_config FOR ALL USING (true);
CREATE POLICY "Public all access orders" ON orders FOR ALL USING (true);
CREATE POLICY "Public all access promo_codes" ON promo_codes FOR ALL USING (true);
CREATE POLICY "Public all access site_builder" ON site_builder FOR ALL USING (true);
