const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// The file is corrupted. We need to rebuild it carefully.
// Let's just restore it by fetching the last known good version from memory, 
// or I can manually fix the Profit section and the Accounts section.

// Actually, let me just fix the exact text.
// The profit section got corrupted:
const corruptedProfit = `<span data-en="Total Shop Investment" data-ta="மொத்த கடை முதலீடு">                    <div class="catalog-header mb-20">
                        <h2 data-en="Customer Accounts" data-ta="வாடிக்கையாளர் கணக்குகள்">வாடிக்கையாளர் கணக்குகள்</h2>
                        <button class="btn-primary" onclick="UI.switchView('new-account-view')" data-en="+ New Account" data-ta="+ புதிய கணக்கு">+ புதிய கணக்கு</button>
                    </div>
                    <div class="tab-menu mb-20 mt-4">
                        <button class="tab-btn active" id="tab-btn-active" onclick="switchAccountTab('active')" data-en="Active Accounts" data-ta="செயலிலுள்ள கணக்குகள்">Active Accounts</button>
                        <button class="tab-btn" id="tab-btn-history" onclick="switchAccountTab('history')" data-en="Settlement History" data-ta="முடிந்த கணக்குகள்">Settlement History</button>
                    </div>
                    <div class="search-box mb-20">
                        <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                        <input type="text" id="account-search" placeholder="Search customer name..." data-en-placeholder="Search customer name..." data-ta-placeholder="வாடிக்கையாளர் பெயர் தேடவும்...">
                    </div>
                    <table class="data-table">ற்று">நேற்று</button>`;

const fixedProfit = `<span data-en="Total Shop Investment" data-ta="மொத்த கடை முதலீடு">மொத்த கடை முதலீடு</span>
                            <b id="profit-total-investment" class="text-blue">₹0.00</b>
                        </div>
                        <div class="metric-card">
                            <span data-en="Profit for Selected Period" data-ta="தேர்ந்தெடுக்கப்பட்ட காலத்தின் லாபம்">தேர்ந்தெடுக்கப்பட்ட காலத்தின் லாபம்</span>
                            <b id="profit-amount" class="text-success">₹0.00</b>
                        </div>
                    </div>
                    <div class="profit-filters">
                        <button class="btn-filter active" data-range="today" data-en="Today" data-ta="இன்று">இன்று</button>
                        <button class="btn-filter" data-range="yesterday" data-en="Yesterday" data-ta="நேற்று">நேற்று</button>`;

html = html.replace(corruptedProfit, fixedProfit);

// Now, correctly inject Accounts Tabs into the Accounts view.
const accountsViewHeader = `<div class="catalog-header mb-20">
                        <h2 data-en="Customer Accounts" data-ta="வாடிக்கையாளர் கணக்குகள்">வாடிக்கையாளர் கணக்குகள்</h2>
                        <button class="btn-primary" onclick="UI.switchView('new-account-view')" data-en="+ New Account" data-ta="+ புதிய கணக்கு">+ புதிய கணக்கு</button>
                    </div>
                    <div class="search-box mb-20">`;

const accountsViewHeaderFixed = `<div class="catalog-header mb-20">
                        <h2 data-en="Customer Accounts" data-ta="வாடிக்கையாளர் கணக்குகள்">வாடிக்கையாளர் கணக்குகள்</h2>
                        <button class="btn-primary" onclick="UI.switchView('new-account-view')" data-en="+ New Account" data-ta="+ புதிய கணக்கு">+ புதிய கணக்கு</button>
                    </div>
                    <div class="tab-menu mb-20 mt-4">
                        <button class="tab-btn active" id="tab-btn-active" onclick="switchAccountTab('active')" data-en="Active Accounts" data-ta="செயலிலுள்ள கணக்குகள்">Active Accounts</button>
                        <button class="tab-btn" id="tab-btn-history" onclick="switchAccountTab('history')" data-en="Settlement History" data-ta="முடிந்த கணக்குகள்">Settlement History</button>
                    </div>
                    <div class="search-box mb-20">`;

// Only replace the ONE in Accounts view (which should be the last one if we search backwards or just replace the specific block)
// The block in index.html is unique because of the h2 text
html = html.replace(accountsViewHeader, accountsViewHeaderFixed);

fs.writeFileSync('index.html', html);
console.log("Fixed index.html");
