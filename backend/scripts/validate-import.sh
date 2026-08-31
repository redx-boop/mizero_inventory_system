#!/bin/bash
# CSV Import Integrity Validation Suite
BASE="http://localhost:5000/api"
PASS=0; FAIL=0; RESULTS=()

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

echo ""; echo -e "${CYAN}========== CSV IMPORT VALIDATION SUITE ==========${NC}"; echo ""

# --- Auth Setup ---
# Get CSRF cookie (fetch headers + body in one shot)
CSRF_RESP=$(curl -s -D /tmp/csrf_headers.txt "$BASE/csrf-token")
CSRF_COOKIE=$(grep -i 'set-cookie' /tmp/csrf_headers.txt | grep '_csrf' | sed 's/.*_csrf=//;s/;.*//' | tr -d ' \r\n')
if [ -z "$CSRF_COOKIE" ]; then
  CSRF_COOKIE=$(echo "$CSRF_RESP" | grep -o '"csrfToken":"[^"]*"' | sed 's/.*:"//;s/"//')
fi
echo -e "${GREEN}CSRF cookie obtained${NC}"

# Login
LOGIN_RESP=$(curl -s -D /tmp/login_headers.txt \
  -H "Content-Type: application/json" \
  -H "Cookie: _csrf=$CSRF_COOKIE" \
  -X POST "$BASE/auth/login" \
  -d '{"email":"admin@mizero.com","password":"password123"}')
TOKEN=$(echo "$LOGIN_RESP" | grep -o '"token":"[^"]*"' | sed 's/.*:"//;s/"//')
if [ -z "$TOKEN" ]; then echo -e "${RED}Login failed${NC}"; exit 1; fi
echo -e "${GREEN}Login OK${NC}"

# Grab CSRF cookie from login response if rotated
LOGIN_CSRF=$(grep -i 'set-cookie' /tmp/login_headers.txt | grep '_csrf' | sed 's/.*_csrf=//;s/;.*//' | tr -d ' \r\n')
if [ -n "$LOGIN_CSRF" ]; then CSRF_COOKIE="$LOGIN_CSRF"; fi

# Department
DEPT=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/departments" | grep -o '"name":"[^"]*"' | head -1 | sed 's/"name":"//;s/"//')
echo -e "Dept: ${CYAN}$DEPT${NC}"; echo ""

# --- Helpers ---
# Extract CSRF cookie from a saved headers file
extract_csrf() {
  local hf="$1"
  grep -i 'set-cookie' "$hf" | grep '_csrf' | sed 's/.*_csrf=//;s/;.*//' | tr -d ' \r\n'
}

# Import CSV - returns JSON response. Saves headers to /tmp/imp_headers.txt for CSRF extraction
import_csv() {
  local csv="$1"; local params="$2"
  local tf=/tmp/testcsv$$.csv
  printf "%s\n" "$csv" > "$tf"
  local result=$(curl -s -D /tmp/imp_headers.txt \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-CSRF-Token: $CSRF_COOKIE" \
    -H "Cookie: _csrf=$CSRF_COOKIE" \
    -X POST "$BASE/items/import/csv$params" \
    -F "file=@$tf" 2>/dev/null)
  rm -f "$tf"
  # Extract new CSRF from response headers (cookie rotates on each POST)
  local new_csrf=$(extract_csrf /tmp/imp_headers.txt)
  if [ -n "$new_csrf" ]; then CSRF_COOKIE="$new_csrf"; fi
  echo "$result"
}

get_val() { echo "$1" | grep -o "\"$2\":[^,} ]*" | head -1 | sed "s/\"$2\"://"; }
get_msg() { echo "$1" | grep -o '"message":"[^"]*"' | head -1 | sed 's/.*:"//;s/"//'; }

run_test() {
  local name="$1" csv="$2" field="$3" expected="$4" params="$5"
  local result=$(import_csv "$csv" "$params")
  local actual=$(get_val "$result" "$field")
  local msg=$(get_msg "$result")

  if [ "$actual" = "$expected" ]; then
    echo -e "  ${GREEN}PASS${NC} $name"; echo "     $msg"
    PASS=$((PASS+1)); RESULTS+=("PASS: $name")
  else
    echo -e "  ${RED}FAIL${NC} $name"
    echo "     Expected $field=$expected, got: '$actual'"
    echo "     Response: $result"
    FAIL=$((FAIL+1)); RESULTS+=("FAIL: $name")
  fi
}

# ====== TESTS ======

echo -e "${YELLOW}--- TEST 1: New Item ---${NC}"
run_test "New item with auto SKU" \
  "name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nValTest_N1,Test,pcs,30,5,consumable,$DEPT,1000,RWF" \
  "inserted" "1"

echo -e "${YELLOW}--- TEST 2: Consumable Duplicate (auto-merge) ---${NC}"
run_test "Create consumable baseline" \
  "name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nValTest_Paper,Office,ream,20,10,consumable,$DEPT,5000,RWF" \
  "inserted" "1"
run_test "Re-import consumable merges" \
  "name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nValTest_Paper,Office,ream,50,10,consumable,$DEPT,5500,RWF" \
  "merged" "1"

echo -e "${YELLOW}--- TEST 3: Non-Consumable Duplicate (actions) ---${NC}"
run_test "Create non-consumable baseline" \
  "name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nValTest_Lap,Electronics,pcs,5,2,non-consumable,$DEPT,850000,RWF" \
  "inserted" "1"
run_test "Non-consumable skip action" \
  "name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nValTest_Lap,Electronics,pcs,3,2,non-consumable,$DEPT,900000,RWF" \
  "nonConsumableSkipped" "1" "?nonConsumableAction=skip"
run_test "Non-consumable create action" \
  "name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nValTest_Lap,Electronics,pcs,2,2,non-consumable,$DEPT,900000,RWF" \
  "inserted" "1" "?nonConsumableAction=create"
run_test "Non-consumable update action" \
  "name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nValTest_Lap,Electronics,pcs,4,2,non-consumable,$DEPT,950000,RWF" \
  "merged" "1" "?nonConsumableAction=update"

echo -e "${YELLOW}--- TEST 4: Different Departments ---${NC}"
DEPT2=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/departments" | grep -o '"name":"[^"]*"' | tail -1 | sed 's/"name":"//;s/"//')
run_test "Same name different dept = new item" \
  "name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nValTest_Chair,Furniture,pcs,10,2,non-consumable,$DEPT2,150000,RWF" \
  "inserted" "1"

echo -e "${YELLOW}--- TEST 5: Soft-Delete Restore ---${NC}"
IR=$(import_csv "name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nValTest_Printer,Electronics,pcs,3,1,non-consumable,$DEPT,300000,RWF" "")
INUM=$(get_val "$IR" "inserted")
if [ "$INUM" = "1" ]; then
  ITEMS=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/items?limit=200")
  ITEM_ID=$(echo "$ITEMS" | grep -o '"id":[0-9]*,"sku":"[^"]*","name":"ValTest_Printer"' | sed 's/"id"://;s/,.*//')
  if [ -n "$ITEM_ID" ]; then
    # Soft-delete with CSRF
    curl -s -D /tmp/del_headers.txt \
      -H "Authorization: Bearer $TOKEN" \
      -H "X-CSRF-Token: $CSRF_COOKIE" \
      -H "Cookie: _csrf=$CSRF_COOKIE" \
      -X DELETE "$BASE/items/$ITEM_ID" > /dev/null
    local new_csrf=$(extract_csrf /tmp/del_headers.txt)
    if [ -n "$new_csrf" ]; then CSRF_COOKIE="$new_csrf"; fi

    run_test "Re-import soft-deleted restores" \
      "name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nValTest_Printer,Electronics,pcs,7,1,non-consumable,$DEPT,320000,RWF" \
      "restored" "1"
  else echo -e "  ${YELLOW}Skip restore: item not found${NC}"
  fi
else echo -e "  ${YELLOW}Skip restore: insert failed${NC}"
fi

echo -e "${YELLOW}--- TEST 6: Case-Insensitive Matching ---${NC}"
run_test "UPPERCASE item creates" \
  "name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nVALTEST_CASE_TEST,Test,pcs,10,2,consumable,$DEPT,2000,RWF" \
  "inserted" "1"
run_test "lowercase re-import merges" \
  "name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nvaltest_case_test,Test,pcs,5,2,consumable,$DEPT,2000,RWF" \
  "merged" "1"

echo -e "${YELLOW}--- TEST 7: Spacing Normalization ---${NC}"
run_test "Normal spacing creates" \
  "name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nValTest TrimCheck,Test,pcs,8,2,consumable,$DEPT,3000,RWF" \
  "inserted" "1"
run_test "Extra spaces merges (sanitizer trims)" \
  "name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\n  ValTest TrimCheck  ,Test,pcs,3,2,consumable,$DEPT,3000,RWF" \
  "merged" "1"

echo -e "${YELLOW}--- Preview Test ---${NC}"
PTMP=/tmp/prev$$.csv
printf "%s\n" "name,category,unit,quantity,minimum_stock,item_type,department,unit_cost,currency\nValTest_Prev,Test,pcs,10,2,consumable,$DEPT,1000,RWF" > "$PTMP"
PRES=$(curl -s -D /tmp/prev_headers.txt -H "Authorization: Bearer $TOKEN" -F "file=@$PTMP" "$BASE/items/import/csv/preview")
rm -f "$PTMP"
PC=$(echo "$PRES" | grep -c '"predictedConsumableMerge"')
PS=$(echo "$PRES" | grep -c '"skuAutoGenerated":true')
if [ "$PC" -gt 0 ] && [ "$PS" -gt 0 ]; then
  echo -e "  ${GREEN}PASS${NC} Preview has predictions + skuAutoGenerated"
  PASS=$((PASS+1)); RESULTS+=("PASS: Preview")
else
  echo -e "  ${RED}FAIL${NC} Preview: $PRES"
  FAIL=$((FAIL+1)); RESULTS+=("FAIL: Preview")
fi

# ====== SUMMARY ======
echo ""; echo -e "${CYAN}========== RESULTS ==========${NC}"
echo -e "  ${GREEN}Passed: $PASS${NC}   ${RED}Failed: $FAIL${NC}"
for r in "${RESULTS[@]}"; do
  case "$r" in PASS:*) echo -e "  ${GREEN}*${NC} ${r#PASS: }" ;; *) echo -e "  ${RED}*${NC} ${r#FAIL: }" ;; esac
done
[ "$FAIL" -eq 0 ] && echo -e "${GREEN}ALL PASSED${NC}" || echo -e "${RED}$FAIL FAILED${NC}"
rm -f /tmp/csrf_headers.txt /tmp/login_headers.txt /tmp/imp_headers.txt /tmp/del_headers.txt /tmp/prev_headers.txt
