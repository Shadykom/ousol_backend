-- Drop existing tables if they exist
DROP TABLE IF EXISTS collection_transactions CASCADE;
DROP TABLE IF EXISTS collection_targets CASCADE;
DROP TABLE IF EXISTS dashboard_widgets CASCADE;
DROP TABLE IF EXISTS user_dashboards CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
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
CREATE TABLE branches (
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
CREATE TABLE collection_transactions (
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
CREATE TABLE collection_targets (
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
CREATE TABLE user_dashboards (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    dashboard_name VARCHAR(255) NOT NULL,
    is_default BOOLEAN DEFAULT false,
    layout_config JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create dashboard_widgets table
CREATE TABLE dashboard_widgets (
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
CREATE INDEX idx_collection_transactions_branch_date ON collection_transactions(branch_id, transaction_date);
CREATE INDEX idx_collection_transactions_date ON collection_transactions(transaction_date);
CREATE INDEX idx_collection_targets_branch_period ON collection_targets(branch_id, target_year, target_month);
CREATE INDEX idx_dashboard_widgets_dashboard ON dashboard_widgets(dashboard_id);

-- Create views for reporting
CREATE VIEW monthly_collection_summary AS
SELECT 
    b.id as branch_id,
    b.branch_name,
    b.branch_code,
    DATE_TRUNC('month', ct.transaction_date) as month,
    COUNT(DISTINCT ct.id) as transaction_count,
    SUM(ct.amount) as total_collected,
    COUNT(DISTINCT ct.customer_id) as unique_customers,
    AVG(ct.amount) as avg_transaction_amount
FROM collection_transactions ct
JOIN branches b ON ct.branch_id = b.id
WHERE ct.status = 'completed'
GROUP BY b.id, b.branch_name, b.branch_code, DATE_TRUNC('month', ct.transaction_date);

CREATE VIEW quarterly_collection_summary AS
SELECT 
    b.id as branch_id,
    b.branch_name,
    b.branch_code,
    DATE_TRUNC('quarter', ct.transaction_date) as quarter,
    COUNT(DISTINCT ct.id) as transaction_count,
    SUM(ct.amount) as total_collected,
    COUNT(DISTINCT ct.customer_id) as unique_customers,
    AVG(ct.amount) as avg_transaction_amount
FROM collection_transactions ct
JOIN branches b ON ct.branch_id = b.id
WHERE ct.status = 'completed'
GROUP BY b.id, b.branch_name, b.branch_code, DATE_TRUNC('quarter', ct.transaction_date);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collection_transactions_updated_at BEFORE UPDATE ON collection_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collection_targets_updated_at BEFORE UPDATE ON collection_targets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_dashboards_updated_at BEFORE UPDATE ON user_dashboards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_widgets_updated_at BEFORE UPDATE ON dashboard_widgets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();