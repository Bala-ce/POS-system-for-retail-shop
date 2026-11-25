// App State
let currentLang = 'ta';
let cart = [];
let todayInvoices = 0;
let todaySales = 0;
let todayCollected = 0;

let currentProducts = [];
let currentAccountsTab = 'active';
let currentThermalPaperSize = '80mm';
let allActiveAccounts = [];
let allSalesCache = [];
let currentModalInvoice = null;

// Date formatter in DD/MM/YYYY
function formatToDDMMYYYY(dateInput, includeTime = true) {
    if (!dateInput) return '-';

    // If it's a pure YYYY-MM-DD string without time
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
        const [yyyy, mm, dd] = dateInput.trim().split('-');
        return `${dd}/${mm}/${yyyy}`;
    }

    const d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();

    if (!includeTime) {
        return `${dd}/${mm}/${yyyy}`;
    }

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const hh = String(hours).padStart(2, '0');
    return `${dd}/${mm}/${yyyy}, ${hh}:${minutes} ${ampm}`;
}

const API = {
    async get(endpoint) {
        const res = await fetch('/api' + endpoint);
        return res.json();
    },
    async post(endpoint, data) {
        const res = await fetch('/api' + endpoint, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        return res.json();
    },
    async put(endpoint, data) {
        const res = await fetch('/api' + endpoint, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        return res.json();
    }
};

// UI Utilities
const UI = {
    updateTranslations() {
        document.querySelectorAll('[data-en]').forEach(el => {
            el.innerText = el.getAttribute(`data-${currentLang}`);
        });
        document.querySelectorAll('[data-en-placeholder]').forEach(el => {
            el.placeholder = el.getAttribute(`data-${currentLang}-placeholder`);
        });
    },

    toggleLanguage() {
        currentLang = currentLang === 'ta' ? 'en' : 'ta';
        document.getElementById('lang-label').innerText = currentLang === 'ta' ? 'EN' : 'தமிழ்';
        UI.updateTranslations();
        renderCart();
        renderCatalog();
        loadAllViewsData();
    },

    switchView(targetId, btnElement) {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        if(btnElement) btnElement.classList.add('active');

        document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');

        if (targetId === 'new-account-view') {
            const accDateInput = document.getElementById('acc-date');
            if (accDateInput && !accDateInput.value) {
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                accDateInput.value = `${yyyy}-${mm}-${dd}`;
            }
        }

        loadAllViewsData();
    },

    debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    formatCurrency(amount) {
        return `₹${Number(amount).toFixed(2)}`;
    },
    
    getProductName(item) {
        return currentLang === 'ta' ? item.name_ta : item.name_en;
    }
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            UI.switchView(btn.getAttribute('data-target'), btn.closest('.nav-btn'));
        });
    });

    document.getElementById('lang-toggle').addEventListener('click', UI.toggleLanguage);
    document.getElementById('catalog-search').addEventListener('input', UI.debounce(renderCatalog, 300));
    document.getElementById('stock-search').addEventListener('input', UI.debounce(renderStockView, 300));
    
    if (document.getElementById('refill-search')) {
        document.getElementById('refill-search').addEventListener('input', UI.debounce(renderRefillView, 300));
    }

    document.getElementById('cash-tendered').addEventListener('input', calculateChange);

    document.querySelectorAll('.tab-btn').forEach(btn => {
        if(btn.hasAttribute('data-acc-tab')) return;
        
        btn.addEventListener('click', (e) => {
            const target = e.target.getAttribute('data-tab');
            document.querySelectorAll('#stock-view .tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            document.querySelectorAll('#stock-view .tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(target).classList.add('active');
        });
    });

    document.querySelectorAll('.btn-filter-inv').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.btn-filter-inv').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById('invoices-custom-date').value = ''; 
            renderInvoicesView(e.target.getAttribute('data-range'));
        });
    });
    
    if(document.getElementById('invoices-custom-date')) {
        document.getElementById('invoices-custom-date').addEventListener('change', (e) => {
            document.querySelectorAll('.btn-filter-inv').forEach(b => b.classList.remove('active'));
            if (e.target.value) {
                renderInvoicesView('custom', e.target.value);
            } else {
                document.querySelector('.btn-filter-inv[data-range="today"]').classList.add('active');
                renderInvoicesView('today');
            }
        });
    }

    document.getElementById('clear-cart-btn').addEventListener('click', () => {
        if(confirm(currentLang==='en' ? "Clear cart?" : "பில்லை அழிக்கவா?")) {
            cart = [];
            document.getElementById('cash-tendered').value = '0';
            renderCart();
        }
    });

    document.getElementById('checkout-btn').addEventListener('click', handleCheckout);
    document.getElementById('add-product-form').addEventListener('submit', handleAddProduct);

    document.querySelectorAll('.btn-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById('profit-custom-date').value = ''; 
            renderProfitView(e.target.getAttribute('data-range'));
        });
    });
    
    if(document.getElementById('profit-custom-date')) {
        document.getElementById('profit-custom-date').addEventListener('change', (e) => {
            document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
            if (e.target.value) {
                renderProfitView('custom', e.target.value);
            } else {
                document.querySelector('.btn-filter[data-range="today"]').classList.add('active');
                renderProfitView('today');
            }
        });
    }

    if(document.getElementById('account-search')) {
        document.getElementById('account-search').addEventListener('input', UI.debounce(renderAccountsView, 300));
        document.getElementById('new-account-form').addEventListener('submit', handleNewAccount);
    }

    setupNewInvoice();
    UI.updateTranslations();
    loadAllViewsData();
});

async function loadAllViewsData() {
    try {
        currentProducts = await API.get('/products');
        renderCatalog();
        renderStockView();
        renderRefillView();
        renderPriceView();
        checkExpiryAlerts();
        updateMetrics();

        if (document.getElementById('profit-tbody')) {
            renderProfitView(document.querySelector('.btn-filter.active') ? document.querySelector('.btn-filter.active').getAttribute('data-range') : 'today');
        }
        if (document.getElementById('accounts-tbody')) {
            renderAccountsView();
            populateInvoicesDropdown();
        }
        if (document.getElementById('invoice-customer-select')) {
            loadCustomerAccountsForBilling();
        }
        if (document.getElementById('invoices-tbody')) {
            renderInvoicesView(document.querySelector('.btn-filter-inv.active') ? document.querySelector('.btn-filter-inv.active').getAttribute('data-range') : 'today');
        }
    } catch(err) {
        console.error("Error loading data", err);
    }
}

function renderCatalog() {
    const q = document.getElementById('catalog-search').value.trim().toLowerCase();
    let products = currentProducts;

    if (q) {
        products = products.filter(p => p.name_en.toLowerCase().includes(q) || p.name_ta.includes(q));
    }

    const grid = document.getElementById('catalog-grid');
    grid.innerHTML = '';

    products.forEach(p => {
        const div = document.createElement('div');
        div.className = 'product-card';
        div.innerHTML = `
            ${p.image_url ? `<img src="${p.image_url}" class="prod-img" alt="${p.name_en}">` : `<div class="prod-img-placeholder"></div>`}
            <div class="prod-title">${UI.getProductName(p)}</div>
            <div class="prod-price">${UI.formatCurrency(p.selling_price)} <small>/ ${p.unit_type}</small></div>
            <div class="prod-stock">Stock: ${p.stock_quantity}</div>
            <button class="btn-add" onclick='addToCart(${JSON.stringify(p)})'>+</button>
        `;
        grid.appendChild(div);
    });
}

window.addToCart = function(product) {
    const existing = cart.find(i => i.id === product.id);
    if (existing) {
        existing.rawQty += 1;
    } else {
        cart.push({ ...product, rawQty: 1, selectedUnit: product.unit_type });
    }
    renderCart();
}

window.updateCartQty = function(id, val, selectedUnit) {
    const item = cart.find(i => i.id === id);
    if (item) {
        item.rawQty = Number(val);
        if (selectedUnit) item.selectedUnit = selectedUnit;
        if (item.rawQty <= 0) cart = cart.filter(i => i.id !== id);
        renderCart();
    }
}

window.changeCartQty = function(id, delta) {
    const item = cart.find(i => i.id === id);
    if (item) {
        item.rawQty += delta;
        if (item.rawQty <= 0) cart = cart.filter(i => i.id !== id);
        renderCart();
    }
}

function renderCart() {
    const tbody = document.getElementById('invoice-items');
    tbody.innerHTML = '';
    let subtotal = 0;

    cart.forEach(item => {
        let actualQty = item.rawQty;
        if (item.unit_type === 'kg' && item.selectedUnit === 'g') {
            actualQty = item.rawQty / 1000;
        }

        const lineTotal = item.selling_price * actualQty;
        subtotal += lineTotal;

        let qtyUI = '';
        if (item.unit_type === 'kg') {
            qtyUI = `
                <div class="qty-control-loose">
                    <input type="number" step="0.05" min="0" value="${item.rawQty}" onchange="updateCartQty(${item.id}, this.value, '${item.selectedUnit}')">
                    <select onchange="updateCartQty(${item.id}, ${item.rawQty}, this.value)">
                        <option value="kg" ${item.selectedUnit === 'kg' ? 'selected' : ''}>kg</option>
                        <option value="g" ${item.selectedUnit === 'g' ? 'selected' : ''}>g</option>
                    </select>
                </div>
            `;
        } else {
            qtyUI = `
                <div class="qty-control-discrete">
                    <button class="qty-btn minus" onclick="changeCartQty(${item.id}, -1)">-</button>
                    <input type="text" class="qty-input" value="${item.rawQty}" readonly>
                    <button class="qty-btn plus" onclick="changeCartQty(${item.id}, 1)">+</button>
                </div>
            `;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <span class="inv-item-name">${UI.getProductName(item)}</span>
                <span class="inv-item-price">@ ${UI.formatCurrency(item.selling_price)}</span>
            </td>
            <td>
                ${qtyUI}
                <span style="display:none;" class="print-qty">${item.rawQty} ${item.selectedUnit}</span>
            </td>
            <td><b>${UI.formatCurrency(lineTotal)}</b></td>
        `;
        tbody.appendChild(tr);
    });

    const discountInput = document.getElementById('cart-discount');
    const discount = discountInput ? Math.max(0, Number(discountInput.value) || 0) : 0;
    const grandTotal = Math.max(0, subtotal - discount);

    document.getElementById('cart-subtotal').innerText = UI.formatCurrency(subtotal);
    document.getElementById('cart-tax').innerText = '₹0.00';
    document.getElementById('cart-total').innerText = UI.formatCurrency(grandTotal);
    calculateChange();
    updateAccountDuePreview();
}

window.calculateTotals = function() {
    let subtotal = 0;
    cart.forEach(item => {
        let actualQty = item.rawQty;
        if (item.unit_type === 'kg' && item.selectedUnit === 'g') {
            actualQty = item.rawQty / 1000;
        }
        subtotal += item.selling_price * actualQty;
    });

    const discountInput = document.getElementById('cart-discount');
    const discount = discountInput ? Math.max(0, Number(discountInput.value) || 0) : 0;
    const grandTotal = Math.max(0, subtotal - discount);

    const subtotalEl = document.getElementById('cart-subtotal');
    const totalEl = document.getElementById('cart-total');
    if (subtotalEl) subtotalEl.innerText = UI.formatCurrency(subtotal);
    if (totalEl) totalEl.innerText = UI.formatCurrency(grandTotal);

    calculateChange();
    updateAccountDuePreview();
};

window.addCash = function(amt) {
    const input = document.getElementById('cash-tendered');
    input.value = Number(input.value) + amt;
    calculateChange();
};

function calculateChange() {
    const totalText = document.getElementById('cart-total').innerText.replace('₹', '');
    const total = Number(totalText) || 0;
    const tendered = Number(document.getElementById('cash-tendered').value) || 0;
    const change = tendered > total ? tendered - total : 0;
    document.getElementById('cash-change').innerText = UI.formatCurrency(change);
}

function setupNewInvoice() {
    const date = new Date();
    document.getElementById('inv-date').innerText = formatToDDMMYYYY(date, true);
    document.getElementById('inv-number').innerText = `INV-NEW`;
}

// --- Customer Accounts & Billing Helpers ---
async function loadCustomerAccountsForBilling() {
    try {
        const accounts = await API.get('/accounts');
        allActiveAccounts = accounts || [];
        const select = document.getElementById('invoice-customer-select');
        const payMethodSelect = document.getElementById('invoice-payment-method');
        if (!select) return;

        const payMethod = payMethodSelect ? payMethodSelect.value : 'Cash';
        const currentVal = select.value;
        
        select.innerHTML = '';
        if (payMethod === 'Account') {
            const defaultOpt = document.createElement('option');
            defaultOpt.value = '';
            defaultOpt.innerText = currentLang === 'en' ? '-- Select Customer Account --' : '-- வாடிக்கையாளர் கணக்கை தேர்வு செய்க --';
            select.appendChild(defaultOpt);
        } else {
            const cashOpt = document.createElement('option');
            cashOpt.value = 'cash';
            cashOpt.innerText = currentLang === 'en' ? 'Cash Customer' : 'ரொக்க வாடிக்கையாளர் (Cash Customer)';
            select.appendChild(cashOpt);
        }

        allActiveAccounts.forEach(acc => {
            const opt = document.createElement('option');
            opt.value = acc.id;
            opt.innerText = `${acc.customer_name} (${currentLang === 'en' ? 'Due' : 'பாக்கி'}: ₹${Number(acc.balance_amount).toFixed(2)})`;
            opt.setAttribute('data-name', acc.customer_name);
            opt.setAttribute('data-balance', acc.balance_amount);
            select.appendChild(opt);
        });

        if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
            select.value = currentVal;
        } else if (payMethod !== 'Account') {
            select.value = 'cash';
        }
        updateAccountDuePreview();
    } catch(err) {
        console.error("Error loading accounts for billing", err);
    }
}

window.onInvoiceCustomerSelect = function() {
    updateAccountDuePreview();
};

window.onInvoicePaymentMethodChange = function() {
    const payMethodSelect = document.getElementById('invoice-payment-method');
    const custLabel = document.getElementById('customer-select-label');
    const changeCalc = document.querySelector('.change-calc');
    const quickCash = document.querySelector('.quick-cash-grid');
    const method = payMethodSelect ? payMethodSelect.value : 'Cash';

    if (method === 'Account') {
        if (custLabel) custLabel.innerText = currentLang === 'en' ? 'Customer Account:' : 'கடன் கணக்கு:';
        if (changeCalc) changeCalc.style.display = 'none';
        if (quickCash) quickCash.style.display = 'none';
    } else if (method === 'UPI') {
        if (custLabel) custLabel.innerText = currentLang === 'en' ? 'Customer (Optional):' : 'வாடிக்கையாளர்:';
        if (changeCalc) changeCalc.style.display = 'none';
        if (quickCash) quickCash.style.display = 'none';
    } else { // Cash
        if (custLabel) custLabel.innerText = currentLang === 'en' ? 'Customer:' : 'வாடிக்கையாளர்:';
        if (changeCalc) changeCalc.style.display = 'block';
        if (quickCash) quickCash.style.display = 'grid';
    }

    loadCustomerAccountsForBilling();
};

function updateAccountDuePreview() {
    const select = document.getElementById('invoice-customer-select');
    const payMethodSelect = document.getElementById('invoice-payment-method');
    const accDueRow = document.getElementById('account-due-info');
    const accDueRemaining = document.getElementById('cart-account-remaining');
    
    if (!select || !payMethodSelect || !accDueRow || !accDueRemaining) return;
    
    if (payMethodSelect.value === 'Account') {
        if (select.value && select.value !== 'cash') {
            const opt = select.options[select.selectedIndex];
            const currentBal = Number(opt.getAttribute('data-balance') || 0);
            const totalText = document.getElementById('cart-total').innerText.replace('₹', '').replace(/,/g, '');
            const total = Number(totalText) || 0;
            const newBal = currentBal + total;
            
            accDueRemaining.innerHTML = `
                <span style="font-size: 13px; color: var(--text-muted); font-weight: normal;">முந்தைய பாக்கி: ₹${currentBal.toFixed(2)} + பில்: ₹${total.toFixed(2)} = </span>
                <b class="text-danger" style="font-size: 15px;">₹${newBal.toFixed(2)}</b>
            `;
            accDueRow.style.display = 'flex';
        } else {
            accDueRemaining.innerHTML = `<span class="text-danger" style="font-size: 13px; font-weight: bold;">${currentLang === 'en' ? '⚠️ Please select account' : '⚠️ கணக்கை தேர்வு செய்யவும்'}</span>`;
            accDueRow.style.display = 'flex';
        }
    } else {
        accDueRow.style.display = 'none';
    }
}

// --- Paper Size Mode Switcher ---
window.switchThermalPaperSize = function(size) {
    currentThermalPaperSize = size;
    const paper = document.getElementById('receipt-preview-content');
    const badge = document.getElementById('preview-paper-badge');
    const btn80 = document.getElementById('btn-mode-80mm');
    const btn58 = document.getElementById('btn-mode-58mm');
    
    if (size === '58mm') {
        if (paper) {
            paper.classList.remove('paper-80mm');
            paper.classList.add('paper-58mm');
        }
        if (badge) badge.innerText = '58mm Thermal Receipt';
        if (btn80) btn80.classList.remove('active');
        if (btn58) btn58.classList.add('active');
    } else {
        if (paper) {
            paper.classList.remove('paper-58mm');
            paper.classList.add('paper-80mm');
        }
        if (badge) badge.innerText = '80mm Thermal Receipt';
        if (btn80) btn80.classList.add('active');
        if (btn58) btn58.classList.remove('active');
    }
};

// --- Thermal Receipt Content Generator ---
function generateReceiptHTML(invoiceNumber) {
    const date = new Date();
    const dateTimeStr = formatToDDMMYYYY(date, true);

    const custSelect = document.getElementById('invoice-customer-select');
    let customerName = 'Cash Customer (ரொக்க வாடிக்கையாளர்)';
    let isAccount = false;
    let oldBalance = 0;

    if (custSelect && custSelect.value !== 'cash') {
        const opt = custSelect.options[custSelect.selectedIndex];
        customerName = opt.getAttribute('data-name') || opt.innerText;
        isAccount = true;
        oldBalance = Number(opt.getAttribute('data-balance') || 0);
    }

    const paySelect = document.getElementById('invoice-payment-method');
    const paymentMethod = paySelect ? paySelect.value : 'Cash';

    let subtotal = 0;
    const itemsHtml = cart.map(item => {
        let actualQty = item.rawQty;
        if (item.unit_type === 'kg' && item.selectedUnit === 'g') {
            actualQty = item.rawQty / 1000;
        }
        const lineTotal = Number(item.selling_price) * actualQty;
        subtotal += lineTotal;

        // Line 1: Product Name (English / Tamil)
        let nameLine = '';
        if (item.name_ta && item.name_en && item.name_ta !== item.name_en) {
            nameLine = `${item.name_ta} (${item.name_en})`;
        } else {
            nameLine = item.name_ta || item.name_en;
        }

        // Line 2: Quantity & Rate (e.g., "250g x ₹120.00/kg") ......... Line Total (₹30.00)
        let qtyRate = '';
        if (item.unit_type === 'kg') {
            const unit = item.selectedUnit || 'kg';
            const rateStr = `₹${Number(item.selling_price).toFixed(2)}/kg`;
            qtyRate = `${item.rawQty}${unit} x ${rateStr}`;
        } else {
            const unit = item.unit_type || 'pcs';
            const rateStr = `₹${Number(item.selling_price).toFixed(2)}`;
            qtyRate = `${item.rawQty} ${unit} x ${rateStr}`;
        }

        return `
            <div class="receipt-item-row">
                <div class="receipt-item-name">${nameLine}</div>
                <div class="receipt-item-details">
                    <span class="receipt-item-qty-rate">${qtyRate}</span>
                    <span class="receipt-item-dots"></span>
                    <span class="receipt-item-total">₹${lineTotal.toFixed(2)}</span>
                </div>
            </div>
        `;
    }).join('');

    const discountInput = document.getElementById('cart-discount');
    const discount = discountInput ? Math.max(0, Number(discountInput.value) || 0) : 0;
    const grandTotal = Math.max(0, subtotal - discount);

    const tendered = Number(document.getElementById('cash-tendered')?.value || 0);
    const change = tendered > grandTotal ? tendered - grandTotal : 0;
    const remainingBalance = (isAccount && paymentMethod === 'Account') ? (oldBalance + grandTotal) : oldBalance;

    return `
        <div class="receipt-header notranslate" translate="no">
            <div class="receipt-header-title notranslate" translate="no">ராஜா நாட்டு மருந்து & பலசரக்கு கடை</div>
            <div class="receipt-header-sub notranslate" translate="no">(Raja Naatu Marundhu & Palasarakku Kadai)</div>
        </div>

        <div class="receipt-meta notranslate" translate="no">
            <div class="receipt-meta-row">
                <span class="receipt-meta-label">பில் எண் (Bill Serial):</span>
                <span class="receipt-meta-val receipt-inv-num">${invoiceNumber || 'INV-PREVIEW'}</span>
            </div>
            <div class="receipt-meta-row">
                <span class="receipt-meta-label">தேதி (Date & Time):</span>
                <span class="receipt-meta-val">${dateTimeStr}</span>
            </div>
            <div class="receipt-meta-row">
                <span class="receipt-meta-label">வாடிக்கையாளர் (Customer):</span>
                <span class="receipt-meta-val">${customerName}</span>
            </div>
        </div>

        <div class="receipt-divider notranslate" translate="no">--------------------------------</div>

        <div class="receipt-items-list notranslate" translate="no">
            ${itemsHtml}
        </div>

        <div class="receipt-divider notranslate" translate="no">--------------------------------</div>

        <div class="receipt-summary notranslate" translate="no">
            <div class="receipt-sum-row">
                <span>உப மொத்தம் (Subtotal):</span>
                <span class="font-bold">₹${subtotal.toFixed(2)}</span>
            </div>
            ${discount > 0 ? `
            <div class="receipt-sum-row">
                <span>தள்ளுபடி (Discount):</span>
                <span>-₹${discount.toFixed(2)}</span>
            </div>` : ''}
            <div class="receipt-divider notranslate" translate="no">--------------------------------</div>
            <div class="receipt-grand-total notranslate" translate="no">
                <span>மொத்தம் (Grand Total):</span>
                <span>₹${grandTotal.toFixed(2)}</span>
            </div>
            <div class="receipt-divider notranslate" translate="no">--------------------------------</div>
            <div class="receipt-sum-row">
                <span>பணம் முறை (Payment Method):</span>
                <span class="font-bold">${paymentMethod === 'Account' ? 'கடன் (Account)' : paymentMethod === 'UPI' ? 'UPI (ஆன்லைன்)' : 'ரொக்கம் (Cash)'}</span>
            </div>
            ${(isAccount && paymentMethod === 'Account') ? `
            <div class="receipt-sum-row">
                <span>முந்தைய பாக்கி (Old Bal):</span>
                <span>₹${oldBalance.toFixed(2)}</span>
            </div>
            <div class="receipt-sum-row">
                <span>தற்போதைய பில் (Current Bill):</span>
                <span>₹${grandTotal.toFixed(2)}</span>
            </div>
            <div class="receipt-sum-row" style="font-weight: bold;">
                <span>புதிய பாக்கி (New Bal Remaining):</span>
                <span>₹${remainingBalance.toFixed(2)}</span>
            </div>
            ` : (paymentMethod === 'UPI' ? `
            <div class="receipt-sum-row">
                <span>செலுத்தியது (Paid via UPI):</span>
                <span>₹${grandTotal.toFixed(2)}</span>
            </div>
            ` : (paymentMethod === 'Cash' && tendered > 0 ? `
            <div class="receipt-sum-row">
                <span>பெற்ற ரொக்கம் (Tendered):</span>
                <span>₹${tendered.toFixed(2)}</span>
            </div>
            <div class="receipt-sum-row">
                <span>மீதி ரொக்கம் (Change Return):</span>
                <span>₹${change.toFixed(2)}</span>
            </div>
            ` : ''))}
        </div>

        <div class="receipt-divider notranslate" translate="no">--------------------------------</div>

        <div class="receipt-footer notranslate" translate="no">
            <div class="receipt-footer-ta notranslate" translate="no">நன்றி! மீண்டும் வருக!</div>
            <div class="receipt-footer-en notranslate" translate="no">(Thank You! Visit Again!)</div>
        </div>
        <div class="thermal-paper-tear"></div>
    `;
}

// --- Preview Modal Controls ---
window.openBillPreview = async function() {
    if (cart.length === 0) {
        alert(currentLang === 'en' ? 'Cart is empty!' : 'கார்ட்டில் எந்த பொருளும் இல்லை!');
        return;
    }

    const paySelect = document.getElementById('invoice-payment-method');
    const custSelect = document.getElementById('invoice-customer-select');
    if (paySelect && paySelect.value === 'Account' && (!custSelect || !custSelect.value || custSelect.value === 'cash')) {
        alert(currentLang === 'en' ? 'Please select a customer account for Account payment!' : 'கடன் முறைக்கு வாடிக்கையாளர் கணக்கை தேர்ந்தெடுக்கவும்!');
        if (custSelect) custSelect.focus();
        return;
    }

    let nextNumber = 'INV-1001';
    try {
        const res = await API.get('/invoices/next-number');
        if (res && res.nextInvoiceNumber) {
            nextNumber = res.nextInvoiceNumber;
        }
    } catch(e) {
        console.warn('Could not fetch next invoice number, using fallback', e);
        nextNumber = document.getElementById('inv-number')?.innerText || 'INV-NEW';
    }

    const previewContainer = document.getElementById('receipt-preview-content');
    if (previewContainer) {
        previewContainer.innerHTML = generateReceiptHTML(nextNumber);
        // Ensure active paper size class
        if (currentThermalPaperSize === '58mm') {
            previewContainer.classList.add('paper-58mm');
            previewContainer.classList.remove('paper-80mm');
        } else {
            previewContainer.classList.add('paper-80mm');
            previewContainer.classList.remove('paper-58mm');
        }
    }

    const modal = document.getElementById('bill-preview-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
};

window.closeBillPreview = function() {
    const modal = document.getElementById('bill-preview-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
};

window.confirmPrintBill = async function() {
    if (cart.length === 0) return;

    const printBtn = document.getElementById('modal-print-btn');
    const originalText = printBtn ? printBtn.innerHTML : '';
    if (printBtn) {
        printBtn.disabled = true;
        printBtn.innerHTML = `<span>சேமித்து பிரிண்ட் ஆகிறது...</span>`;
    }

    const totalText = document.getElementById('cart-total').innerText.replace('₹', '');
    const grandTotal = Number(totalText) || 0;
    const subtotalText = document.getElementById('cart-subtotal').innerText.replace('₹', '');
    const subtotal = Number(subtotalText) || grandTotal;

    const discountInput = document.getElementById('cart-discount');
    const discount = discountInput ? Math.max(0, Number(discountInput.value) || 0) : 0;

    const custSelect = document.getElementById('invoice-customer-select');
    let customerName = 'Cash Customer';
    let accountId = null;
    if (custSelect && custSelect.value !== 'cash' && custSelect.value !== '') {
        const opt = custSelect.options[custSelect.selectedIndex];
        customerName = opt.getAttribute('data-name') || opt.innerText;
        accountId = Number(custSelect.value);
    }

    const paySelect = document.getElementById('invoice-payment-method');
    const paymentMethod = paySelect ? paySelect.value : 'Cash';

    if (paymentMethod === 'Account' && (!accountId || isNaN(accountId))) {
        alert(currentLang === 'en' ? 'Please select a customer account for Account payment!' : 'கடன் முறைக்கு வாடிக்கையாளர் கணக்கை தேர்ந்தெடுக்கவும்!');
        if (printBtn) {
            printBtn.disabled = false;
            printBtn.innerHTML = originalText;
        }
        closeBillPreview();
        const sel = document.getElementById('invoice-customer-select');
        if (sel) sel.focus();
        return;
    }

    const checkoutItems = cart.map(item => {
        let actualQty = item.rawQty;
        if (item.unit_type === 'kg' && item.selectedUnit === 'g') actualQty = item.rawQty / 1000;
        return {
            id: item.id,
            qty: actualQty,
            price: item.selling_price
        };
    });

    try {
        const res = await API.post('/checkout', {
            items: checkoutItems,
            total_amount: grandTotal,
            customer_name: customerName,
            payment_method: paymentMethod,
            subtotal: subtotal,
            discount: discount,
            account_id: accountId
        });

        if (res.success) {
            // Update receipt HTML with finalized official invoice number
            const previewContainer = document.getElementById('receipt-preview-content');
            if (previewContainer) {
                const invNumEls = previewContainer.querySelectorAll('.receipt-inv-num');
                invNumEls.forEach(el => el.innerText = res.invoiceNumber);
            }
            document.getElementById('inv-number').innerText = res.invoiceNumber;

            // Trigger thermal printer print command
            window.print();

            // Close modal after print
            closeBillPreview();

            // Update session metrics
            todayInvoices++;
            todaySales += grandTotal;
            const tendered = Number(document.getElementById('cash-tendered').value || grandTotal);
            todayCollected += tendered;

            // Reset billing screen state
            cart = [];
            document.getElementById('cash-tendered').value = '0';
            if (discountInput) discountInput.value = '0';
            setupNewInvoice();
            renderCart();
            loadAllViewsData();
        } else {
            alert("Checkout failed: " + res.error);
        }
    } catch(err) {
        alert("Checkout error: " + err.message);
    } finally {
        if (printBtn) {
            printBtn.disabled = false;
            printBtn.innerHTML = originalText;
        }
    }
};

async function handleCheckout() {
    if (cart.length === 0) {
        alert(currentLang === 'en' ? 'Cart is empty!' : 'கார்ட்டில் எந்த பொருளும் இல்லை!');
        return;
    }
    openBillPreview();
}

function updateMetrics() {
    document.getElementById('metric-sales').innerText = UI.formatCurrency(todaySales);
    document.getElementById('metric-invoices').innerText = todayInvoices;
    document.getElementById('metric-collected').innerText = UI.formatCurrency(todayCollected);
}

// --- STOCK ---
function renderStockView() {
    let products = currentProducts;
    const searchEl = document.getElementById('stock-search');
    const q = searchEl ? searchEl.value.trim().toLowerCase() : '';
    if (q) products = products.filter(p => (p.name_en && p.name_en.toLowerCase().includes(q)) || (p.name_ta && p.name_ta.includes(q)));

    let totalInv = 0;
    const tbody = document.getElementById('stock-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    products.forEach(p => {
        const value = p.stock_quantity * p.cost_price;
        totalInv += value;
        const tr = document.createElement('tr');
        const imgHtml = p.image_url 
            ? `<img src="${p.image_url}" class="table-prod-thumb" alt="${p.name_en}" onerror="this.outerHTML='<div class=\\'table-prod-thumb-placeholder\\'>📦</div>'">` 
            : `<div class="table-prod-thumb-placeholder">📦</div>`;

        tr.innerHTML = `
            <td>
                <div class="table-prod-cell">
                    ${imgHtml}
                    <div>
                        <b style="font-size: 15px;">${currentLang === 'en' ? p.name_en : p.name_ta}</b>
                        <div class="text-muted" style="font-size: 12px;">${currentLang === 'en' ? p.name_ta : p.name_en}</div>
                    </div>
                </div>
            </td>
            <td><b>${p.stock_quantity}</b></td>
            <td>${p.unit_type}</td>
            <td>${UI.formatCurrency(value)}</td>
            <td>
                <button class="btn-sm btn-primary" onclick="openEditProductModal(${p.id})">
                    ✏️ ${currentLang === 'en' ? 'Edit' : 'திருத்து'}
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('total-investment').innerText = UI.formatCurrency(totalInv);
}

// --- Edit Product Modal Logic ---
window.openEditProductModal = function(id) {
    const p = currentProducts.find(item => item.id == id);
    if (!p) return;

    document.getElementById('edit-prod-id').value = p.id;
    document.getElementById('edit-prod-current-image-url').value = p.image_url || '';
    document.getElementById('edit-prod-name-en').value = p.name_en || '';
    document.getElementById('edit-prod-name-ta').value = p.name_ta || '';
    document.getElementById('edit-prod-cost').value = p.cost_price || 0;
    document.getElementById('edit-prod-price').value = p.selling_price || 0;
    document.getElementById('edit-prod-unit').value = p.unit_type || 'pcs';

    const imgPreview = document.getElementById('edit-prod-img-preview');
    const noImgPlaceholder = document.getElementById('edit-prod-no-img');
    const removeBtn = document.getElementById('edit-prod-remove-img');
    const fileInput = document.getElementById('edit-prod-image-file');
    if (fileInput) fileInput.value = '';

    if (p.image_url) {
        imgPreview.src = p.image_url;
        imgPreview.style.display = 'block';
        noImgPlaceholder.style.display = 'none';
        removeBtn.style.display = 'inline-block';
    } else {
        imgPreview.src = '';
        imgPreview.style.display = 'none';
        noImgPlaceholder.style.display = 'flex';
        removeBtn.style.display = 'none';
    }

    document.getElementById('edit-product-modal').classList.remove('hidden');
};

window.closeEditProductModal = function() {
    document.getElementById('edit-product-modal').classList.add('hidden');
};

window.previewEditImage = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const imgPreview = document.getElementById('edit-prod-img-preview');
            const noImgPlaceholder = document.getElementById('edit-prod-no-img');
            const removeBtn = document.getElementById('edit-prod-remove-img');
            imgPreview.src = e.target.result;
            imgPreview.style.display = 'block';
            noImgPlaceholder.style.display = 'none';
            removeBtn.style.display = 'inline-block';
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.removeEditProductImage = function() {
    const fileInput = document.getElementById('edit-prod-image-file');
    if (fileInput) fileInput.value = '';
    document.getElementById('edit-prod-current-image-url').value = '';
    const imgPreview = document.getElementById('edit-prod-img-preview');
    const noImgPlaceholder = document.getElementById('edit-prod-no-img');
    const removeBtn = document.getElementById('edit-prod-remove-img');
    imgPreview.src = '';
    imgPreview.style.display = 'none';
    noImgPlaceholder.style.display = 'flex';
    removeBtn.style.display = 'none';
};

window.saveEditProduct = async function() {
    const id = document.getElementById('edit-prod-id').value;
    const nameEn = document.getElementById('edit-prod-name-en').value.trim();
    const nameTa = document.getElementById('edit-prod-name-ta').value.trim();
    const cost = Number(document.getElementById('edit-prod-cost').value) || 0;
    const price = Number(document.getElementById('edit-prod-price').value) || 0;
    const unit = document.getElementById('edit-prod-unit').value;

    if (!nameEn || !nameTa) {
        alert(currentLang === 'en' ? 'Please enter both English and Tamil names!' : 'ஆங்கிலம் மற்றும் தமிழ் பெயர்கள் இரண்டையும் உள்ளிடவும்!');
        return;
    }

    const saveBtn = document.getElementById('btn-save-edit-prod');
    const originalText = saveBtn ? saveBtn.innerText : '';
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerText = currentLang === 'en' ? 'Saving...' : 'சேமிக்கப்படுகிறது...';
    }

    let finalImageUrl = document.getElementById('edit-prod-current-image-url').value;

    const fileInput = document.getElementById('edit-prod-image-file');
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const formData = new FormData();
        formData.append('image', fileInput.files[0]);
        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.image_url) {
                finalImageUrl = data.image_url;
            }
        } catch (err) {
            console.error('Image upload failed', err);
        }
    }

    try {
        const updatePayload = {
            name_en: nameEn,
            name_ta: nameTa,
            image_url: finalImageUrl || null,
            cost_price: cost,
            selling_price: price,
            unit_type: unit
        };

        const res = await API.put(`/products/${id}`, updatePayload);
        if (res.success) {
            alert(currentLang === 'en' ? 'Item updated successfully!' : 'பொருள் விவரங்கள் புதுப்பிக்கப்பட்டன!');
            closeEditProductModal();
            loadAllViewsData();
        } else {
            alert("Update failed: " + (res.error || 'Unknown error'));
        }
    } catch(err) {
        alert("Update error: " + err.message);
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerText = originalText;
        }
    }
};

function renderRefillView() {
    const tbody = document.getElementById('refill-tbody');
    tbody.innerHTML = '';
    
    let products = currentProducts;
    if(document.getElementById('refill-search')) {
        const q = document.getElementById('refill-search').value.trim().toLowerCase();
        if (q) products = products.filter(p => p.name_en.toLowerCase().includes(q) || p.name_ta.includes(q));
    }

    products.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${UI.getProductName(p)}</td>
            <td>${p.stock_quantity} ${p.unit_type}</td>
            <td><input type="number" step="0.01" id="add-qty-${p.id}" placeholder="0"></td>
            <td><input type="date" id="add-exp-${p.id}" value="${p.expiry_date || ''}"></td>
            <td><button class="btn-primary" onclick="submitRefill(${p.id})">${currentLang==='en'?'Update':'புதுப்பி'}</button></td>
        `;
        tbody.appendChild(tr);
    });
}

window.submitRefill = async function(id) {
    const addQty = Number(document.getElementById(`add-qty-${id}`).value);
    const newExp = document.getElementById(`add-exp-${id}`).value;
    if (addQty <= 0 && !newExp) return;

    try {
        await API.put(`/products/${id}/stock`, { add_quantity: addQty, expiry_date: newExp });
        alert(currentLang==='en'?"Stock Updated!":"இருப்பு புதுப்பிக்கப்பட்டது!");
        loadAllViewsData();
    } catch(err) {
        alert("Update error: " + err.message);
    }
}

function renderPriceView() {
    const tbody = document.getElementById('price-tbody');
    tbody.innerHTML = '';

    currentProducts.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${UI.getProductName(p)} (${p.unit_type})</td>
            <td><input type="number" step="0.01" id="cost-${p.id}" value="${p.cost_price}"></td>
            <td><input type="number" step="0.01" id="price-${p.id}" value="${p.selling_price}"></td>
            <td><button class="btn-primary" onclick="submitPrice(${p.id})">${currentLang==='en'?'Save':'சேமி'}</button></td>
        `;
        tbody.appendChild(tr);
    });
}

window.submitPrice = async function(id) {
    const newCost = Number(document.getElementById(`cost-${id}`).value);
    const newPrice = Number(document.getElementById(`price-${id}`).value);
    
    try {
        await API.put(`/products/${id}/price`, { cost_price: newCost, selling_price: newPrice });
        alert(currentLang==='en'?"Prices Saved!":"விலை சேமிக்கப்பட்டது!");
        loadAllViewsData();
    } catch(err) {
        alert("Update error: " + err.message);
    }
}

async function handleAddProduct(e) {
    e.preventDefault();

    let uploadedImageUrl = null;
    const imageInput = document.getElementById('new-prod-image');
    if (imageInput && imageInput.files && imageInput.files.length > 0) {
        const formData = new FormData();
        formData.append('image', imageInput.files[0]);
        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.image_url) {
                uploadedImageUrl = data.image_url;
            }
        } catch (err) {
            console.error('Image upload failed', err);
        }
    }

    const newProd = {
        name_en: document.getElementById('new-prod-name-en').value,
        name_ta: document.getElementById('new-prod-name-ta').value,
        unit_type: document.getElementById('new-prod-unit').value,
        cost_price: Number(document.getElementById('new-prod-cost').value),
        selling_price: Number(document.getElementById('new-prod-price').value),
        stock_quantity: Number(document.getElementById('new-prod-stock').value),
        expiry_date: document.getElementById('new-prod-expiry').value || null,
        image_url: uploadedImageUrl
    };

    try {
        await API.post('/products', newProd);
        e.target.reset();
        alert(currentLang === 'en' ? 'Product added!' : 'பொருள் சேர்க்கப்பட்டது!');
        loadAllViewsData();
    } catch(err) {
        alert("Add error: " + err.message);
    }
}

function checkExpiryAlerts() {
    const today = new Date();
    const bellIcon = document.getElementById('expiry-bell');
    const alertsList = document.getElementById('alerts-list');
    
    if(!alertsList) return;
    alertsList.innerHTML = '';
    let hasAlerts = false;

    currentProducts.forEach(item => {
        if (item.expiry_date) {
            const expDate = new Date(item.expiry_date);
            const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
            
            if (diffDays <= 3) {
                hasAlerts = true;
                const li = document.createElement('li');
                const expFormatted = formatToDDMMYYYY(item.expiry_date, false);
                if (diffDays >= 0) {
                    li.innerText = `${UI.getProductName(item)} - ${item.stock_quantity} ${item.unit_type} (Expires: ${expFormatted}, in ${diffDays} days)`;
                } else {
                    li.innerText = `${UI.getProductName(item)} - ${item.stock_quantity} ${item.unit_type} (EXPIRED on ${expFormatted}!)`;
                }
                alertsList.appendChild(li);
            }
        }
    });

    if (hasAlerts) {
        bellIcon.classList.add('alerting');
    } else {
        bellIcon.classList.remove('alerting');
        alertsList.innerHTML = `<li>${currentLang==='en'?'No items expiring soon.':'விரைவில் காலாவதியாகும் பொருட்கள் இல்லை.'}</li>`;
    }
}

// --- PROFIT ANALYSIS ---
window.renderProfitView = async function(range = 'today', customDate = null) {
    if(!document.getElementById('profit-tbody')) return;
    
    let totalInv = 0;
    currentProducts.forEach(p => {
        totalInv += p.stock_quantity * p.cost_price;
    });
    document.getElementById('profit-total-investment').innerText = UI.formatCurrency(totalInv);
    
    try {
        const sales = await API.get('/sales');
        const today = new Date();
        let filteredSales = [];
        
        sales.forEach(sale => {
            const saleDate = new Date(sale.date);
            let include = false;
            
            if (range === 'today') {
                include = saleDate.toDateString() === today.toDateString();
            } else if (range === 'yesterday') {
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                include = saleDate.toDateString() === yesterday.toDateString();
            } else if (range === 'last-month') {
                let lastMonth = today.getMonth() - 1;
                let year = today.getFullYear();
                if(lastMonth < 0) {
                    lastMonth = 11;
                    year--;
                }
                include = saleDate.getMonth() === lastMonth && saleDate.getFullYear() === year;
            } else if (range === 'custom' && customDate) {
                const saleIsoDate = sale.date ? sale.date.split(/[ T]/)[0] : '';
                include = saleIsoDate === customDate;
            }
            
            if(include) filteredSales.push(sale);
        });
        
        const tbody = document.getElementById('profit-tbody');
        tbody.innerHTML = '';
        
        let totalProfit = 0;
        
        filteredSales.forEach(sale => {
            let saleCost = 0;
            sale.items.forEach(item => {
                saleCost += item.cost * item.qty;
            });
            
            const saleProfit = sale.total - saleCost;
            totalProfit += saleProfit;
            
            const tr = document.createElement('tr');
            const dateStr = formatToDDMMYYYY(sale.date, true);
            tr.innerHTML = `
                <td>${dateStr}</td>
                <td>${sale.id}</td>
                <td>${UI.formatCurrency(sale.total)}</td>
                <td>${UI.formatCurrency(saleCost)}</td>
                <td class="${saleProfit >= 0 ? 'text-success' : 'text-danger'}">${UI.formatCurrency(saleProfit)}</td>
            `;
            tbody.appendChild(tr);
        });
        
        document.getElementById('profit-amount').innerText = UI.formatCurrency(totalProfit);
        document.getElementById('profit-amount').className = totalProfit >= 0 ? 'text-success' : 'text-danger';
    } catch(err) {
        console.error(err);
    }
}

// --- INVOICES VIEW ---
window.renderInvoicesView = async function(range = 'today', customDate = null) {
    if(!document.getElementById('invoices-tbody')) return;
    
    try {
        const sales = await API.get('/sales');
        allSalesCache = sales || [];
        const today = new Date();
        let filteredSales = [];
        
        sales.forEach(sale => {
            const saleDate = new Date(sale.date);
            let include = false;
            
            if (range === 'today') {
                include = saleDate.toDateString() === today.toDateString();
            } else if (range === 'yesterday') {
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                include = saleDate.toDateString() === yesterday.toDateString();
            } else if (range === 'last-month') {
                let lastMonth = today.getMonth() - 1;
                let year = today.getFullYear();
                if(lastMonth < 0) {
                    lastMonth = 11;
                    year--;
                }
                include = saleDate.getMonth() === lastMonth && saleDate.getFullYear() === year;
            } else if (range === 'custom' && customDate) {
                const saleIsoDate = sale.date ? sale.date.split(/[ T]/)[0] : '';
                include = saleIsoDate === customDate;
            }
            
            if(include) filteredSales.push(sale);
        });
        
        const tbody = document.getElementById('invoices-tbody');
        tbody.innerHTML = '';
        
        filteredSales.sort((a,b) => new Date(b.date) - new Date(a.date));
        
        filteredSales.forEach(sale => {
            let totalItems = 0;
            if (sale.items) {
                sale.items.forEach(item => totalItems += Number(item.qty) || 0);
            }
            
            const tr = document.createElement('tr');
            tr.className = 'invoice-row-clickable';
            tr.title = currentLang === 'en' ? 'Click to view full invoice' : 'முழு பில்லை பார்க்க கிளிக் செய்யவும்';
            tr.onclick = () => openInvoiceModal(sale.id);

            const dateStr = formatToDDMMYYYY(sale.date, true);
            const payMethod = sale.payment_method || 'Cash';
            const payBadgeClass = `badge badge-${payMethod.toLowerCase()}`;
            const payLabel = payMethod === 'Account' ? (currentLang==='en'?'Account':'கடன்') : payMethod === 'UPI' ? 'UPI' : (currentLang==='en'?'Cash':'ரொக்கம்');

            tr.innerHTML = `
                <td><b style="font-family: monospace;">${dateStr}</b></td>
                <td><b>${sale.id}</b></td>
                <td>${sale.customer_name || 'Cash Customer'}</td>
                <td><span class="${payBadgeClass}">${payLabel}</span></td>
                <td>${totalItems}</td>
                <td class="text-blue"><b>${UI.formatCurrency(sale.total)}</b></td>
                <td>
                    <button class="btn-sm btn-outline-primary" onclick="event.stopPropagation(); openInvoiceModal('${sale.id}')">
                        👁️ ${currentLang==='en'?'View':'பார்க்க'}
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
    }
}

// --- Invoice Details Modal Controls ---
window.openInvoiceModal = async function(invNum) {
    let sale = allSalesCache.find(s => s.id === invNum);
    if (!sale) {
        try {
            sale = await API.get(`/invoices/${invNum}`);
        } catch(e) {
            console.error(e);
        }
    }
    if (!sale) {
        alert(currentLang === 'en' ? 'Invoice details not found' : 'பில் விவரங்கள் கிடைக்கவில்லை');
        return;
    }

    currentModalInvoice = sale;

    document.getElementById('inv-modal-number').innerText = sale.id;
    document.getElementById('inv-modal-date').innerText = formatToDDMMYYYY(sale.date, true);
    document.getElementById('inv-modal-customer').innerText = sale.customer_name || 'Cash Customer';
    
    const payMethod = sale.payment_method || 'Cash';
    document.getElementById('inv-modal-payment').innerText = payMethod;
    
    const badgeEl = document.getElementById('inv-modal-payment-badge');
    if (badgeEl) {
        badgeEl.className = `badge badge-${payMethod.toLowerCase()}`;
        badgeEl.innerText = payMethod === 'Account' ? (currentLang==='en'?'Account':'கடன்') : payMethod === 'UPI' ? 'UPI' : (currentLang==='en'?'Cash':'ரொக்கம்');
    }

    const alertBox = document.getElementById('inv-modal-account-alert');
    const alertText = document.getElementById('inv-modal-account-alert-text');
    if (payMethod === 'Account') {
        alertBox.style.display = 'flex';
        alertText.innerText = currentLang === 'en' 
            ? `Billed to Customer Credit Account: ${sale.customer_name}` 
            : `வாடிக்கையாளர் கடன் கணக்கில் சேர்க்கப்பட்டது: ${sale.customer_name}`;
    } else {
        alertBox.style.display = 'none';
    }

    const tbody = document.getElementById('inv-modal-items-tbody');
    tbody.innerHTML = '';

    if (sale.items && sale.items.length > 0) {
        sale.items.forEach((item, idx) => {
            const tr = document.createElement('tr');
            const itemName = currentLang === 'en' 
                ? (item.name_en || item.name_ta || `Item #${item.id || idx+1}`) 
                : (item.name_ta || item.name_en || `பொருள் #${item.id || idx+1}`);
            const itemTotal = Number(item.price) * Number(item.qty);
            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td>
                    <b>${itemName}</b>
                    ${item.name_en && item.name_ta && item.name_en !== item.name_ta ? `<div class="text-muted" style="font-size:12px;">${currentLang === 'en' ? item.name_ta : item.name_en}</div>` : ''}
                </td>
                <td>${item.qty} ${item.unit_type || ''}</td>
                <td>₹${Number(item.price).toFixed(2)}</td>
                <td><b>₹${itemTotal.toFixed(2)}</b></td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 15px; color: var(--text-muted);">No items recorded</td></tr>`;
    }

    const subtotal = sale.subtotal !== null && sale.subtotal !== undefined ? Number(sale.subtotal) : Number(sale.total);
    const discount = Number(sale.discount) || 0;
    const total = Number(sale.total);

    document.getElementById('inv-modal-subtotal').innerText = UI.formatCurrency(subtotal);
    const discLine = document.getElementById('inv-modal-discount-line');
    if (discount > 0) {
        document.getElementById('inv-modal-discount').innerText = `-₹${discount.toFixed(2)}`;
        discLine.style.display = 'flex';
    } else {
        discLine.style.display = 'none';
    }
    document.getElementById('inv-modal-total').innerText = UI.formatCurrency(total);

    document.getElementById('invoice-details-modal').classList.remove('hidden');
};

window.closeInvoiceModal = function() {
    document.getElementById('invoice-details-modal').classList.add('hidden');
};

window.printInvoiceFromModal = function() {
    if (!currentModalInvoice) return;
    const previewContainer = document.getElementById('receipt-preview-content');
    if (previewContainer) {
        previewContainer.innerHTML = generateReceiptHTMLForSale(currentModalInvoice);
        if (currentThermalPaperSize === '58mm') {
            previewContainer.classList.add('paper-58mm');
            previewContainer.classList.remove('paper-80mm');
        } else {
            previewContainer.classList.add('paper-80mm');
            previewContainer.classList.remove('paper-58mm');
        }
    }
    closeInvoiceModal();
    const billModal = document.getElementById('bill-preview-modal');
    if (billModal) billModal.classList.remove('hidden');
};

function generateReceiptHTMLForSale(sale) {
    const dateTimeStr = formatToDDMMYYYY(sale.date, true);
    const customerName = sale.customer_name || 'Cash Customer';
    const paymentMethod = sale.payment_method || 'Cash';

    let paymentMethodName = 'ரொக்கம் (Cash)';
    if (paymentMethod === 'Account') paymentMethodName = 'கடன் (Account)';
    else if (paymentMethod === 'UPI') paymentMethodName = 'UPI (ஆன்லைன்)';

    const itemsHtml = (sale.items || []).map(item => {
        const lineTotal = Number(item.price) * Number(item.qty);
        let nameLine = item.name_ta && item.name_en && item.name_ta !== item.name_en 
            ? `${item.name_ta} (${item.name_en})` 
            : (item.name_ta || item.name_en || 'பொருள்');
        let qtyRate = `${item.qty} ${item.unit_type || ''} x ₹${Number(item.price).toFixed(2)}`;

        return `
            <div class="receipt-item-row">
                <div class="receipt-item-name">${nameLine}</div>
                <div class="receipt-item-details">
                    <span class="receipt-item-qty-rate">${qtyRate}</span>
                    <span class="receipt-item-dots"></span>
                    <span class="receipt-item-total">₹${lineTotal.toFixed(2)}</span>
                </div>
            </div>
        `;
    }).join('');

    const subtotal = sale.subtotal !== null && sale.subtotal !== undefined ? Number(sale.subtotal) : Number(sale.total);
    const discount = Number(sale.discount) || 0;
    const grandTotal = Number(sale.total);

    return `
        <div class="receipt-header notranslate" translate="no">
            <div class="receipt-header-title notranslate" translate="no">ராஜா நாட்டு மருந்து & பலசரக்கு கடை</div>
            <div class="receipt-header-sub notranslate" translate="no">(Raja Naatu Marundhu & Palasarakku Kadai)</div>
        </div>

        <div class="receipt-meta notranslate" translate="no">
            <div class="receipt-meta-row">
                <span class="receipt-meta-label">பில் எண் (Bill Serial):</span>
                <span class="receipt-meta-val receipt-inv-num">${sale.id}</span>
            </div>
            <div class="receipt-meta-row">
                <span class="receipt-meta-label">தேதி (Date & Time):</span>
                <span class="receipt-meta-val">${dateTimeStr}</span>
            </div>
            <div class="receipt-meta-row">
                <span class="receipt-meta-label">வாடிக்கையாளர் (Customer):</span>
                <span class="receipt-meta-val">${customerName}</span>
            </div>
        </div>

        <div class="receipt-divider notranslate" translate="no">--------------------------------</div>

        <div class="receipt-items-list notranslate" translate="no">
            ${itemsHtml}
        </div>

        <div class="receipt-divider notranslate" translate="no">--------------------------------</div>

        <div class="receipt-summary notranslate" translate="no">
            <div class="receipt-sum-row">
                <span>உப மொத்தம் (Subtotal):</span>
                <span class="font-bold">₹${subtotal.toFixed(2)}</span>
            </div>
            ${discount > 0 ? `
            <div class="receipt-sum-row">
                <span>தள்ளுபடி (Discount):</span>
                <span>-₹${discount.toFixed(2)}</span>
            </div>` : ''}
            <div class="receipt-divider notranslate" translate="no">--------------------------------</div>
            <div class="receipt-grand-total notranslate" translate="no">
                <span>மொத்தம் (Grand Total):</span>
                <span>₹${grandTotal.toFixed(2)}</span>
            </div>
            <div class="receipt-divider notranslate" translate="no">--------------------------------</div>
            <div class="receipt-sum-row">
                <span>பணம் முறை (Payment Method):</span>
                <span class="font-bold">${paymentMethodName}</span>
            </div>
        </div>

        <div class="receipt-divider notranslate" translate="no">--------------------------------</div>

        <div class="receipt-footer notranslate" translate="no">
            <div class="receipt-footer-ta notranslate" translate="no">நன்றி! மீண்டும் வருக!</div>
            <div class="receipt-footer-en notranslate" translate="no">(Thank You! Visit Again!)</div>
        </div>
        <div class="thermal-paper-tear"></div>
    `;
}

// --- ACCOUNTS ---
window.switchAccountTab = function(tab) {
    currentAccountsTab = tab;
    document.getElementById('tab-btn-active').classList.toggle('active', tab === 'active');
    document.getElementById('tab-btn-history').classList.toggle('active', tab === 'history');
    renderAccountsView();
}

window.renderAccountsView = async function() {
    if(!document.getElementById('accounts-tbody')) return;
    
    try {
        let endpoint = currentAccountsTab === 'active' ? '/accounts' : '/accounts/history';
        let accounts = await API.get(endpoint);
        
        const q = document.getElementById('account-search').value.trim().toLowerCase();
        if (q) {
            accounts = accounts.filter(a => a.customer_name.toLowerCase().includes(q));
        }
        
        const tbody = document.getElementById('accounts-tbody');
        tbody.innerHTML = '';
        
        accounts.forEach(acc => {
            const tr = document.createElement('tr');
            let actionBtn = '';
            
            if (currentAccountsTab === 'active') {
                actionBtn = `<button class="btn-primary" onclick="openPaymentModal(${acc.id}, ${acc.balance_amount})" style="padding: 6px 12px; font-size:14px; margin-right: 5px;">
                    <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:white;vertical-align:bottom;margin-right:4px;"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>${currentLang==='en'?'Edit / Pay':'செலுத்து'}
                </button>`;
            } else {
                actionBtn = `<span class="text-success" style="font-weight:bold; padding: 6px 12px; background: #d1fae5; border-radius: 4px;">FINISHED</span>`;
            }

            tr.innerHTML = `
                <td>${acc.customer_name}</td>
                <td>${formatToDDMMYYYY(acc.start_date, false)}</td>
                <td><b>${UI.formatCurrency(acc.balance_amount)}</b></td>
                <td>
                    ${actionBtn}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
    }
}

window.populateInvoicesDropdown = async function() {
    const select = document.getElementById('acc-invoice');
    if(!select) return;
    
    try {
        const sales = await API.get('/sales');
        select.innerHTML = '<option value="">-- Select Invoice --</option>';
        
        const recent = sales.slice(0, 20);
        recent.forEach(sale => {
            const dateStr = formatToDDMMYYYY(sale.date, false);
            const opt = document.createElement('option');
            opt.value = sale.id;
            opt.innerText = `${sale.id} - ${dateStr} - ${UI.formatCurrency(sale.total)}`;
            opt.setAttribute('data-total', sale.total);
            select.appendChild(opt);
        });
    } catch(err) {}
}

window.handleNewAccount = async function(e) {
    e.preventDefault();
    const name = document.getElementById('acc-name').value;
    const date = document.getElementById('acc-date').value;
    let initialBalance = Number(document.getElementById('acc-balance').value);
    
    const invoiceSelect = document.getElementById('acc-invoice');
    
    if (invoiceSelect.value) {
        const selectedOption = invoiceSelect.options[invoiceSelect.selectedIndex];
        const invoiceTotal = Number(selectedOption.getAttribute('data-total'));
        initialBalance += invoiceTotal;
    }
    
    try {
        await API.post('/accounts', { customer_name: name, start_date: date, balance_amount: initialBalance });
        e.target.reset();
        alert(currentLang === 'en' ? 'Account created successfully!' : 'கணக்கு வெற்றிகரமாக உருவாக்கப்பட்டது!');
        UI.switchView('accounts-view');
    } catch (err) {
        alert("Account creation error: " + err.message);
    }
}

// Payment Modal Logic
window.openPaymentModal = function(id, balance) {
    document.getElementById('modal-account-id').value = id;
    document.getElementById('modal-current-balance').innerText = UI.formatCurrency(balance);
    document.getElementById('modal-paid-amount').value = '';
    document.getElementById('payment-modal').classList.remove('hidden');
}

window.closePaymentModal = function() {
    document.getElementById('payment-modal').classList.add('hidden');
}

window.submitPayment = async function() {
    const id = document.getElementById('modal-account-id').value;
    const paid = Number(document.getElementById('modal-paid-amount').value);
    
    if(!paid || paid <= 0) return;
    
    try {
        const res = await API.post(`/accounts/${id}/pay`, { paid_amount: paid });
        if (res.success) {
            alert(currentLang === 'en' ? 'Payment Successful!' : 'பணம் வெற்றிகரமாக செலுத்தப்பட்டது!');
            closePaymentModal();
            renderAccountsView();
            loadCustomerAccountsForBilling();
        } else {
            alert("Payment Error: " + (res.error || 'Failed'));
        }
    } catch(err) {
        alert("Payment Error: " + err.message);
    }
}
