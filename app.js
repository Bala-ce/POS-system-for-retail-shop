// App State
let currentLang = 'ta'; // 'ta' or 'en'
let cart = [];
let todayInvoices = 0;
let todaySales = 0;
let todayCollected = 0;

// Date formatter in DD/MM/YYYY
function formatToDDMMYYYY(dateInput, includeTime = true) {
    if (!dateInput) return '-';
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
        const [yyyy, mm, dd] = dateInput.trim().split('-');
        return `${dd}/${mm}/${yyyy}`;
    }
    const d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    if (!includeTime) return `${dd}/${mm}/${yyyy}`;
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const hh = String(hours).padStart(2, '0');
    return `${dd}/${mm}/${yyyy}, ${hh}:${minutes} ${ampm}`;
}

// LocalStorage Mock API
const MOCK_API = {
    getDb() {
        const db = localStorage.getItem('pos_db_v2');
        if (db) return JSON.parse(db);
        // Initial Mock Data
        const initialDb = {
            products: [
                { id: 1, name_en: "Rice", name_ta: "அரிசி", unit: "kg", cost: 45, price: 50, stock: 100, expiry: "2026-12-31" },
                { id: 2, name_en: "Sugar", name_ta: "சர்க்கரை", unit: "kg", cost: 38, price: 42, stock: 50, expiry: "2025-10-10" },
                { id: 3, name_en: "Milk (Aavin)", name_ta: "பால் (ஆவின்)", unit: "pkt", cost: 22, price: 25, stock: 20, expiry: "2026-09-12" }, // Expiring soon
                { id: 4, name_en: "Soap (Santoor)", name_ta: "சோப்பு (சந்தூர்)", unit: "pcs", cost: 30, price: 35, stock: 150, expiry: "2027-01-01" },
                { id: 5, name_en: "Toor Dal", name_ta: "துவரம் பருப்பு", unit: "kg", cost: 110, price: 130, stock: 40, expiry: "2026-11-20" }
            ],
            sales: [],
            accounts: []
        };
        this.saveDb(initialDb);
        return initialDb;
    },
    saveDb(db) {
        localStorage.setItem('pos_db_v2', JSON.stringify(db));
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
        // Update Nav Buttons
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        if(btnElement) btnElement.classList.add('active');

        // Update Views
        document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');

        // Load data if needed
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
    // Nav Click Listeners
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            UI.switchView(btn.getAttribute('data-target'), btn.closest('.nav-btn'));
        });
    });

    // Language Toggle
    document.getElementById('lang-toggle').addEventListener('click', UI.toggleLanguage);

    // Search Listeners
    document.getElementById('catalog-search').addEventListener('input', UI.debounce(renderCatalog, 300));
    document.getElementById('stock-search').addEventListener('input', UI.debounce(renderStockView, 300));

    // Cash Calc
    document.getElementById('cash-tendered').addEventListener('input', calculateChange);

    // Stock View Sub-Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target.getAttribute('data-tab');
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(target).classList.add('active');
        });
    });

    // Invoices Filters
    document.querySelectorAll('.btn-filter-inv').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.btn-filter-inv').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById('invoices-custom-date').value = ''; // clear custom date
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

    // Clear Cart
    document.getElementById('clear-cart-btn').addEventListener('click', () => {
        if(confirm(currentLang==='en' ? "Clear cart?" : "பில்லை அழிக்கவா?")) {
            cart = [];
            document.getElementById('cash-tendered').value = '0';
            renderCart();
        }
    });

    // Checkout
    document.getElementById('checkout-btn').addEventListener('click', handleCheckout);

    // Add Product Form
    document.getElementById('add-product-form').addEventListener('submit', handleAddProduct);

    // Profit Filters
    document.querySelectorAll('.btn-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById('profit-custom-date').value = ''; // clear custom date
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

    // Accounts Search & Form
    if(document.getElementById('account-search')) {
        document.getElementById('account-search').addEventListener('input', UI.debounce(renderAccountsView, 300));
        document.getElementById('new-account-form').addEventListener('submit', handleNewAccount);
    }

    // Init App
    setupNewInvoice();
    UI.updateTranslations();
    loadAllViewsData();
});


function loadAllViewsData() {
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
    if (document.getElementById('invoices-tbody')) {
        renderInvoicesView(document.querySelector('.btn-filter-inv.active') ? document.querySelector('.btn-filter-inv.active').getAttribute('data-range') : 'today');
    }
}

// --- BILLING / CATALOG VIEW ---

function renderCatalog() {
    const q = document.getElementById('catalog-search').value.trim().toLowerCase();
    const db = MOCK_API.getDb();
    let products = db.products;

    if (q) {
        products = products.filter(p => p.name_en.toLowerCase().includes(q) || p.name_ta.includes(q));
    }

    const grid = document.getElementById('catalog-grid');
    grid.innerHTML = '';

    products.forEach(p => {
        const div = document.createElement('div');
        div.className = 'product-card';
        div.innerHTML = `
            <div class="prod-title">${UI.getProductName(p)}</div>
            <div class="prod-price">${UI.formatCurrency(p.price)} <small>/ ${p.unit}</small></div>
            <div class="prod-stock">Stock: ${p.stock}</div>
            <button class="btn-add" onclick='addToCart(${JSON.stringify(p)})'>+</button>
        `;
        grid.appendChild(div);
    });
}

window.addToCart = function(product) {
    const existing = cart.find(i => i.id === product.id);
    if (existing) {
        // Loose items add 1.0, packed items add 1
        existing.qty += (product.unit === 'kg' || product.unit === 'g') ? 1.0 : 1;
    } else {
        cart.push({ ...product, qty: 1 });
    }
    renderCart();
}

window.updateCartQty = function(id, val) {
    const item = cart.find(i => i.id === id);
    if (item) {
        item.qty = Number(val);
        if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
        renderCart();
    }
}

window.changeCartQty = function(id, delta) {
    const item = cart.find(i => i.id === id);
    if (item) {
        item.qty += delta;
        if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
        renderCart();
    }
}

function renderCart() {
    const tbody = document.getElementById('invoice-items');
    tbody.innerHTML = '';
    let subtotal = 0;

    cart.forEach(item => {
        const lineTotal = item.price * item.qty;
        subtotal += lineTotal;

        // Determine Dual Quantity UI
        let qtyUI = '';
        if (item.unit === 'kg' || item.unit === 'g') {
            // Loose Items (Manual input with unit display)
            qtyUI = `
                <div class="qty-control-loose">
                    <input type="number" step="0.05" min="0" value="${item.qty}" onchange="updateCartQty(${item.id}, this.value)">
                    <span style="font-size:12px">${item.unit}</span>
                </div>
            `;
        } else {
            // Packed Items (+/- buttons)
            qtyUI = `
                <div class="qty-control-discrete">
                    <button class="qty-btn minus" onclick="changeCartQty(${item.id}, -1)">-</button>
                    <input type="text" class="qty-input" value="${item.qty}" readonly>
                    <button class="qty-btn plus" onclick="changeCartQty(${item.id}, 1)">+</button>
                </div>
            `;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <span class="inv-item-name">${UI.getProductName(item)}</span>
                <span class="inv-item-price">@ ${UI.formatCurrency(item.price)}</span>
            </td>
            <td>
                ${qtyUI}
                <!-- Hidden span for print layout -->
                <span style="display:none;" class="print-qty">${item.qty} ${item.unit}</span>
            </td>
            <td><b>${UI.formatCurrency(lineTotal)}</b></td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('cart-subtotal').innerText = UI.formatCurrency(subtotal);
    document.getElementById('cart-tax').innerText = '₹0.00';
    document.getElementById('cart-total').innerText = UI.formatCurrency(subtotal);
    calculateChange();
}

window.addCash = function(amt) {
    const input = document.getElementById('cash-tendered');
    input.value = Number(input.value) + amt;
    calculateChange();
}

function calculateChange() {
    const totalText = document.getElementById('cart-total').innerText.replace('₹', '');
    const total = Number(totalText);
    const tendered = Number(document.getElementById('cash-tendered').value);
    const change = tendered > total ? tendered - total : 0;
    document.getElementById('cash-change').innerText = UI.formatCurrency(change);
}

function setupNewInvoice() {
    const date = new Date();
    document.getElementById('inv-date').innerText = formatToDDMMYYYY(date, true);
    const db = MOCK_API.getDb();
    const nextId = 1000 + db.sales.length + 1;
    document.getElementById('inv-number').innerText = `INV-${nextId}`;
}

function handleCheckout() {
    if (cart.length === 0) return;

    window.print();

    // Save to DB
    const db = MOCK_API.getDb();
    const totalText = document.getElementById('cart-total').innerText.replace('₹', '');
    
    db.sales.push({
        id: document.getElementById('inv-number').innerText,
        date: new Date().toISOString(),
        items: cart,
        total: Number(totalText)
    });

    // Reduce stock
    cart.forEach(cartItem => {
        const p = db.products.find(prod => prod.id === cartItem.id);
        if (p) p.stock -= cartItem.qty;
    });

    MOCK_API.saveDb(db);

    // Update session metrics
    todayInvoices++;
    todaySales += Number(totalText);
    todayCollected += Number(document.getElementById('cash-tendered').value || totalText); // Approximate collection if tendered is 0

    // Reset
    cart = [];
    document.getElementById('cash-tendered').value = '0';
    setupNewInvoice();
    renderCart();
    loadAllViewsData();
}

function updateMetrics() {
    document.getElementById('metric-sales').innerText = UI.formatCurrency(todaySales);
    document.getElementById('metric-invoices').innerText = todayInvoices;
    document.getElementById('metric-collected').innerText = UI.formatCurrency(todayCollected);
}


// --- STOCK & MANAGEMENT VIEWS ---

function renderStockView() {
    const db = MOCK_API.getDb();
    let products = db.products;
    
    const q = document.getElementById('stock-search').value.trim().toLowerCase();
    if (q) products = products.filter(p => p.name_en.toLowerCase().includes(q) || p.name_ta.includes(q));

    let totalInv = 0;
    const tbody = document.getElementById('stock-tbody');
    tbody.innerHTML = '';

    products.forEach(p => {
        const value = p.stock * p.cost;
        totalInv += value;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${UI.getProductName(p)}</td>
            <td><b>${p.stock}</b></td>
            <td>${p.unit}</td>
            <td>${UI.formatCurrency(value)}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('total-investment').innerText = UI.formatCurrency(totalInv);
}

function renderRefillView() {
    const db = MOCK_API.getDb();
    const tbody = document.getElementById('refill-tbody');
    tbody.innerHTML = '';

    db.products.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${UI.getProductName(p)}</td>
            <td>${p.stock} ${p.unit}</td>
            <td><input type="number" step="0.01" id="add-qty-${p.id}" placeholder="0"></td>
            <td><input type="date" id="add-exp-${p.id}" value="${p.expiry || ''}"></td>
            <td><button class="btn-primary" onclick="submitRefill(${p.id})">${currentLang==='en'?'Update':'புதுப்பி'}</button></td>
        `;
        tbody.appendChild(tr);
    });
}

window.submitRefill = function(id) {
    const addQty = Number(document.getElementById(`add-qty-${id}`).value);
    const newExp = document.getElementById(`add-exp-${id}`).value;
    if (addQty <= 0 && !newExp) return;

    const db = MOCK_API.getDb();
    const p = db.products.find(prod => prod.id === id);
    if (p) {
        if (addQty > 0) p.stock += addQty;
        if (newExp) p.expiry = newExp;
        MOCK_API.saveDb(db);
        alert(currentLang==='en'?"Stock Updated!":"இருப்பு புதுப்பிக்கப்பட்டது!");
        loadAllViewsData();
    }
}

function renderPriceView() {
    const db = MOCK_API.getDb();
    const tbody = document.getElementById('price-tbody');
    tbody.innerHTML = '';

    db.products.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${UI.getProductName(p)} (${p.unit})</td>
            <td><input type="number" step="0.01" id="cost-${p.id}" value="${p.cost}"></td>
            <td><input type="number" step="0.01" id="price-${p.id}" value="${p.price}"></td>
            <td><button class="btn-primary" onclick="submitPrice(${p.id})">${currentLang==='en'?'Save':'சேமி'}</button></td>
        `;
        tbody.appendChild(tr);
    });
}

window.submitPrice = function(id) {
    const newCost = Number(document.getElementById(`cost-${id}`).value);
    const newPrice = Number(document.getElementById(`price-${id}`).value);
    
    const db = MOCK_API.getDb();
    const p = db.products.find(prod => prod.id === id);
    if (p) {
        p.cost = newCost;
        p.price = newPrice;
        MOCK_API.saveDb(db);
        alert(currentLang==='en'?"Prices Saved!":"விலை சேமிக்கப்பட்டது!");
        loadAllViewsData();
    }
}

function handleAddProduct(e) {
    e.preventDefault();
    const newProd = {
        id: Date.now(),
        name_en: document.getElementById('new-prod-name-en').value,
        name_ta: document.getElementById('new-prod-name-ta').value,
        unit: document.getElementById('new-prod-unit').value,
        cost: Number(document.getElementById('new-prod-cost').value),
        price: Number(document.getElementById('new-prod-price').value),
        stock: Number(document.getElementById('new-prod-stock').value),
        expiry: document.getElementById('new-prod-expiry').value || null
    };

    const db = MOCK_API.getDb();
    db.products.push(newProd);
    MOCK_API.saveDb(db);
    
    e.target.reset();
    alert(currentLang === 'en' ? 'Product added!' : 'பொருள் சேர்க்கப்பட்டது!');
    loadAllViewsData();
}

// --- EXPIRY BELL LOGIC ---
function checkExpiryAlerts() {
    const db = MOCK_API.getDb();
    const today = new Date();
    const bellIcon = document.getElementById('expiry-bell');
    const alertsList = document.getElementById('alerts-list');
    
    alertsList.innerHTML = '';
    let hasAlerts = false;

    db.products.forEach(item => {
        if (item.expiry) {
            const expDate = new Date(item.expiry);
            const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
            
            if (diffDays <= 3) {
                hasAlerts = true;
                const li = document.createElement('li');
                if (diffDays >= 0) {
                    li.innerText = `${UI.getProductName(item)} - ${item.stock} ${item.unit} (Expires in ${diffDays} days)`;
                } else {
                    li.innerText = `${UI.getProductName(item)} - ${item.stock} ${item.unit} (EXPIRED!)`;
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

// --- PROFIT ANALYSIS LOGIC ---
window.renderProfitView = function(range = 'today', customDate = null) {
    if(!document.getElementById('profit-tbody')) return;
    
    const db = MOCK_API.getDb();
    
    // Total Investment
    let totalInv = 0;
    db.products.forEach(p => {
        totalInv += p.stock * p.cost;
    });
    document.getElementById('profit-total-investment').innerText = UI.formatCurrency(totalInv);
    
    // Filter Sales
    const today = new Date();
    let filteredSales = [];
    
    db.sales.forEach(sale => {
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
            const saleIsoDate = sale.date.split('T')[0];
            include = saleIsoDate === customDate;
        }
        
        if(include) filteredSales.push(sale);
    });
    
    // Render Sales & Calc Profit
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
}

// --- ACCOUNTS MANAGEMENT LOGIC ---
window.renderAccountsView = function() {
    if(!document.getElementById('accounts-tbody')) return;
    const db = MOCK_API.getDb();
    if(!db.accounts) {
        db.accounts = [];
        MOCK_API.saveDb(db);
    }
    
    const q = document.getElementById('account-search').value.trim().toLowerCase();
    let accounts = db.accounts;
    if (q) {
        accounts = accounts.filter(a => a.name.toLowerCase().includes(q));
    }
    
    const tbody = document.getElementById('accounts-tbody');
    tbody.innerHTML = '';
    
    accounts.forEach(acc => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${acc.name}</td>
            <td>${formatToDDMMYYYY(acc.date, false)}</td>
            <td><b>${UI.formatCurrency(acc.balance)}</b></td>
            <td><button class="btn-primary" onclick="viewAccountDetails(${acc.id})" style="padding: 6px 12px; font-size:14px;">${currentLang==='en'?'View':'பார்க்க'}</button></td>
        `;
        tbody.appendChild(tr);
    });
}

window.populateInvoicesDropdown = function() {
    const db = MOCK_API.getDb();
    const select = document.getElementById('acc-invoice');
    if(!select) return;
    
    select.innerHTML = '<option value="">-- Select Invoice --</option>';
    
    // Show last 20 invoices
    const recent = db.sales.slice(-20).reverse();
    recent.forEach(sale => {
        const dateStr = formatToDDMMYYYY(sale.date, false);
        const opt = document.createElement('option');
        opt.value = sale.id;
        opt.innerText = `${sale.id} - ${dateStr} - ${UI.formatCurrency(sale.total)}`;
        opt.setAttribute('data-total', sale.total);
        select.appendChild(opt);
    });
}

window.handleNewAccount = function(e) {
    e.preventDefault();
    const name = document.getElementById('acc-name').value;
    const date = document.getElementById('acc-date').value;
    let initialBalance = Number(document.getElementById('acc-balance').value);
    
    const invoiceSelect = document.getElementById('acc-invoice');
    const selectedInvoiceId = invoiceSelect.value;
    let linkedInvoices = [];
    
    if (selectedInvoiceId) {
        const selectedOption = invoiceSelect.options[invoiceSelect.selectedIndex];
        const invoiceTotal = Number(selectedOption.getAttribute('data-total'));
        initialBalance += invoiceTotal;
        linkedInvoices.push(selectedInvoiceId);
    }
    
    const newAccount = {
        id: Date.now(),
        name,
        date,
        balance: initialBalance,
        invoices: linkedInvoices
    };
    
    const db = MOCK_API.getDb();
    if(!db.accounts) db.accounts = [];
    db.accounts.push(newAccount);
    MOCK_API.saveDb(db);
    
    e.target.reset();
    alert(currentLang === 'en' ? 'Account created successfully!' : 'கணக்கு வெற்றிகரமாக உருவாக்கப்பட்டது!');
    UI.switchView('accounts-view');
}

window.viewAccountDetails = function(id) {
    const db = MOCK_API.getDb();
    const account = db.accounts.find(a => a.id === id);
    if(!account) return;
    
    document.getElementById('det-acc-name').innerText = account.name;
    document.getElementById('det-acc-date').innerText = formatToDDMMYYYY(account.date, false);
    document.getElementById('det-acc-balance').innerText = UI.formatCurrency(account.balance);
    
    const list = document.getElementById('det-acc-invoices');
    list.innerHTML = '';
    if(account.invoices && account.invoices.length > 0) {
        account.invoices.forEach(invId => {
            const li = document.createElement('li');
            li.innerText = invId;
            list.appendChild(li);
        });
    } else {
        list.innerHTML = `<li>${currentLang === 'en' ? 'None' : 'எதுவுமில்லை'}</li>`;
    }
    
    const deleteBtn = document.getElementById('btn-delete-account');
    deleteBtn.onclick = () => deleteAccount(id);
    
    UI.switchView('account-detail-view');
}

window.deleteAccount = function(id) {
    if(confirm(currentLang === 'en' ? 'Confirm deletion of this account? Ensure balance is paid.' : 'இந்த கணக்கை நீக்க உறுதிப்படுத்தவும். பாக்கி செலுத்தப்பட்டுள்ளதா என்பதை உறுதிசெய்யவும்.')) {
        const db = MOCK_API.getDb();
        db.accounts = db.accounts.filter(a => a.id !== id);
        MOCK_API.saveDb(db);
        
        alert(currentLang === 'en' ? 'Account deleted!' : 'கணக்கு நீக்கப்பட்டது!');
        UI.switchView('accounts-view');
    }
}

// --- INVOICES VIEW LOGIC ---
window.renderInvoicesView = function(range = 'today', customDate = null) {
    if(!document.getElementById('invoices-tbody')) return;
    
    const db = MOCK_API.getDb();
    const today = new Date();
    let filteredSales = [];
    
    db.sales.forEach(sale => {
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
            const saleIsoDate = sale.date.split('T')[0];
            include = saleIsoDate === customDate;
        }
        
        if(include) filteredSales.push(sale);
    });
    
    const tbody = document.getElementById('invoices-tbody');
    tbody.innerHTML = '';
    
    // Sort descending by date
    filteredSales.sort((a,b) => new Date(b.date) - new Date(a.date));
    
    filteredSales.forEach(sale => {
        let totalItems = 0;
        sale.items.forEach(item => totalItems += item.qty);
        
        const tr = document.createElement('tr');
        const dateStr = formatToDDMMYYYY(sale.date, true);
        tr.innerHTML = `
            <td>${dateStr}</td>
            <td><b>${sale.id}</b></td>
            <td>${totalItems}</td>
            <td class="text-blue"><b>${UI.formatCurrency(sale.total)}</b></td>
        `;
        tbody.appendChild(tr);
    });
}
