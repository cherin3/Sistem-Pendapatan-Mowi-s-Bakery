(() => {
  const store = window.BakeryStore;

  const productEmojis = ['🥐', '🍞', '🍰', '🍪', '🧁', '🥖', '🥤'];

  const categoryEmojis = {
    'Beverage': '🥤',
    'Cake': '🍰',
    'Loaf': '🍞',
    'Pastry': '🥐',
    'Savory': '🥪',
    'Sourdough': '🥖',
    'Sweet Buns': '🍩'
  };

  const lowStockThreshold = 10;
  let activeProductCategory = 'Semua';
  const state = { data: null, entityType: null };

  const money = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0);
  const safe = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const productName = (id) => state.data.products.find((product) => product.id === id)?.name || 'Produk dihapus';
  const customerName = (id) => state.data.customers.find((customer) => customer.id === id)?.name || 'Pelanggan umum';
  const sortedSales = () => [...state.data.sales].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const dayKey = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

  function updateDateLabels() {
    const now = new Date();
    document.getElementById('today-label').textContent = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    document.querySelector('.welcome-copy .eyebrow').textContent = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
  }

  function renderStats() {
    const now = new Date();
    const today = state.data.sales.filter((sale) => dayKey(new Date(sale.created_at)) === dayKey(now));
    const month = state.data.sales.filter((sale) => {
      const date = new Date(sale.created_at);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    });
document.getElementById('stat-today').textContent = money(
  today.reduce((sum, sale) => sum + Number(sale.subtotal_amount ?? sale.total_amount), 0)
);

document.getElementById('stat-month').textContent = money(
  month.reduce((sum, sale) => sum + Number(sale.subtotal_amount ?? sale.total_amount), 0)
);    document.getElementById('stat-count').textContent = new Intl.NumberFormat('id-ID').format(month.length);
    document.getElementById('stat-products').textContent = new Intl.NumberFormat('id-ID').format(state.data.products.filter((product) => product.is_active !== false).length);
    document.getElementById('stat-today-note').textContent = `${today.length} transaksi tercatat`;
  }

  function renderStockAlert() {
    const lowStock = state.data.products
      .filter((product) => product.is_active !== false && Number(product.stock) <= lowStockThreshold)
      .sort((first, second) => Number(first.stock) - Number(second.stock));
    const alert = document.getElementById('stock-alert');
    alert.hidden = lowStock.length === 0;
    if (!lowStock.length) return;
    document.getElementById('stock-alert-title').textContent = `Stok menipis · ${lowStock.length} produk`;
    const shownProducts = lowStock.slice(0, 3).map((product) => `${safe(product.name)} (${Number(product.stock) === 0 ? 'habis' : `${Number(product.stock)} pcs`})`);
    const remaining = lowStock.length - shownProducts.length;
    document.getElementById('stock-alert-products').textContent = `${shownProducts.join(', ')}${remaining > 0 ? `, +${remaining} lainnya` : ''}`;
  }


function renderChart() {
    const chart = document.getElementById('bar-chart');
    const now = new Date();

    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 6 + index
      );

      const amount = state.data.sales
        .filter((sale) =>
          dayKey(new Date(sale.created_at)) === dayKey(date)
        )
        .reduce(
          (sum, sale) =>
            sum + Number(sale.subtotal_amount ?? sale.total_amount),
          0
        );

      return { date, amount };
    });

    const maximum = Math.max(...days.map((day) => day.amount), 1);

    chart.innerHTML = days.map(({ date, amount }) => {
      const today = dayKey(date) === dayKey(now);
      const height = amount ? Math.max(8, amount / maximum * 100) : 3;

      return `<div class="bar-column${today ? ' today' : ''}" title="${safe(date.toLocaleDateString('id-ID'))}: ${money(amount)}"><div class="bar-track"><span class="bar-fill" style="--bar-height:${height}%"></span></div><span class="bar-day">${today ? 'Hari ini' : safe(date.toLocaleDateString('id-ID', { weekday: 'short' }))}</span></div>`;
    }).join('');

    document.getElementById('chart-total').textContent = money(
      days.reduce((sum, day) => sum + day.amount, 0)
    );
}

  function renderFavorites() {
    const quantities = new Map();
    state.data.sales.forEach((sale) => {
      if (Date.now() - new Date(sale.created_at).getTime() > 7 * 86400000) return;
      sale.items.forEach((item) => {
        const current = quantities.get(item.product_id) || { name: item.product_name || productName(item.product_id), quantity: 0 };
        current.quantity += Number(item.quantity);
        quantities.set(item.product_id, current);
      });
    });
    const favorites = [...quantities.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 4);
    document.getElementById('favorites-list').innerHTML = favorites.length ? favorites.map((item, index) => `<div class="favorite-item"><span class="favorite-thumb">${productEmojis[index % productEmojis.length]}</span><span class="favorite-name"><strong>${safe(item.name)}</strong><small>${item.quantity} terjual</small></span></div>`).join('') : '<div class="empty-row">Belum ada penjualan minggu ini.</div>';
  }

  function renderSales(sales, target) {
    const body = document.getElementById(target);
    if (!sales.length) {
      body.innerHTML = `<tr><td class="empty-row" colspan="${target === 'recent-table-body' ? 5 : 6}">Belum ada transaksi untuk ditampilkan.</td></tr>`;
      return;
    }
    body.innerHTML = sales.map((sale) => {
      const date = new Date(sale.created_at);
      const customer = customerName(sale.customer_id);
      const initials = customer === 'Pelanggan umum' ? 'PU' : customer.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
      const details = sale.items.map((item) => `${safe(item.product_name || productName(item.product_id))} × ${Number(item.quantity)}`).join(', ');
      const actions = target === 'recent-table-body' ? '' : `<td class="row-actions"><button type="button" class="icon-action" title="Cetak struk" aria-label="Cetak struk" data-receipt="${safe(sale.id)}">⎙</button><button type="button" class="icon-action" title="Ubah transaksi" aria-label="Ubah transaksi" data-edit="sale" data-id="${safe(sale.id)}">✎</button><button type="button" class="icon-action danger-action" title="Hapus transaksi" aria-label="Hapus transaksi" data-delete="sale" data-id="${safe(sale.id)}">×</button></td>`;
      return `<tr><td>${safe(date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }))} <span class="muted-foot">${safe(date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }))}</span></td><td><span class="table-customer"><span class="customer-initial">${safe(initials)}</span><span class="customer-name">${safe(customer)}</span></span></td><td class="table-detail" title="${details}">${details}</td><td><span class="payment-tag">${safe(sale.payment_method || 'Tunai')}</span></td><td class="align-right table-total">${money(sale.total_amount)}</td>${actions}</tr>`;
    }).join('');
  }

  function renderTransactions() {
    const query = (document.getElementById('transaction-search')?.value || '').trim().toLowerCase();
    const matches = sortedSales().filter((sale) => !query || [customerName(sale.customer_id), sale.payment_method, ...sale.items.map((item) => item.product_name || productName(item.product_id))].join(' ').toLowerCase().includes(query));
    document.getElementById('transaction-count').textContent = `${matches.length} transaksi`;
    renderSales(matches, 'transactions-table-body');
  }

  function renderProducts() {
  const allProducts = [...state.data.products]
    .sort((a, b) => a.name.localeCompare(b.name));

  const products = activeProductCategory === 'Semua'
    ? allProducts
    : allProducts.filter(
        (product) => product.category === activeProductCategory
      );

  document.getElementById('product-count').textContent =
    `${products.length} produk`;

  document.getElementById('products-table-body').innerHTML =
    products.length
      ? products.map((product) => `
        <tr>
          <td>
            <span class="table-customer">
              <span class="favorite-thumb">
                ${categoryEmojis[product.category] || '🥐'}
              </span>
              <span class="customer-name">${safe(product.name)}</span>
            </span>
          </td>
          <td>${safe(product.category || 'Lainnya')}</td>
          <td>
            ${Number(product.stock) <= lowStockThreshold
              ? `<span class="stock-low">${Number(product.stock)} tersisa</span>`
              : `${Number(product.stock)} pcs`}
          </td>
          <td class="align-right table-total">${money(product.price)}</td>
          <td class="row-actions">
            <button type="button" class="icon-action"
              title="Ubah produk" aria-label="Ubah produk"
              data-edit="product" data-id="${safe(product.id)}">✎</button>
            <button type="button" class="icon-action danger-action"
              title="Hapus produk" aria-label="Hapus produk"
              data-delete="product" data-id="${safe(product.id)}">×</button>
          </td>
        </tr>
      `).join('')
      : '<tr><td class="empty-row" colspan="5">Belum ada produk.</td></tr>';
  }

  function renderCustomers() {
    document.getElementById('customer-count').textContent = `${state.data.customers.length} pelanggan`;
    document.getElementById('customers-table-body').innerHTML = state.data.customers.length ? [...state.data.customers].sort((a, b) => a.name.localeCompare(b.name)).map((customer) => {
      const sales = state.data.sales.filter((sale) => sale.customer_id === customer.id);
      const total = sales.reduce((sum, sale) => sum + Number(sale.total_amount), 0);
      const initials = customer.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
      return `<tr><td><span class="table-customer"><span class="customer-initial">${safe(initials)}</span><span class="customer-name">${safe(customer.name)}</span></span></td><td>${safe(customer.phone || '—')}</td><td>${sales.length} transaksi</td><td class="align-right table-total">${money(total)}</td><td class="row-actions"><button type="button" class="icon-action" title="Ubah pelanggan" aria-label="Ubah pelanggan" data-edit="customer" data-id="${safe(customer.id)}">✎</button><button type="button" class="icon-action danger-action" title="Hapus pelanggan" aria-label="Hapus pelanggan" data-delete="customer" data-id="${safe(customer.id)}">×</button></td></tr>`;
    }).join('') : '<tr><td class="empty-row" colspan="5">Belum ada pelanggan.</td></tr>';
  }

  function renderCustomerOptions() {
    const select = document.getElementById('sale-customer');
    const selected = select.value;
    select.innerHTML = '<option value="">Pelanggan umum</option>' + [...state.data.customers].sort((a, b) => a.name.localeCompare(b.name)).map((customer) => `<option value="${safe(customer.id)}">${safe(customer.name)}</option>`).join('');
    if (state.data.customers.some((customer) => customer.id === selected)) select.value = selected;
  }

  function render() {
    renderStats(); renderStockAlert(); renderChart(); renderFavorites();
    renderSales(sortedSales().slice(0, 5), 'recent-table-body');
    renderTransactions(); renderProducts(); renderCustomers(); renderCustomerOptions();
    const demo = store.mode !== 'live';
    const status = document.getElementById('connection-status');
    status.className = `connection-status${demo ? '' : ' live'}`;
    status.innerHTML = `<i></i> ${demo ? 'Mode demo lokal' : 'Terhubung ke Supabase'}`;
  }


function printReceipt(saleId) {
  const sale = state.data.sales.find((item) => item.id === saleId);

  if (!sale) {
    window.alert('Transaksi tidak ditemukan. Muat ulang daftar transaksi lalu coba lagi.');
    return;
  }

  const printWindow = window.open('', '_blank', 'popup,width=460,height=780');

  if (!printWindow) {
    window.alert('Izinkan pop-up untuk mencetak struk.');
    return;
  }

  const saleDate = new Date(sale.created_at);
  const subtotal = Number(sale.subtotal_amount ?? sale.total_amount);
  const pb1 = Number(sale.pb1_amount ?? 0);
  const total = Number(sale.total_amount); 

  const itemRows = sale.items.map((item) => {
    const name = safe(item.product_name || productName(item.product_id));
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unit_price);
    const lineTotal = Number(item.line_total ?? unitPrice * quantity);

    return `
      <div class="item">
        <div class="item-name">${name}</div>
        <div class="item-detail">
          <span>${quantity} × ${money(unitPrice)}</span>
          <span class="item-price">${money(lineTotal)}</span>
        </div>
      </div>
    `;
  }).join('');





const bunny = `
<svg class="bunny" viewBox="0 0 180 150" xmlns="http://www.w3.org/2000/svg">

  <!-- Left ear -->
  <path d="M56 66
    C48 49 43 20 53 13
    C64 5 75 36 77 61
    Q67 63 56 66Z"
    fill="#fff5ed" stroke="#805044" stroke-width="2.5"/>

  <path d="M57 51
    C53 35 51 19 56 17
    C62 18 68 41 70 55Z"
    fill="#e8b5ad"/>

  <!-- Right ear -->
  <path d="M103 61
    C105 36 116 5 127 13
    C137 20 132 49 124 66
    Q113 63 103 61Z"
    fill="#fff5ed" stroke="#805044" stroke-width="2.5"/>

  <path d="M110 55
    C113 39 120 18 125 17
    C131 19 126 37 121 52Z"
    fill="#e8b5ad"/>

  <!-- Round face -->
  <ellipse cx="90" cy="88" rx="49" ry="42"
    fill="#fff5ed" stroke="#805044" stroke-width="2.5"/>

  <!-- Eyes -->
  <ellipse cx="73" cy="82" rx="3.5" ry="4.5"
    fill="#68483e"/>
  <ellipse cx="107" cy="82" rx="3.5" ry="4.5"
    fill="#68483e"/>

  <!-- Nose -->
  <path d="M85 94 Q90 89 95 94
    Q90 101 85 94Z"
    fill="#d58e91"/>

  <!-- Mouth -->
  <path d="M90 99 L90 104
    M90 104 Q85 109 81 105
    M90 104 Q95 109 99 105"
    fill="none" stroke="#805044"
    stroke-width="1.7" stroke-linecap="round"/>

  <!-- Blush -->
  <ellipse cx="62" cy="96" rx="8" ry="4.5"
    fill="#e9b5ae" opacity=".75"/>
  <ellipse cx="118" cy="96" rx="8" ry="4.5"
    fill="#e9b5ae" opacity=".75"/>

</svg>
`;

  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };

  printWindow.document.open();

  printWindow.document.write(`
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Receipt - Mowi's Bakery</title>

      <style>
        @page {
          size: 80mm auto;
          margin: 4mm;
        }

        * {
          box-sizing: border-box;
        }

        body {
          width: 72mm;
          margin: 0 auto;
          padding: 15px 13px;
          background: #fffaf6;
          color: #68483e;
          font-family: Georgia, serif;
          font-size: 12px;
          line-height: 1.5;
        }

        .receipt {
          border-top: 5px dotted #d8a49d;
          border-bottom: 5px dotted #d8a49d;
          padding: 17px 0;
        }

        .header {
          text-align: center;
          padding-bottom: 15px;
          border-bottom: 1px solid #c99a90;
        }

        .bunny-wrap {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 7px;
          margin-bottom: 2px;
        }

        .bunny {
          width: 105px;
          height: 72px;
        }

        .heart {
          color: #bd777b;
          font-size: 18px;
        }

        h1 {
          font-size: 27px;
          font-style: italic;
          margin: 0;
          line-height: 1.2;
          color: #71483f;
        }

        .tagline {
          font-size: 11px;
          font-style: italic;
          color: #a8756e;
          margin-top: 5px;
        }

        .meta {
          padding: 13px 0;
          border-bottom: 1px solid #c99a90;
        }

        .meta-row {
          display: grid;
          grid-template-columns: 78px 8px minmax(0, 1fr);
          gap: 3px;
          margin: 5px 0;
          font-size: 10px;
          align-items: start;
        }

        .meta-label {
          font-style: italic;
        }

        .meta-value {
          overflow-wrap: anywhere;
        }

        .items {
          padding: 13px 0 10px;
        }

        .items-heading {
          display: flex;
          justify-content: space-between;
          padding: 7px 9px;
          margin-bottom: 9px;
          border-radius: 20px;
          background: #f3dfda;
          color: #744b42;
          font-weight: bold;
          font-size: 11px;
        }

        .items-heading span:first-child {
          flex: 1;
        }

        .items-heading span:nth-child(2) {
          width: 35px;
          text-align: center;
        }

        .items-heading span:last-child {
          width: 90px;
          text-align: right;
        }

        .item {
          padding: 5px 5px;
        }

        .item-name {
          font-weight: bold;
          font-size: 11px;
          overflow-wrap: anywhere;
        }

        .item-detail {
          display: flex;
          justify-content: space-between;
          gap: 5px;
          color: #97756b;
          font-size: 10px;
          margin-top: 2px;
        }

        .item-price {
          color: #68483e;
          white-space: nowrap;
        }

        .payment-summary {
  margin-top: 12px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 10px;
  font-size: 11px;
}

.summary-row strong {
  white-space: nowrap;
  font-weight: normal;
}

        .total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 5px;
          padding: 11px 12px;
          background: #f1d9d4;
          border-radius: 22px;
          font-size: 15px;
          font-weight: bold;
          margin-top: 5px;
        }

        .total strong {
          white-space: nowrap;
          font-size: 14px;
        }

        .thanks {
          text-align: center;
          margin-top: 13px;
          padding: 12px 8px;
          background: #f8e9e5;
          border-radius: 22px;
          color: #93665e;
          font-size: 11px;
        }

        .thanks p {
          margin: 3px 0;
        }

        .thanks .closing {
          font-style: italic;
        }

        @media screen {
          body {
            margin: 15px auto;
            box-shadow: 0 4px 20px rgba(90, 55, 45, .12);
          }
        }

        @media print {
          body {
            background: #fffaf6;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>

    <body>
      <main class="receipt">

        <header class="header">
          <div class="bunny-wrap">
            ${bunny}
            <span class="heart">♡</span>
          </div>

          <h1>Mowi's Bakery</h1>
          <div class="tagline">Sweet Things, Better Mood ♡</div>
        </header>

        <section class="meta">
          <div class="meta-row">
            <span class="meta-label">No. Transaksi</span>
            <span>:</span>
            <span class="meta-value">${safe(sale.id)}</span>
          </div>

          <div class="meta-row">
            <span class="meta-label">Tanggal</span>
            <span>:</span>
            <span class="meta-value">${safe(saleDate.toLocaleString('id-ID'))}</span>
          </div>

          <div class="meta-row">
            <span class="meta-label">Pelanggan</span>
            <span>:</span>
            <span class="meta-value">${safe(customerName(sale.customer_id) || '-')}</span>
          </div>

          <div class="meta-row">
            <span class="meta-label">Pembayaran</span>
            <span>:</span>
            <span class="meta-value">${safe(sale.payment_method || 'Tunai')}</span>
          </div>
        </section>

        <section class="items">
          <div class="items-heading">
            <span>Item</span>
            <span>Qty</span>
            <span>Harga</span>
          </div>

          ${itemRows}
        </section>

<div class="payment-summary">
  <div class="summary-row">
    <span>Subtotal</span>
    <strong>${money(subtotal)}</strong>
  </div>

  <div class="summary-row">
    <span>PB1 (10%)</span>
    <strong>${money(pb1)}</strong>
  </div>

  <div class="total">
    <span>TOTAL</span>
    <strong>${money(total)}</strong>
  </div>
</div>
        <footer class="thanks">
          <p>♥ Thank you for choosing Mowi's Bakery!</p>
          <p class="closing">Have a lovely day ♡</p>
        </footer>

      </main>
    </body>
    </html>
  `);

  printWindow.document.close();
}

  function showLogin(message = '') {
    document.getElementById('app-shell').hidden = true;
    document.getElementById('auth-screen').hidden = false;
    document.getElementById('auth-error').textContent = message;
  }

  function showWorkspace() {
    document.getElementById('auth-screen').hidden = true;
    document.getElementById('app-shell').hidden = false;
  }


function switchView(view) {
    if (!['overview', 'transactions', 'products', 'customers', 'reports'].includes(view)) return;

    document.querySelectorAll('.view-panel').forEach((panel) =>
      panel.classList.toggle('active', panel.id === `view-${view}`)
    );

    document.querySelectorAll('.nav-link[data-view]').forEach((link) =>
      link.classList.toggle('active', link.dataset.view === view)
    );

    document.getElementById('page-breadcrumb').textContent = {
      overview: 'Ringkasan',
      transactions: 'Transaksi',
      products: 'Produk',
      customers: 'Pelanggan',
      reports: 'Laporan Keuangan'
    }[view];

    history.replaceState(null, '', `#${view}`);
}

  function addSaleRow(item = null) {
    const row = document.createElement('div');
    row.className = 'sale-item-row';
    row.innerHTML = `<select aria-label="Produk"><option value="">Pilih produk</option>${state.data.products.map((product) => `<option value="${safe(product.id)}">${safe(product.name)} · ${money(product.price)} (stok ${Number(product.stock)})</option>`).join('')}</select><input type="number" min="1" value="${item ? Number(item.quantity) : 1}" aria-label="Jumlah"><button class="remove-item" type="button" aria-label="Hapus item">×</button>`;
    row.querySelector('select').value = item?.product_id || '';
    row.addEventListener('input', updateSaleTotal);
    row.querySelector('.remove-item').addEventListener('click', () => { row.remove(); updateSaleTotal(); });
    document.getElementById('sale-items').append(row);
    updateSaleTotal();
  }

function updateSaleTotal() {
  const subtotal = [...document.querySelectorAll('.sale-item-row')].reduce((sum, row) => {
    const product = state.data.products.find(
      (item) => item.id === row.querySelector('select').value
    );

    return sum + (
      product
        ? product.price * (Number(row.querySelector('input').value) || 0)
        : 0
    );
  }, 0);

  const pb1 = Math.round(subtotal * 0.10);
  const total = subtotal + pb1;

  document.getElementById('sale-subtotal-preview').textContent = money(subtotal);
  document.getElementById('sale-pb1-preview').textContent = money(pb1);
  document.getElementById('sale-total-preview').textContent = money(total);
}

  function openSale(sale = null) {
    const form = document.getElementById('sale-form');
    form.reset();
    document.getElementById('sale-items').innerHTML = '';
    renderCustomerOptions();
    document.getElementById('sale-id').value = sale?.id || '';
    document.getElementById('sale-dialog-title').textContent = sale ? 'Ubah transaksi' : 'Catat penjualan';
    form.querySelector('[type="submit"]').textContent = sale ? 'Simpan perubahan' : 'Simpan transaksi';
    if (sale) {
      document.getElementById('sale-customer').value = sale.customer_id || '';
      document.getElementById('sale-payment').value = sale.payment_method || 'Tunai';
      sale.items.forEach((item) => addSaleRow(item));
    } else addSaleRow();
    document.getElementById('sale-dialog').showModal();
  }

  function openEntity(type, entity = null) {
    state.entityType = type;
    const form = document.getElementById('entity-form');
    form.reset();

const configs = {
  product: {
    eyebrow: 'KATALOG BAKERY',
    add: 'Tambah produk',
    edit: 'Ubah produk',
    fields: `
      <label class="field-label">
        Nama produk
        <input name="name" required maxlength="100" placeholder="Contoh: Danish pastry">
      </label>

      <label class="field-label">
        Kategori
        <select name="category" required>
           <option value="" disabled selected>Pilih kategori</option>
           <option value="Beverage">🥤 Beverage</option>
           <option value="Cake">🍰 Cake</option>
           <option value="Loaf">🍞 Loaf</option>
           <option value="Pastry">🥐 Pastry</option>
           <option value="Savory">🥪 Savory</option>
           <option value="Sourdough">🥖 Sourdough</option>
           <option value="Sweet Buns">🍩 Sweet Buns</option>
        </select>
      </label>

      <label class="field-label">
        Harga jual
        <input name="price" type="number" min="0" step="500" required placeholder="18000">
      </label>

      <label class="field-label">
        Stok
        <input name="stock" type="number" min="0" step="1" required value="0">
      </label>
    `
  },

  customer: {
    eyebrow: 'KOMUNITAS MOWI\'S',
    add: 'Tambah pelanggan',
    edit: 'Ubah pelanggan',
    fields: `
      <label class="field-label">
        Nama pelanggan
        <input name="name" required maxlength="100" placeholder="Nama lengkap">
      </label>

      <label class="field-label">
        Nomor telepon
        <input name="phone" type="tel" maxlength="30" placeholder="08xx xxxx xxxx">
      </label>
    `
  }
};
    const config = configs[type];
    document.getElementById('entity-eyebrow').textContent = config.eyebrow;
    document.getElementById('entity-title').textContent = entity ? config.edit : config.add;
    document.getElementById('entity-fields').innerHTML = `<input type="hidden" name="id" value="${safe(entity?.id || '')}">${config.fields}`;
    if (entity) Object.entries(entity).forEach(([key, value]) => { const input = form.elements.namedItem(key); if (input) input.value = value ?? ''; });
    form.querySelector('[type="submit"]').textContent = entity ? 'Simpan perubahan' : 'Simpan';
    document.getElementById('entity-dialog').showModal();
  }

  async function handleError(operation) {
    try { await operation(); state.data = store.data; render(); }
    catch (error) { window.alert(error.message || 'Operasi gagal.'); }
  }

  function setupEvents() {
    document.getElementById('login-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('[type="submit"]');
      const error = document.getElementById('auth-error');
      submit.disabled = true;
      error.textContent = '';
      try {
        await store.login(form.elements.email.value.trim(), form.elements.password.value);
        state.data = store.data;
        form.reset();
        render();
        showWorkspace();
      } catch (loginError) {
        error.textContent = loginError.message || 'Tidak dapat masuk. Periksa koneksi dan akun operator.';
      } finally { submit.disabled = false; }
    });
    document.getElementById('logout-button').addEventListener('click', async () => {
      await store.logout();
      state.data = null;
      showLogin();
      document.getElementById('login-password').value = '';
    });
    document.querySelectorAll('.nav-link[data-view]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
    document.addEventListener('click', (event) => {
      const target = event.target.closest('button, a');
      if (!target) return;
      if (target.dataset.categoryFilter) {
  activeProductCategory = target.dataset.categoryFilter;

  document.querySelectorAll('.category-filter').forEach((button) => {
    button.classList.toggle(
      'is-active',
      button.dataset.categoryFilter === activeProductCategory
    );
  });

  renderProducts();
  return;
}
      if (target.dataset.goto) { event.preventDefault(); switchView(target.dataset.goto); }
      if (target.dataset.action === 'sale') openSale();
      if (target.dataset.action === 'product' || target.dataset.action === 'customer') openEntity(target.dataset.action);
      if (target.dataset.receipt) printReceipt(target.dataset.receipt);
      if (target.dataset.edit) {
        const entity = target.dataset.edit === 'sale' ? state.data.sales.find((item) => item.id === target.dataset.id) : state.data[target.dataset.edit === 'product' ? 'products' : 'customers'].find((item) => item.id === target.dataset.id);
        if (target.dataset.edit === 'sale') openSale(entity); else openEntity(target.dataset.edit, entity);
      }
      if (target.dataset.delete) {
        const type = target.dataset.delete;
        const message = type === 'sale' ? 'Hapus transaksi ini? Stok produk akan dikembalikan.' : `Hapus ${type === 'product' ? 'produk' : 'pelanggan'} ini?`;
        if (!window.confirm(message)) return;
        handleError(() => store.remove(type, target.dataset.id));
      }
      if (target.dataset.close) document.getElementById(target.dataset.close).close();
    });
    document.getElementById('new-sale').addEventListener('click', () => openSale());
    document.getElementById('add-sale-item').addEventListener('click', () => addSaleRow());
    document.getElementById('transaction-search').addEventListener('input', renderTransactions);
    document.getElementById('sale-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const items = [...document.querySelectorAll('.sale-item-row')].map((row) => ({ product_id: row.querySelector('select').value, quantity: Number(row.querySelector('input').value) })).filter((item) => item.product_id && item.quantity > 0);
      const payload = { id: form.elements.sale_id.value || null, customer_id: form.elements.customer_id.value || null, payment_method: form.elements.payment_method.value, items };
      handleError(async () => {
        if (payload.id) await store.updateSale(payload); else await store.createSale(payload);
        document.getElementById('sale-dialog').close();
      });
    });
    document.getElementById('entity-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const type = state.entityType;
      handleError(async () => {
        if (values.id) await store.update(type, values.id, values); else await store.create(type, values);
        document.getElementById('entity-dialog').close();
      });
    });
  }

  async function initialize() {
    updateDateLabels();
    setupEvents();
    try {
      const authenticated = await store.initialize();
      if (!authenticated) { showLogin(); return; }
      state.data = store.data;
      render();
      showWorkspace();
      if (location.hash) switchView(location.hash.slice(1));
    } catch (error) {
      showLogin(error.message || 'Sesi tidak valid. Silakan masuk kembali.');
    }
  }

  document.addEventListener('DOMContentLoaded', initialize);
})();
