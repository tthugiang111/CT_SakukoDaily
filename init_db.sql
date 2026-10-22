-- Schema cho Web Thẻ NBT
CREATE SCHEMA IF NOT EXISTS the_nbt;

SET search_path TO the_nbt, public;

-- 1. Bảng Khách hàng
CREATE TABLE IF NOT EXISTS customers (
    id BIGSERIAL PRIMARY KEY,
    phone VARCHAR(15) UNIQUE NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    recovery_code_hash VARCHAR(255) NOT NULL,
    must_change_pin BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active', -- active, locked
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng Cửa hàng áp dụng
CREATE TABLE IF NOT EXISTS stores (
    store_code VARCHAR(32) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bảng Chương trình Thẻ NBT
CREATE TABLE IF NOT EXISTS programs (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    stop_sale_date DATE NOT NULL,
    card_price NUMERIC(15,2) DEFAULT 10000,
    item_code VARCHAR(64) NOT NULL,
    barcode VARCHAR(64) NOT NULL,
    voucher_5k VARCHAR(64) NOT NULL,
    voucher_10k VARCHAR(64) NOT NULL,
    aov_min NUMERIC(15,2) DEFAULT 20000,
    status VARCHAR(20) DEFAULT 'active', -- draft, active, stop_sale, expired
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Bảng Cửa hàng tham gia chương trình
CREATE TABLE IF NOT EXISTS program_stores (
    program_id BIGINT REFERENCES programs(id) ON DELETE CASCADE,
    store_code VARCHAR(32) REFERENCES stores(store_code) ON DELETE CASCADE,
    PRIMARY KEY (program_id, store_code)
);

-- 5. Bảng Thẻ của Khách (Cards)
CREATE TABLE IF NOT EXISTS cards (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT REFERENCES customers(id) ON DELETE CASCADE,
    program_id BIGINT REFERENCES programs(id),
    order_no VARCHAR(64),
    store_code VARCHAR(32),
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    usable_from DATE NOT NULL,
    status VARCHAR(30) DEFAULT 'pending_active', -- pending_active, active, used_up, cancelled, expired
    uses_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Bảng Lịch sử sử dụng voucher (Redemptions)
CREATE TABLE IF NOT EXISTS redemptions (
    id BIGSERIAL PRIMARY KEY,
    card_id BIGINT REFERENCES cards(id) ON DELETE CASCADE,
    customer_id BIGINT REFERENCES customers(id),
    use_no INT NOT NULL, -- 1 đến 10
    voucher_code VARCHAR(64) NOT NULL,
    discount NUMERIC(15,2) NOT NULL,
    order_no VARCHAR(64),
    store_code VARCHAR(32),
    cashier VARCHAR(64),
    used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(20) DEFAULT 'web', -- web, pos_event, n1
    valid BOOLEAN DEFAULT TRUE,
    violation_codes VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Bảng Quản trị viên (Admin Users)
CREATE TABLE IF NOT EXISTS admin_users (
    id BIGSERIAL PRIMARY KEY,
    lark_open_id VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(32) DEFAULT 'admin_ho', -- admin_ho, store_manager
    store_code VARCHAR(32),
    status VARCHAR(20) DEFAULT 'active', -- active, locked
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Bảng Nhật ký kiểm toán (Audit Logs)
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    target VARCHAR(64),
    detail TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Dữ liệu mẫu khởi tạo (Stores & Program)
INSERT INTO stores (store_code, name) VALUES 
('XT', 'Sakuko Xuân Thủy'),
('KM', 'Sakuko Kim Mã'),
('TB', 'Sakuko Thái Hà')
ON CONFLICT (store_code) DO NOTHING;

INSERT INTO programs (
    name, description, start_date, end_date, stop_sale_date, 
    card_price, item_code, barcode, voucher_5k, voucher_10k, aov_min, status
) VALUES (
    'Chương trình Thẻ NBT Pilot Xuân Thủy',
    'Thẻ ảo NBT ưu đãi 10 lượt mua sắm tiết kiệm tại Sakuko',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '60 days',
    CURRENT_DATE + INTERVAL '40 days',
    10000,
    'SP_NBT_XUANTHUY',
    '8936000000018',
    'DAILY5K',
    'DAILY10K',
    20000,
    'active'
) ON CONFLICT DO NOTHING;

-- Map program to stores
INSERT INTO program_stores (program_id, store_code)
SELECT p.id, s.store_code 
FROM programs p, stores s 
WHERE p.item_code = 'SP_NBT_XUANTHUY'
ON CONFLICT DO NOTHING;

-- Admin mặc định
INSERT INTO admin_users (lark_open_id, name, email, role, status) VALUES 
('ou_45760cf4c58e0ab0217683d64cd36f65', 'Chị Giang Admin', 'giangnt@sakuko.com.vn', 'admin_ho', 'active')
ON CONFLICT (lark_open_id) DO NOTHING;
