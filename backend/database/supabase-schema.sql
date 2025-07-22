-- Supabase Schema for Osoul Collection Reporting System
-- Run this in Supabase SQL Editor

-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create branches table
CREATE TABLE IF NOT EXISTS branches (
    id SERIAL PRIMARY KEY,
    branch_code VARCHAR(50) UNIQUE NOT NULL,
    branch_name VARCHAR(255) NOT NULL,
    region VARCHAR(100),
    city VARCHAR(100),
    manager_id INTEGER REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create collection_transactions table
CREATE TABLE IF NOT EXISTS collection_transactions (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id) NOT NULL,
    transaction_date DATE NOT NULL,
    customer_id VARCHAR(100),
    customer_name VARCHAR(255),
    account_number VARCHAR(100),
    transaction_type VARCHAR(50) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'SAR',
    payment_method VARCHAR(50),
    collector_id INTEGER REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'completed',
    reference_number VARCHAR(100) UNIQUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create collection_targets table
CREATE TABLE IF NOT EXISTS collection_targets (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id) NOT NULL,
    target_month INTEGER NOT NULL,
    target_year INTEGER NOT NULL,
    target_amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'SAR',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(branch_id, target_month, target_year)
);

-- Create user_dashboards table
CREATE TABLE IF NOT EXISTS user_dashboards (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    dashboard_name VARCHAR(255) NOT NULL,
    is_default BOOLEAN DEFAULT false,
    layout_config JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create dashboard_widgets table
CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id SERIAL PRIMARY KEY,
    dashboard_id INTEGER REFERENCES user_dashboards(id) ON DELETE CASCADE,
    widget_type VARCHAR(100) NOT NULL,
    widget_title VARCHAR(255),
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    width INTEGER DEFAULT 4,
    height INTEGER DEFAULT 4,
    config JSONB,
    is_visible BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_collection_transactions_branch_date ON collection_transactions(branch_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_collection_transactions_date ON collection_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_collection_targets_branch_period ON collection_targets(branch_id, target_year, target_month);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_dashboard ON dashboard_widgets(dashboard_id);

-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic policies - adjust based on your needs)
-- For now, we'll create permissive policies that allow authenticated users to access data

-- Users table policies
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid()::text = email);

CREATE POLICY "Admins can view all users" ON users
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM users WHERE email = auth.uid()::text AND role = 'admin'
    ));

-- Branches table policies
CREATE POLICY "Authenticated users can view branches" ON branches
    FOR ALL USING (true);

-- Collection transactions policies
CREATE POLICY "Authenticated users can view transactions" ON collection_transactions
    FOR ALL USING (true);

-- Collection targets policies
CREATE POLICY "Authenticated users can view targets" ON collection_targets
    FOR ALL USING (true);

-- User dashboards policies
CREATE POLICY "Users can manage their own dashboards" ON user_dashboards
    FOR ALL USING (user_id IN (
        SELECT id FROM users WHERE email = auth.uid()::text
    ));

-- Dashboard widgets policies
CREATE POLICY "Users can manage their dashboard widgets" ON dashboard_widgets
    FOR ALL USING (dashboard_id IN (
        SELECT id FROM user_dashboards WHERE user_id IN (
            SELECT id FROM users WHERE email = auth.uid()::text
        )
    ));

-- Insert default admin user (change password in production!)
INSERT INTO users (email, password, first_name, last_name, role)
VALUES ('admin@osoul.com', '$2a$10$rBV2JDeWW3.vKyeQcM8fFO4777l4bVD.rnY8/kaZU6X.5L8HJxqbe', 'Admin', 'User', 'admin')
ON CONFLICT (email) DO NOTHING;