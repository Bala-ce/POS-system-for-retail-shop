const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for local uploads
const upload = multer({ dest: path.join(__dirname, 'public/uploads') });

// Ensure uploads directory exists
if (!fs.existsSync(path.join(__dirname, 'public/uploads'))) {
    fs.mkdirSync(path.join(__dirname, 'public/uploads'), { recursive: true });
}

// DB Init
const dbPath = path.join(__dirname, 'shop.db');
const db = new Database(dbPath);

// Create Tables
db.exec(`
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_url TEXT,
        item_code TEXT UNIQUE,
        name_en TEXT NOT NULL,
        name_ta TEXT NOT NULL,
        cost_price REAL NOT NULL,
        selling_price REAL NOT NULL,
        unit_type TEXT NOT NULL,
        stock_quantity REAL NOT NULL DEFAULT 0.0,
        expiry_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        balance_amount REAL NOT NULL DEFAULT 0.0,
        start_date DATE NOT NULL,
        is_deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS account_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER REFERENCES accounts(id),
        paid_amount REAL NOT NULL,
        previous_balance REAL NOT NULL,
        remaining_balance REAL NOT NULL,
        payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'PARTIAL',
        type TEXT DEFAULT 'PAYMENT',
        invoice_id INTEGER,
        note TEXT
    );

    CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE NOT NULL,
        customer_name TEXT DEFAULT 'Cash Customer',
        payment_method TEXT DEFAULT 'Cash',
        subtotal REAL DEFAULT 0.0,
        discount REAL DEFAULT 0.0,
        account_id INTEGER,
        total_amount REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER REFERENCES invoices(id),
        product_id INTEGER REFERENCES products(id),
        quantity REAL NOT NULL,
        price REAL NOT NULL
    );
`);

// Safe migrations for existing databases
try { db.exec("ALTER TABLE invoices ADD COLUMN customer_name TEXT DEFAULT 'Cash Customer'"); } catch(e) {}
try { db.exec("ALTER TABLE invoices ADD COLUMN payment_method TEXT DEFAULT 'Cash'"); } catch(e) {}
try { db.exec("ALTER TABLE invoices ADD COLUMN subtotal REAL DEFAULT 0.0"); } catch(e) {}
try { db.exec("ALTER TABLE invoices ADD COLUMN discount REAL DEFAULT 0.0"); } catch(e) {}
try { db.exec("ALTER TABLE invoices ADD COLUMN account_id INTEGER"); } catch(e) {}

// APIs

app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ image_url: '/uploads/' + req.file.filename });
});

// --- Invoices Helper ---
app.get('/api/invoices/next-number', (req, res) => {
    try {
        const info = db.prepare('SELECT COUNT(*) as count FROM invoices').get();
        const nextInvoiceNumber = 'INV-' + (1000 + info.count + 1);
        res.json({ nextInvoiceNumber });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Products ---
app.get('/api/products', (req, res) => {
    const products = db.prepare('SELECT * FROM products').all();
    res.json(products);
});

const handleAddProduct = (req, res) => {
    let { name_en, name_ta, unit_type, cost_price, selling_price, stock_quantity, expiry_date, image_url } = req.body;
    const item_code = 'ITEM-' + Date.now();
    
    // Base pricing logic for 1/2 kg
    if (unit_type === 'kg') {
        cost_price = Number(cost_price) * 2;
        selling_price = Number(selling_price) * 2;
    }

    try {
        const stmt = db.prepare(`
            INSERT INTO products (item_code, name_en, name_ta, unit_type, cost_price, selling_price, stock_quantity, expiry_date, image_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(item_code, name_en, name_ta, unit_type, cost_price, selling_price, stock_quantity, expiry_date || null, image_url || null);
        res.json({ success: true, id: info.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

app.post('/api/products/add', handleAddProduct);
app.post('/api/products', handleAddProduct);

// Edit Product Details (Name en/ta, image_url, pricing, unit)
app.put('/api/products/:id', (req, res) => {
    const { name_en, name_ta, image_url, cost_price, selling_price, unit_type } = req.body;
    try {
        const current = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
        if (!current) return res.status(404).json({ error: 'Product not found' });

        const updatedNameEn = name_en !== undefined ? name_en : current.name_en;
        const updatedNameTa = name_ta !== undefined ? name_ta : current.name_ta;
        const updatedImageUrl = image_url !== undefined ? image_url : current.image_url;
        const updatedCost = cost_price !== undefined ? Number(cost_price) : current.cost_price;
        const updatedPrice = selling_price !== undefined ? Number(selling_price) : current.selling_price;
        const updatedUnit = unit_type !== undefined ? unit_type : current.unit_type;

        db.prepare(`
            UPDATE products 
            SET name_en = ?, name_ta = ?, image_url = ?, cost_price = ?, selling_price = ?, unit_type = ?
            WHERE id = ?
        `).run(updatedNameEn, updatedNameTa, updatedImageUrl, updatedCost, updatedPrice, updatedUnit, req.params.id);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/products/:id/stock', (req, res) => {
    const { add_quantity, expiry_date } = req.body;
    try {
        const stmt = db.prepare('UPDATE products SET stock_quantity = stock_quantity + ?, expiry_date = COALESCE(?, expiry_date) WHERE id = ?');
        stmt.run(add_quantity || 0, expiry_date || null, req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/products/:id/price', (req, res) => {
    const { cost_price, selling_price } = req.body;
    try {
        const stmt = db.prepare('UPDATE products SET cost_price = ?, selling_price = ? WHERE id = ?');
        stmt.run(cost_price, selling_price, req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Checkout (Atomic) ---
app.post('/api/checkout', (req, res) => {
    const { 
        items, 
        total_amount, 
        customer_name = 'Cash Customer', 
        payment_method = 'Cash', 
        subtotal = null, 
        discount = 0,
        account_id = null 
    } = req.body;
    
    const transaction = db.transaction((itemsToCheckout, total, custName, payMethod, subTot, disc, accId) => {
        const info = db.prepare('SELECT COUNT(*) as count FROM invoices').get();
        const invoiceNumber = 'INV-' + (1000 + info.count + 1);
        const finalSubtotal = subTot !== null ? subTot : total;

        let effectiveCustName = custName;
        let accountObj = null;
        if (accId) {
            accountObj = db.prepare('SELECT balance_amount, customer_name FROM accounts WHERE id = ?').get(accId);
            if (accountObj && (payMethod === 'Account' || !effectiveCustName || effectiveCustName === 'Cash Customer')) {
                effectiveCustName = accountObj.customer_name;
            }
        }

        const invStmt = db.prepare(`
            INSERT INTO invoices (invoice_number, customer_name, payment_method, subtotal, discount, account_id, total_amount) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const invInfo = invStmt.run(invoiceNumber, effectiveCustName, payMethod, finalSubtotal, disc, accId || null, total);
        const invoiceId = invInfo.lastInsertRowid;

        const itemStmt = db.prepare('INSERT INTO invoice_items (invoice_id, product_id, quantity, price) VALUES (?, ?, ?, ?)');
        const stockStmt = db.prepare('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?');

        for (const item of itemsToCheckout) {
            itemStmt.run(invoiceId, item.id, item.qty, item.price);
            stockStmt.run(item.qty, item.id);
        }

        let remainingBalance = null;
        if (accId && accountObj) {
            const prevBalance = accountObj.balance_amount;
            let newBalance = prevBalance;
            if (payMethod === 'Account') {
                newBalance = prevBalance + total;
            }
            db.prepare('UPDATE accounts SET balance_amount = ?, is_deleted = 0 WHERE id = ?').run(newBalance, accId);
            db.prepare(`
                INSERT INTO account_history (account_id, paid_amount, previous_balance, remaining_balance, status, type, invoice_id, note)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(accId, 0, prevBalance, newBalance, 'PARTIAL', 'CHARGE', invoiceId, 'Bill ' + invoiceNumber);
            remainingBalance = newBalance;
        }

        return { invoiceNumber, invoiceId, remainingBalance, customerName: effectiveCustName };
    });

    try {
        const result = transaction(items, total_amount, customer_name, payment_method, subtotal, discount, account_id);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Accounts ---
app.get('/api/accounts', (req, res) => {
    const accounts = db.prepare('SELECT * FROM accounts WHERE is_deleted = 0').all();
    res.json(accounts);
});

app.get('/api/accounts/history', (req, res) => {
    const accounts = db.prepare('SELECT * FROM accounts WHERE is_deleted = 1').all();
    res.json(accounts);
});

app.get('/api/accounts/:id/history', (req, res) => {
    const history = db.prepare('SELECT * FROM account_history WHERE account_id = ? ORDER BY payment_date DESC').all(req.params.id);
    res.json(history);
});

app.post('/api/accounts', (req, res) => {
    const { customer_name, balance_amount, start_date } = req.body;
    try {
        const stmt = db.prepare('INSERT INTO accounts (customer_name, balance_amount, start_date) VALUES (?, ?, ?)');
        const info = stmt.run(customer_name, balance_amount || 0, start_date);
        res.json({ success: true, id: info.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Account Payment / Settlement Route
app.post('/api/accounts/:id/pay', (req, res) => {
    const { paid_amount, note } = req.body;
    const account_id = req.params.id;
    const paid = Number(paid_amount);

    if (isNaN(paid) || paid <= 0) {
        return res.status(400).json({ error: 'Invalid paid amount' });
    }

    const transaction = db.transaction((id, txAmount, txNote) => {
        const account = db.prepare('SELECT balance_amount FROM accounts WHERE id = ?').get(id);
        if (!account) throw new Error('Account not found');

        const prevBalance = account.balance_amount;
        let newBalance = prevBalance - txAmount;
        let isDeleted = 0;
        let status = 'PARTIAL';

        if (newBalance <= 0) {
            newBalance = 0;
            isDeleted = 1;
            status = 'FINISHED';
        }

        db.prepare('UPDATE accounts SET balance_amount = ?, is_deleted = ? WHERE id = ?').run(newBalance, isDeleted, id);

        db.prepare(`
            INSERT INTO account_history (account_id, paid_amount, previous_balance, remaining_balance, status, type, invoice_id, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, txAmount, prevBalance, newBalance, status, 'PAYMENT', null, txNote || 'Payment Settlement');

        return { newBalance, isDeleted, status };
    });

    try {
        const result = transaction(account_id, paid, note);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Account Transaction (Atomic)
app.post('/api/accounts/transaction', (req, res) => {
    const { account_id, type, amount, invoice_id, note } = req.body;

    const transaction = db.transaction((id, txAmount, txType, invId, txNote) => {
        const account = db.prepare('SELECT balance_amount FROM accounts WHERE id = ?').get(id);
        if (!account) throw new Error('Account not found');

        const prevBalance = account.balance_amount;
        let newBalance = prevBalance;
        
        if (txType === 'PAYMENT') {
            newBalance -= txAmount;
        } else if (txType === 'CHARGE') {
            newBalance += txAmount;
        }

        let isDeleted = 0;
        let status = 'PARTIAL';
        if (newBalance <= 0) {
            newBalance = 0; 
            isDeleted = 1;
            status = 'FINISHED';
        }

        db.prepare('UPDATE accounts SET balance_amount = ?, is_deleted = ? WHERE id = ?').run(newBalance, isDeleted, id);
        
        db.prepare(`
            INSERT INTO account_history (account_id, paid_amount, previous_balance, remaining_balance, status, type, invoice_id, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, txAmount, prevBalance, newBalance, status, txType, invId || null, txNote || null);

        return { newBalance, isDeleted, status };
    });

    try {
        const result = transaction(account_id, amount, type, invoice_id, note);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Sales / Invoices ---
app.get('/api/sales', (req, res) => {
    const invoices = db.prepare('SELECT * FROM invoices ORDER BY created_at DESC').all();
    const result = [];
    
    const getItems = db.prepare(`
        SELECT ii.*, p.name_en, p.name_ta, p.unit_type, p.cost_price 
        FROM invoice_items ii
        LEFT JOIN products p ON p.id = ii.product_id
        WHERE ii.invoice_id = ?
    `);

    for(const inv of invoices) {
        const items = getItems.all(inv.id);
        result.push({
            id: inv.invoice_number,
            invoice_id: inv.id,
            date: inv.created_at,
            total: inv.total_amount,
            customer_name: inv.customer_name || 'Cash Customer',
            payment_method: inv.payment_method || 'Cash',
            subtotal: inv.subtotal !== null && inv.subtotal !== undefined ? inv.subtotal : inv.total_amount,
            discount: inv.discount || 0,
            account_id: inv.account_id,
            items: items.map(i => ({ 
                id: i.product_id,
                name_en: i.name_en || ('Product #' + i.product_id),
                name_ta: i.name_ta || i.name_en || ('பொருள் #' + i.product_id),
                unit_type: i.unit_type || 'pcs',
                qty: i.quantity, 
                price: i.price, 
                cost: i.cost_price 
            }))
        });
    }

    res.json(result);
});

// Single Invoice by number or id
app.get('/api/invoices/:number', (req, res) => {
    try {
        const inv = db.prepare('SELECT * FROM invoices WHERE invoice_number = ? OR id = ?').get(req.params.number, req.params.number);
        if (!inv) return res.status(404).json({ error: 'Invoice not found' });
        const items = db.prepare(`
            SELECT ii.*, p.name_en, p.name_ta, p.unit_type, p.cost_price
            FROM invoice_items ii
            LEFT JOIN products p ON p.id = ii.product_id
            WHERE ii.invoice_id = ?
        `).all(inv.id);
        res.json({
            id: inv.invoice_number,
            invoice_id: inv.id,
            date: inv.created_at,
            total: inv.total_amount,
            customer_name: inv.customer_name || 'Cash Customer',
            payment_method: inv.payment_method || 'Cash',
            subtotal: inv.subtotal !== null && inv.subtotal !== undefined ? inv.subtotal : inv.total_amount,
            discount: inv.discount || 0,
            account_id: inv.account_id,
            items: items.map(i => ({
                id: i.product_id,
                name_en: i.name_en || ('Product #' + i.product_id),
                name_ta: i.name_ta || i.name_en || ('பொருள் #' + i.product_id),
                unit_type: i.unit_type || 'pcs',
                qty: i.quantity,
                price: i.price,
                cost: i.cost_price
            }))
        });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/system/stop', (req, res) => {
    console.log('Stop signal received. Shutting down...');
    res.json({ success: true });
    setTimeout(() => {
        process.exit(0);
    }, 1000);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
