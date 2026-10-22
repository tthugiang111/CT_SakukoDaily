SET search_path TO the_nbt, public;

-- 1. Bổ sung bảng pos_tokens nếu chưa có
CREATE TABLE IF NOT EXISTS pos_tokens (
    id BIGSERIAL PRIMARY KEY,
    store_code VARCHAR(32) NOT NULL,
    device_name VARCHAR(64) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    token_display VARCHAR(32) NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Thêm mẫu một số máy POS Token
INSERT INTO pos_tokens (store_code, device_name, token_hash, token_display, last_seen_at, revoked) VALUES
('XT', 'POS-XT-01 (Quầy chính)', 'hash_xt_01', 'nbt_live_xt01_***', CURRENT_TIMESTAMP - INTERVAL '2 minutes', FALSE),
('XT', 'POS-XT-02 (Quầy phụ)', 'hash_xt_02', 'nbt_live_xt02_***', CURRENT_TIMESTAMP - INTERVAL '4 minutes', FALSE),
('KM', 'POS-KM-01 (Quầy chính)', 'hash_km_01', 'nbt_live_km01_***', CURRENT_TIMESTAMP - INTERVAL '15 minutes', FALSE),
('TB', 'POS-TB-01 (Quầy chính)', 'hash_tb_01', 'nbt_live_tb01_***', CURRENT_TIMESTAMP - INTERVAL '3 hours', FALSE)
ON CONFLICT DO NOTHING;

-- 2. Thêm dữ liệu mẫu violations V01 - V10
INSERT INTO violations (order_no, rule_code, description, customer_phone, store_code, cashier, detected_at) VALUES
('ORD_100234', 'V01', 'Đơn dùng mã NBT không có SĐT khách hàng', NULL, 'XT', 'Lê Thu Trang', CURRENT_TIMESTAMP - INTERVAL '1 hour'),
('ORD_100255', 'V03', 'Khách dùng 2 lần trong 1 ngày (chặn đơn thứ 2)', '0981234567', 'XT', 'Lê Thu Trang', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
('ORD_100289', 'V04', 'Sai loại mã: áp 10K khi mới đạt lượt 2', '0912334455', 'KM', 'Nguyễn Văn Nam', CURRENT_TIMESTAMP - INTERVAL '5 hours'),
('ORD_100312', 'V07', 'Tổng bill sau CTKM dưới 20.000đ (chỉ đạt 18.500đ)', '0977889900', 'XT', 'Trần Hoài An', CURRENT_TIMESTAMP - INTERVAL '1 day'),
('ORD_100344', 'V10', 'Đơn có trên DWH nhưng máy POS-TB-01 thiếu gửi sự kiện', '0933445566', 'TB', 'Phạm Quỳnh', CURRENT_TIMESTAMP - INTERVAL '1 day')
ON CONFLICT DO NOTHING;

-- 3. Tạo một số thẻ ở các nấc phễu khác nhau để xem biểu đồ phễu
INSERT INTO customers (phone, pin_hash, recovery_code_hash, status) VALUES
('0911000001', '$2a$10$abcdef', '$2a$10$abcdef', 'active'),
('0911000002', '$2a$10$abcdef', '$2a$10$abcdef', 'active'),
('0911000003', '$2a$10$abcdef', '$2a$10$abcdef', 'active'),
('0911000004', '$2a$10$abcdef', '$2a$10$abcdef', 'active'),
('0911000005', '$2a$10$abcdef', '$2a$10$abcdef', 'active')
ON CONFLICT (phone) DO NOTHING;

INSERT INTO cards (customer_id, program_id, store_code, purchased_at, usable_from, status, uses_count)
SELECT c.id, 1, 'XT', CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_DATE - INTERVAL '14 days', 'active', 
  CASE c.phone 
    WHEN '0911000001' THEN 8
    WHEN '0911000002' THEN 5
    WHEN '0911000003' THEN 3
    WHEN '0911000004' THEN 1
    ELSE 0 END
FROM customers c WHERE c.phone LIKE '0911%'
ON CONFLICT DO NOTHING;
