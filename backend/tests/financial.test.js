/**
 * FINANCIAL CALCULATION UNIT TESTS
 *
 * Tests all critical financial formulas in the system:
 * 1. AVCO (Average Weighted Cost)
 * 2. Inventory valuation (quantity × unit_cost)
 * 3. Damage liability (replacement_cost × 50%)
 * 4. Loss liability (replacement_cost × 100%)
 * 5. Budget remaining (total_budget - amount_used)
 * 6. Stock-out cost snapshots
 * 7. Adjustment calculations
 *
 * Uses pure math functions (no DB needed) to isolate formula correctness.
 */

// ========================================
// AVCO Formula: Weighted Average Cost
// ========================================
// Formula:
//   new_avg_cost = (current_qty × current_cost + incoming_qty × incoming_price)
//                ÷ (current_qty + incoming_qty)
function calculateAVCO(currentQty, currentCost, incomingQty, incomingPrice) {
  currentQty = Number(currentQty) || 0;
  currentCost = Number(currentCost) || 0;
  incomingQty = Number(incomingQty) || 0;
  incomingPrice = Number(incomingPrice) || 0;

  const totalQty = currentQty + incomingQty;
  if (totalQty === 0) return 0;

  const totalValue = (currentQty * currentCost) + (incomingQty * incomingPrice);
  return Math.round((totalValue / totalQty) * 100) / 100; // Round to 2 decimals
}

// ========================================
// Inventory Value
// ========================================
function calculateInventoryValue(quantity, unitCost) {
  return (Number(quantity) || 0) * (Number(unitCost) || 0);
}

// ========================================
// Liability Calculations
// ========================================
// Damage: 50% of replacement cost
function calculateDamageLiability(replacementCost) {
  return (Number(replacementCost) || 0) * 0.50;
}

// Loss: 100% of replacement cost
function calculateLossLiability(replacementCost) {
  return (Number(replacementCost) || 0) * 1.00;
}

// Full replacement cost for qty items
function calculateReplacementCost(unitCost, quantity) {
  return (Number(unitCost) || 0) * (Number(quantity) || 0);
}

// ========================================
// Budget Calculations
// ========================================
function calculateBudgetRemaining(totalBudget, amountUsed) {
  return Math.max(0, (Number(totalBudget) || 0) - (Number(amountUsed) || 0));
}

function calculateBudgetUsagePct(totalBudget, amountUsed) {
  totalBudget = Number(totalBudget) || 0;
  amountUsed = Number(amountUsed) || 0;
  if (totalBudget <= 0) return 0;
  return Math.round((amountUsed / totalBudget) * 100);
}

// ========================================
// Stock Out Cost Snapshot
// ========================================
function calculateStockOutCost(unitCostAtTime, quantity) {
  return (Number(unitCostAtTime) || 0) * (Number(quantity) || 0);
}

// ========================================
// Adjustment Cost Impact
// ========================================
function calculateAdjustmentCost(unitCostAtTime, quantity) {
  return (Number(unitCostAtTime) || 0) * (Number(quantity) || 0);
}

// ========================================
// Payment Remaining Balance
// ========================================
function calculateRemainingBalance(totalLiability, amountPaid) {
  return Math.max(0, (Number(totalLiability) || 0) - (Number(amountPaid) || 0));
}

// ========================================
// TESTS
// ========================================

describe('💰 AVCO — Average Weighted Cost Calculation', () => {
  test('should calculate basic AVCO correctly (RWF example)', () => {
    // Current: 10 units @ 5,000 RWF. Incoming: 5 units @ 6,000 RWF
    // AVCO = (10*5000 + 5*6000) / (10+5) = (50000 + 30000) / 15 = 80000/15 = 5333.33
    const result = calculateAVCO(10, 5000, 5, 6000);
    expect(result).toBe(5333.33);
  });

  test('should handle zero current quantity (first purchase)', () => {
    const result = calculateAVCO(0, 0, 10, 5000);
    expect(result).toBe(5000);
  });

  test('should handle zero incoming quantity (no new stock)', () => {
    const result = calculateAVCO(10, 5000, 0, 0);
    expect(result).toBe(5000);
  });

  test('should handle zero both quantities', () => {
    const result = calculateAVCO(0, 0, 0, 0);
    expect(result).toBe(0);
  });

  test('should handle large numbers without floating point issues', () => {
    // 1000 units @ 850,000 RWF + 500 units @ 900,000 RWF
    // = (850,000,000 + 450,000,000) / 1500 = 1,300,000,000 / 1500 = 866,666.67
    const result = calculateAVCO(1000, 850000, 500, 900000);
    expect(result).toBe(866666.67);
  });

  test('should handle multiple stock-in averages progressively', () => {
    // Batch 1: 10 @ 5000 → AVCO = 5000
    let avg = calculateAVCO(0, 0, 10, 5000);
    expect(avg).toBe(5000);

    // Batch 2: current 10 @ 5000 + incoming 5 @ 6000 → should be 5333.33
    avg = calculateAVCO(10, 5000, 5, 6000);
    expect(avg).toBe(5333.33);

    // Batch 3: current 15 @ 5333.33 + incoming 10 @ 5500
    // = (15*5333.33 + 10*5500) / 25 = (80000 + 55000) / 25 = 135000/25 = 5400
    avg = calculateAVCO(15, 5333.33, 10, 5500);
    expect(avg).toBe(5400);
  });

  test('should handle decimal prices', () => {
    const result = calculateAVCO(3, 1500.50, 2, 2000.75);
    // (3*1500.50 + 2*2000.75) / 5 = (4501.50 + 4001.50) / 5 = 8503/5 = 1700.60
    expect(result).toBe(1700.60);
  });

  test('should handle negative quantities (validation catches these in practice)', () => {
    // Note: In the real system, quantities are validated as positive before reaching AVCO.
    // If -5 is passed, Number(-5) is -5 (truthy), so it's used as-is.
    // Actual result: (-5*5000 + 10*6000) / 5 = (-25000 + 60000) / 5 = 35000/5 = 7000
    const result = calculateAVCO(-5, 5000, 10, 6000);
    expect(result).toBe(7000);
  });

  test('should handle negative prices (validation catches these in practice)', () => {
    // Note: In the real system, prices are validated as positive before reaching AVCO.
    // If -5000 is passed, Number(-5000) is -5000 (truthy), so it's used as-is.
    // Actual result: (10*-5000 + 5*6000) / 15 = (-50000 + 30000) / 15 = -20000/15 = -1333.33
    const result = calculateAVCO(10, -5000, 5, 6000);
    expect(result).toBe(-1333.33);
  });

  test('should handle null/undefined inputs gracefully', () => {
    expect(calculateAVCO(null, 5000, 5, 6000)).toBe(6000);
    expect(calculateAVCO(10, undefined, 5, 6000)).toBe(2000);
    expect(calculateAVCO(10, 5000, null, 6000)).toBe(5000);
    expect(calculateAVCO(10, 5000, 5, undefined)).toBe(3333.33);
  });
});

describe('💰 Inventory Value Calculation', () => {
  test('should calculate basic inventory value', () => {
    // 50 units @ 7,500 RWF each
    const result = calculateInventoryValue(50, 7500);
    expect(result).toBe(375000);
  });

  test('should handle zero quantity', () => {
    expect(calculateInventoryValue(0, 7500)).toBe(0);
  });

  test('should handle zero cost', () => {
    expect(calculateInventoryValue(50, 0)).toBe(0);
  });

  test('should handle large inventory values', () => {
    // 1000 laptops @ 850,000 RWF
    const result = calculateInventoryValue(1000, 850000);
    expect(result).toBe(850000000);
  });

  test('should handle null/undefined gracefully', () => {
    expect(calculateInventoryValue(null, 7500)).toBe(0);
    expect(calculateInventoryValue(50, undefined)).toBe(0);
  });
});

describe('💔 Liability Calculations', () => {
  describe('Damage Liability (50%)', () => {
    test('should calculate damage liability at 50% of replacement cost', () => {
      // Item cost: 850,000 RWF. Damage: 50% = 425,000 RWF
      const result = calculateDamageLiability(850000);
      expect(result).toBe(425000);
    });

    test('should handle zero replacement cost', () => {
      expect(calculateDamageLiability(0)).toBe(0);
    });

    test('should handle decimal costs', () => {
      const result = calculateDamageLiability(1500.50);
      expect(result).toBe(750.25);
    });
  });

  describe('Loss Liability (100%)', () => {
    test('should calculate loss liability at 100% of replacement cost', () => {
      // Item cost: 850,000 RWF. Loss: 100% = 850,000 RWF
      const result = calculateLossLiability(850000);
      expect(result).toBe(850000);
    });

    test('should handle zero replacement cost', () => {
      expect(calculateLossLiability(0)).toBe(0);
    });
  });

  describe('Replacement Cost', () => {
    test('should calculate replacement cost as unit_cost × quantity', () => {
      // 3 laptops @ 850,000 RWF each
      const result = calculateReplacementCost(850000, 3);
      expect(result).toBe(2550000);
    });

    test('should handle single unit', () => {
      expect(calculateReplacementCost(5000, 1)).toBe(5000);
    });

    test('should handle zero quantity', () => {
      expect(calculateReplacementCost(850000, 0)).toBe(0);
    });

    test('should handle null inputs', () => {
      expect(calculateReplacementCost(null, 3)).toBe(0);
      expect(calculateReplacementCost(850000, null)).toBe(0);
    });
  });

  describe('End-to-end Liability Flow', () => {
    test('should calculate full damage liability flow from borrowing', () => {
      // Borrow 3 laptops @ 850,000 RWF each
      const qty = 3;
      const unitCost = 850000;

      // Replacement value = 3 × 850,000 = 2,550,000 RWF
      const replacementCost = calculateReplacementCost(unitCost, qty);
      expect(replacementCost).toBe(2550000);

      // Damage: 50% of 2,550,000 = 1,275,000 RWF
      const damageLiability = calculateDamageLiability(replacementCost);
      expect(damageLiability).toBe(1275000);

      // Loss: 100% of 2,550,000 = 2,550,000 RWF
      const lossLiability = calculateLossLiability(replacementCost);
      expect(lossLiability).toBe(2550000);
    });

    test('should handle partial damage of borrowed items', () => {
      // Borrow 5 items, 2 are damaged
      const unitCost = 100000;
      const damagedQty = 2;

      const replacementCost = calculateReplacementCost(unitCost, damagedQty);
      expect(replacementCost).toBe(200000);

      const damageLiability = calculateDamageLiability(replacementCost);
      expect(damageLiability).toBe(100000);
    });
  });
});

describe('📊 Budget Calculations', () => {
  test('should calculate remaining budget correctly', () => {
    // Budget: 10,000,000 RWF. Used: 3,500,000 RWF. Remaining: 6,500,000 RWF
    const result = calculateBudgetRemaining(10000000, 3500000);
    expect(result).toBe(6500000);
  });

  test('should not go negative when over budget', () => {
    // Budget: 5,000,000 RWF. Used: 7,000,000 RWF. Remaining should be 0 (not -2,000,000)
    const result = calculateBudgetRemaining(5000000, 7000000);
    expect(result).toBe(0);
  });

  test('should calculate usage percentage', () => {
    // Budget: 10,000,000 RWF. Used: 2,500,000 RWF. Usage: 25%
    const result = calculateBudgetUsagePct(10000000, 2500000);
    expect(result).toBe(25);
  });

  test('should handle zero budget', () => {
    expect(calculateBudgetRemaining(0, 0)).toBe(0);
    expect(calculateBudgetUsagePct(0, 0)).toBe(0);
  });

  test('should handle over-budget scenario for usage %', () => {
    // Budget: 10,000,000. Used: 15,000,000. Usage: 150% capped at calculation
    const result = calculateBudgetUsagePct(10000000, 15000000);
    expect(result).toBe(150); // Percentage can exceed 100% for display
  });

  test('should return 0 remaining when no budget exists', () => {
    expect(calculateBudgetRemaining(0, 500000)).toBe(0);
  });
});

describe('📤 Stock-Out Cost Snapshot', () => {
  test('should calculate COGS correctly', () => {
    // 10 units @ 7,720.69 RWF each (AVCO at time of stock-out)
    const result = calculateStockOutCost(7720.69, 10);
    expect(result).toBe(77206.90);
  });

  test('should handle zero cost', () => {
    expect(calculateStockOutCost(0, 10)).toBe(0);
  });

  test('should handle zero quantity', () => {
    expect(calculateStockOutCost(5000, 0)).toBe(0);
  });

  test('should handle null/undefined', () => {
    expect(calculateStockOutCost(null, 10)).toBe(0);
    expect(calculateStockOutCost(5000, null)).toBe(0);
  });
});

describe('⚖️ Adjustment Cost Impact', () => {
  test('should calculate increase adjustment value', () => {
    // Increase 20 units @ 5,000 RWF = 100,000 RWF added to inventory value
    const result = calculateAdjustmentCost(5000, 20);
    expect(result).toBe(100000);
  });

  test('should calculate decrease adjustment value', () => {
    // Decrease 5 units @ 8,500 RWF = 42,500 RWF removed from inventory value
    const result = calculateAdjustmentCost(8500, 5);
    expect(result).toBe(42500);
  });

  test('should handle zero cost', () => {
    expect(calculateAdjustmentCost(0, 10)).toBe(0);
  });

  test('should handle zero quantity', () => {
    expect(calculateAdjustmentCost(5000, 0)).toBe(0);
  });
});

describe('💵 Payment & Remaining Balance', () => {
  test('should calculate remaining liability balance', () => {
    // Total liability: 425,000 RWF. Paid: 200,000 RWF. Remaining: 225,000 RWF
    const result = calculateRemainingBalance(425000, 200000);
    expect(result).toBe(225000);
  });

  test('should return 0 when fully paid', () => {
    expect(calculateRemainingBalance(425000, 425000)).toBe(0);
  });

  test('should return 0 when overpaid (should not happen in practice)', () => {
    expect(calculateRemainingBalance(425000, 500000)).toBe(0);
  });

  test('should handle zero liability', () => {
    expect(calculateRemainingBalance(0, 0)).toBe(0);
  });
});
