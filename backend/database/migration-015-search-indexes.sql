-- =============================================
-- Migration 015: Performance Indexes for Search & Filters
-- Creates database indexes to support all search,
-- filter, sort, and pagination queries efficiently.
-- =============================================

-- Stock In indexes
CREATE INDEX idx_stock_in_date ON stock_in(date);
CREATE INDEX idx_stock_in_item_id ON stock_in(item_id);
CREATE INDEX idx_stock_in_supplier ON stock_in(supplier(100));
CREATE INDEX idx_stock_in_supplier_type ON stock_in(supplier_type(50));
CREATE INDEX idx_stock_in_reference ON stock_in(reference_number(100));
CREATE INDEX idx_stock_in_created_at ON stock_in(created_at);
CREATE INDEX idx_stock_in_department_id ON stock_in(department_id);

-- Stock Out indexes
CREATE INDEX idx_stock_out_date ON stock_out(date);
CREATE INDEX idx_stock_out_item_id ON stock_out(item_id);
CREATE INDEX idx_stock_out_recipient ON stock_out(recipient(100));
CREATE INDEX idx_stock_out_department ON stock_out(department(100));
CREATE INDEX idx_stock_out_created_at ON stock_out(created_at);

-- Stock Adjustments indexes
CREATE INDEX idx_stock_adjustments_date ON stock_adjustments(created_at);
CREATE INDEX idx_stock_adjustments_item_id ON stock_adjustments(item_id);
CREATE INDEX idx_stock_adjustments_type ON stock_adjustments(adjustment_type);

-- Borrowings indexes
CREATE INDEX idx_borrowings_borrower_name ON borrowings(borrower_name(100));
CREATE INDEX idx_borrowings_item_id ON borrowings(item_id);
CREATE INDEX idx_borrowings_status ON borrowings(status);
CREATE INDEX idx_borrowings_borrow_date ON borrowings(borrow_date);
CREATE INDEX idx_borrowings_due_date ON borrowings(due_date);
CREATE INDEX idx_borrowings_created_at ON borrowings(created_at);

-- Returns indexes
CREATE INDEX idx_returns_borrowing_id ON returns(borrowing_id);
CREATE INDEX idx_returns_return_date ON returns(return_date);
CREATE INDEX idx_returns_condition ON returns(item_condition);
CREATE INDEX idx_returns_created_at ON returns(created_at);

-- Requests indexes
CREATE INDEX idx_requests_requester_id ON requests(requester_id);
CREATE INDEX idx_requests_item_id ON requests(item_id);
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_created_at ON requests(created_at);

-- Leftovers indexes
CREATE INDEX idx_leftovers_stock_out_id ON leftovers(stock_out_id);
CREATE INDEX idx_leftovers_created_at ON leftovers(created_at);

-- Damage Liabilities indexes
CREATE INDEX idx_damage_liabilities_borrowing_id ON damage_liabilities(borrowing_id);
CREATE INDEX idx_damage_liabilities_item_name ON damage_liabilities(item_name(100));
CREATE INDEX idx_damage_liabilities_borrower_name ON damage_liabilities(borrower_name(100));
CREATE INDEX idx_damage_liabilities_type ON damage_liabilities(liability_type);
CREATE INDEX idx_damage_liabilities_status ON damage_liabilities(status);
CREATE INDEX idx_damage_liabilities_created_at ON damage_liabilities(created_at);
CREATE INDEX idx_damage_liabilities_liability_amount ON damage_liabilities(liability_amount);
CREATE INDEX idx_damage_liabilities_amount_paid ON damage_liabilities(amount_paid);

-- Items indexes (for search in filters)
CREATE INDEX idx_items_name ON items(name(100));
CREATE INDEX idx_items_sku ON items(sku(50));
CREATE INDEX idx_items_department_id ON items(department_id);
CREATE INDEX idx_items_category ON items(category(100));

-- Damage Payments indexes
CREATE INDEX idx_damage_payments_liability_id ON damage_payments(liability_id);
CREATE INDEX idx_damage_payments_paid_at ON damage_payments(paid_at);
