-- ============================================================================
-- Migration 025: Performance Indexes
-- Adds database indexes for common query patterns to reduce backend load.
-- Uses MySQL 5.7+ compatible syntax.
-- ============================================================================

-- Helper: Create index if not exists (MySQL 5.7 compatible)
SET @db = DATABASE();

-- Items: department lookups + low-stock queries
SET @idx1 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'items' AND INDEX_NAME = 'idx_items_department_id');
SET @sql1 = IF(@idx1 = 0, 'CREATE INDEX idx_items_department_id ON items(department_id)', 'SELECT 1');
PREPARE stmt1 FROM @sql1; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;

SET @idx2 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'items' AND INDEX_NAME = 'idx_items_category');
SET @sql2 = IF(@idx2 = 0, 'CREATE INDEX idx_items_category ON items(category)', 'SELECT 1');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

SET @idx3 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'items' AND INDEX_NAME = 'idx_items_quantity_minimum');
SET @sql3 = IF(@idx3 = 0, 'CREATE INDEX idx_items_quantity_minimum ON items(quantity, minimum_stock)', 'SELECT 1');
PREPARE stmt3 FROM @sql3; EXECUTE stmt3; DEALLOCATE PREPARE stmt3;

-- Stock In: date-based lookups
SET @idx4 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'stock_in' AND INDEX_NAME = 'idx_stock_in_date');
SET @sql4 = IF(@idx4 = 0, 'CREATE INDEX idx_stock_in_date ON stock_in(date)', 'SELECT 1');
PREPARE stmt4 FROM @sql4; EXECUTE stmt4; DEALLOCATE PREPARE stmt4;

SET @idx5 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'stock_in' AND INDEX_NAME = 'idx_stock_in_item_id');
SET @sql5 = IF(@idx5 = 0, 'CREATE INDEX idx_stock_in_item_id ON stock_in(item_id)', 'SELECT 1');
PREPARE stmt5 FROM @sql5; EXECUTE stmt5; DEALLOCATE PREPARE stmt5;

SET @idx6 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'stock_in' AND INDEX_NAME = 'idx_stock_in_department_id');
SET @sql6 = IF(@idx6 = 0, 'CREATE INDEX idx_stock_in_department_id ON stock_in(department_id)', 'SELECT 1');
PREPARE stmt6 FROM @sql6; EXECUTE stmt6; DEALLOCATE PREPARE stmt6;

-- Stock Out: date-based lookups
SET @idx7 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'stock_out' AND INDEX_NAME = 'idx_stock_out_date');
SET @sql7 = IF(@idx7 = 0, 'CREATE INDEX idx_stock_out_date ON stock_out(date)', 'SELECT 1');
PREPARE stmt7 FROM @sql7; EXECUTE stmt7; DEALLOCATE PREPARE stmt7;

SET @idx8 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'stock_out' AND INDEX_NAME = 'idx_stock_out_item_id');
SET @sql8 = IF(@idx8 = 0, 'CREATE INDEX idx_stock_out_item_id ON stock_out(item_id)', 'SELECT 1');
PREPARE stmt8 FROM @sql8; EXECUTE stmt8; DEALLOCATE PREPARE stmt8;

SET @idx9 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'stock_out' AND INDEX_NAME = 'idx_stock_out_department_id');
SET @sql9 = IF(@idx9 = 0, 'CREATE INDEX idx_stock_out_department_id ON stock_out(department_id)', 'SELECT 1');
PREPARE stmt9 FROM @sql9; EXECUTE stmt9; DEALLOCATE PREPARE stmt9;

-- Borrowings: status + borrower lookups
SET @idx10 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'borrowings' AND INDEX_NAME = 'idx_borrowings_status');
SET @sql10 = IF(@idx10 = 0, 'CREATE INDEX idx_borrowings_status ON borrowings(status)', 'SELECT 1');
PREPARE stmt10 FROM @sql10; EXECUTE stmt10; DEALLOCATE PREPARE stmt10;

SET @idx11 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'borrowings' AND INDEX_NAME = 'idx_borrowings_borrower_id');
SET @sql11 = IF(@idx11 = 0, 'CREATE INDEX idx_borrowings_borrower_id ON borrowings(borrower_id)', 'SELECT 1');
PREPARE stmt11 FROM @sql11; EXECUTE stmt11; DEALLOCATE PREPARE stmt11;

SET @idx12 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'borrowings' AND INDEX_NAME = 'idx_borrowings_item_id');
SET @sql12 = IF(@idx12 = 0, 'CREATE INDEX idx_borrowings_item_id ON borrowings(item_id)', 'SELECT 1');
PREPARE stmt12 FROM @sql12; EXECUTE stmt12; DEALLOCATE PREPARE stmt12;

-- Returns: borrowing lookups
SET @idx13 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'returns' AND INDEX_NAME = 'idx_returns_borrowing_id');
SET @sql13 = IF(@idx13 = 0, 'CREATE INDEX idx_returns_borrowing_id ON returns(borrowing_id)', 'SELECT 1');
PREPARE stmt13 FROM @sql13; EXECUTE stmt13; DEALLOCATE PREPARE stmt13;

-- Requests: status + requester lookups
SET @idx14 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'requests' AND INDEX_NAME = 'idx_requests_status');
SET @sql14 = IF(@idx14 = 0, 'CREATE INDEX idx_requests_status ON requests(status)', 'SELECT 1');
PREPARE stmt14 FROM @sql14; EXECUTE stmt14; DEALLOCATE PREPARE stmt14;

SET @idx15 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'requests' AND INDEX_NAME = 'idx_requests_requester_id');
SET @sql15 = IF(@idx15 = 0, 'CREATE INDEX idx_requests_requester_id ON requests(requester_id)', 'SELECT 1');
PREPARE stmt15 FROM @sql15; EXECUTE stmt15; DEALLOCATE PREPARE stmt15;

-- Damage Liabilities: status + type lookups
SET @idx16 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'damage_liabilities' AND INDEX_NAME = 'idx_damage_liabilities_status');
SET @sql16 = IF(@idx16 = 0, 'CREATE INDEX idx_damage_liabilities_status ON damage_liabilities(status)', 'SELECT 1');
PREPARE stmt16 FROM @sql16; EXECUTE stmt16; DEALLOCATE PREPARE stmt16;

SET @idx17 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'damage_liabilities' AND INDEX_NAME = 'idx_damage_liabilities_type');
SET @sql17 = IF(@idx17 = 0, 'CREATE INDEX idx_damage_liabilities_type ON damage_liabilities(liability_type)', 'SELECT 1');
PREPARE stmt17 FROM @sql17; EXECUTE stmt17; DEALLOCATE PREPARE stmt17;

-- Activity Logs: created_at for recent activities
SET @idx18 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'activity_logs' AND INDEX_NAME = 'idx_activity_logs_created_at');
SET @sql18 = IF(@idx18 = 0, 'CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC)', 'SELECT 1');
PREPARE stmt18 FROM @sql18; EXECUTE stmt18; DEALLOCATE PREPARE stmt18;

SET @idx19 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'activity_logs' AND INDEX_NAME = 'idx_activity_logs_user_id');
SET @sql19 = IF(@idx19 = 0, 'CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id)', 'SELECT 1');
PREPARE stmt19 FROM @sql19; EXECUTE stmt19; DEALLOCATE PREPARE stmt19;

-- Budgets: fiscal year lookups
SET @idx20 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'budgets' AND INDEX_NAME = 'idx_budgets_fiscal_year');
SET @sql20 = IF(@idx20 = 0, 'CREATE INDEX idx_budgets_fiscal_year ON budgets(fiscal_year)', 'SELECT 1');
PREPARE stmt20 FROM @sql20; EXECUTE stmt20; DEALLOCATE PREPARE stmt20;

SET @idx21 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'budgets' AND INDEX_NAME = 'idx_budgets_department_id');
SET @sql21 = IF(@idx21 = 0, 'CREATE INDEX idx_budgets_department_id ON budgets(department_id)', 'SELECT 1');
PREPARE stmt21 FROM @sql21; EXECUTE stmt21; DEALLOCATE PREPARE stmt21;

-- Notifications: user + read status
SET @idx22 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'notifications' AND INDEX_NAME = 'idx_notifications_user_id');
SET @sql22 = IF(@idx22 = 0, 'CREATE INDEX idx_notifications_user_id ON notifications(user_id)', 'SELECT 1');
PREPARE stmt22 FROM @sql22; EXECUTE stmt22; DEALLOCATE PREPARE stmt22;

SET @idx23 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'notifications' AND INDEX_NAME = 'idx_notifications_is_read');
SET @sql23 = IF(@idx23 = 0, 'CREATE INDEX idx_notifications_is_read ON notifications(is_read)', 'SELECT 1');
PREPARE stmt23 FROM @sql23; EXECUTE stmt23; DEALLOCATE PREPARE stmt23;

SET @idx24 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'notifications' AND INDEX_NAME = 'idx_notifications_created_at');
SET @sql24 = IF(@idx24 = 0, 'CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC)', 'SELECT 1');
PREPARE stmt24 FROM @sql24; EXECUTE stmt24; DEALLOCATE PREPARE stmt24;

-- Stock Adjustments: date-based lookups
SET @idx25 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'stock_adjustments' AND INDEX_NAME = 'idx_stock_adjustments_created_at');
SET @sql25 = IF(@idx25 = 0, 'CREATE INDEX idx_stock_adjustments_created_at ON stock_adjustments(created_at)', 'SELECT 1');
PREPARE stmt25 FROM @sql25; EXECUTE stmt25; DEALLOCATE PREPARE stmt25;

-- Leftovers: stock_out_id lookups
SET @idx26 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'leftovers' AND INDEX_NAME = 'idx_leftovers_stock_out_id');
SET @sql26 = IF(@idx26 = 0, 'CREATE INDEX idx_leftovers_stock_out_id ON leftovers(stock_out_id)', 'SELECT 1');
PREPARE stmt26 FROM @sql26; EXECUTE stmt26; DEALLOCATE PREPARE stmt26;
