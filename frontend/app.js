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
      <div class="item-row">
        <span class="item-name">${name}</span>
        <span class="item-qty">${quantity}</span>
        <span class="item-price">${money(lineTotal)}</span>
      </div>
    `;
  }).join('');

  const bunny = `
<svg class="bunny" viewBox="0 0 280 82" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <!-- Horizontal divider lines -->
  <line x1="12" y1="67" x2="80" y2="67" stroke="#9e7b70" stroke-width="1.35" stroke-linecap="round"/>
  <line x1="127" y1="67" x2="153" y2="67" stroke="#9e7b70" stroke-width="1.35" stroke-linecap="round"/>
  <line x1="173" y1="67" x2="192" y2="67" stroke="#9e7b70" stroke-width="1.35" stroke-linecap="round"/>
  <line x1="203" y1="67" x2="268" y2="67" stroke="#9e7b70" stroke-width="1.35" stroke-linecap="round"/>

  <!-- Base silhouette: seamless top head + left & right floppy lop ears -->
  <path d="M 108 67
           L 106 59
           C 101 65, 95 68, 90 66
           C 84 64, 83 57, 87 49
           C 93 38, 104 28, 115 21
           C 119 18, 124 17, 128 17
           C 131 15, 135 15, 138 16
           C 141 14, 145 15, 148 16
           C 152 16, 157 18, 162 21
           C 173 28, 185 38, 191 49
           C 195 57, 194 63, 188 64
           C 182 65, 177 59, 173 53
           L 172 67 Z"
        fill="#faede4" stroke="none"/>

  <!-- Soft blush shading on floppy ears -->
  <path d="M 114 27
           C 103 34, 93 43, 88 52
           C 85 58, 86 64, 91 65
           C 96 66, 102 62, 107 54
           C 108 46, 111 37, 114 27 Z"
        fill="#efd3c8" opacity="0.85"/>
  <path d="M 165 27
           C 176 34, 186 43, 190 51
           C 193 57, 192 62, 187 63
           C 182 64, 177 58, 172 50
           C 170 43, 168 35, 165 27 Z"
        fill="#efd3c8" opacity="0.85"/>

  <!-- Outer stroke of head + ears (seamless top crown into drooping lop ears) -->
  <path d="M 106 59
           C 101 65, 95 68, 90 66
           C 84 64, 83 57, 87 49
           C 93 38, 104 28, 115 21
           C 119 18, 124 17, 128 17
           C 131 15, 135 15, 138 16
           C 141 14, 145 15, 148 16
           C 152 16, 157 18, 162 21
           C 173 28, 185 38, 191 49
           C 195 57, 194 63, 188 64
           C 182 65, 177 59, 172 51"
        fill="none" stroke="#7a574d" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"/>

  <!-- Inner cheek/ear separation creases starting partway down -->
  <path d="M 114 34
           C 109 43, 106 52, 107 62"
        fill="none" stroke="#7a574d" stroke-width="1.85" stroke-linecap="round"/>
  <path d="M 165 34
           C 171 43, 174 51, 172 61"
        fill="none" stroke="#7a574d" stroke-width="1.85" stroke-linecap="round"/>

  <!-- Soft rosy cheeks -->
  <ellipse cx="117" cy="51.5" rx="5.6" ry="3.2" fill="#edb9b2" opacity="0.78"/>
  <ellipse cx="162" cy="50.5" rx="5.6" ry="3.2" fill="#edb9b2" opacity="0.78"/>

  <!-- Dark brown oval eyes -->
  <ellipse cx="126.5" cy="44.5" rx="2.6" ry="3.6" fill="#634239"/>
  <ellipse cx="153" cy="43.8" rx="2.6" ry="3.6" fill="#634239"/>

  <!-- Cute little nose & mouth -->
  <path d="M 138.3 47.2 Q 140 48.5 141.7 47.2
           M 140 48.1 L 140 51.2
           M 140 51.2 Q 137.5 53 135.8 51.5
           M 140 51.2 Q 142.5 53 144.2 51.5"
        fill="none" stroke="#7a574d" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>

  <!-- Left chubby paw resting on the line -->
  <path d="M 107 66.5
           C 106 60, 111 56.5, 117.5 56.5
           C 124 56.5, 128.5 60, 127.5 66.5
           C 127 69.8, 124 71, 121.5 69.8
           C 119.5 71.2, 115.5 71.2, 113.5 69.8
           C 111 71, 107.5 69.8, 107 66.5 Z"
        fill="#faede4" stroke="#7a574d" stroke-width="1.85" stroke-linejoin="round"/>
  <path d="M 113.8 66.8 L 113.8 69.7 M 121.2 66.8 L 121.2 69.7"
        stroke="#7a574d" stroke-width="1.35" stroke-linecap="round"/>

  <!-- Right chubby paw resting on the line -->
  <path d="M 152.5 66.2
           C 151.5 59.7, 156.5 56.2, 163 56.2
           C 169.5 56.2, 174 59.7, 173 66.2
           C 172.5 69.5, 169.5 70.7, 167 69.5
           C 165 70.9, 161 70.9, 159 69.5
           C 156.5 70.7, 153 69.5, 152.5 66.2 Z"
        fill="#faede4" stroke="#7a574d" stroke-width="1.85" stroke-linejoin="round"/>
  <path d="M 159.3 66.5 L 159.3 69.4 M 166.7 66.5 L 166.7 69.4"
        stroke="#7a574d" stroke-width="1.35" stroke-linecap="round"/>

  <!-- Floating little heart on upper right -->
  <path d="M 203 28
           C 203 24.8, 198.5 23.5, 197 26.8
           C 195.5 23.5, 191 24.8, 191 28
           C 191 32, 197 35.2, 197 36.8
           C 197 35.2, 203 32, 203 28 Z"
        transform="rotate(14 197 30)"
        fill="#ebd0c8" stroke="#7a574d" stroke-width="1.7" stroke-linejoin="round"/>
</svg>
`;

  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };

  printWindow.document.open();

  printWindow.document.write(`
    <!doctype html>
    <html lang="id">
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
          width: 74mm;
          margin: 0 auto;
          padding: 14px 10px;
          background: #f5ece6;
          color: #634038;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 12px;
          line-height: 1.45;
        }

        .receipt {
          position: relative;
          background: #fdf6f0;
          padding: 18px 16px 20px;
          border-radius: 10px;
          box-shadow: 0 4px 20px rgba(90, 55, 45, 0.12);
          overflow: hidden;
        }

        .receipt::before,
        .receipt::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          height: 10px;
          background-size: 16px 10px;
          background-repeat: repeat-x;
        }

        .receipt::before {
          top: -5px;
          background-image: radial-gradient(circle at 8px 0px, #f5ece6 5.5px, transparent 6px);
        }

        .receipt::after {
          bottom: -5px;
          background-image: radial-gradient(circle at 8px 10px, #f5ece6 5.5px, transparent 6px);
        }

        .header {
          text-align: center;
          padding-bottom: 12px;
          border-bottom: 1px solid #cbb0a8;
        }

        .bunny-wrap {
          display: flex;
          justify-content: center;
          align-items: center;
          margin: 2px -4px 4px;
        }

        .bunny {
          width: 100%;
          max-width: 245px;
          height: auto;
          display: block;
        }

        h1 {
          font-size: 27px;
          font-weight: bold;
          font-style: italic;
          margin: 0;
          line-height: 1.15;
          color: #6b4239;
        }

        .tagline {
          font-size: 11px;
          font-style: italic;
          color: #8f655c;
          margin-top: 4px;
        }

        .meta {
          padding: 11px 2px;
          border-bottom: 1px solid #cbb0a8;
        }

        .meta-row {
          display: grid;
          grid-template-columns: 74px 8px minmax(0, 1fr);
          gap: 2px;
          margin: 4px 0;
          font-size: 10.5px;
          align-items: start;
        }

        .meta-label {
          font-style: italic;
          color: #6d483f;
        }

        .meta-value {
          color: #5c3a32;
          overflow-wrap: anywhere;
        }

        .items {
          padding: 12px 0 10px;
          border-bottom: 1px solid #cbb0a8;
        }

        .items-heading {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 36px 76px;
          align-items: center;
          padding: 6px 12px;
          margin-bottom: 8px;
          border-radius: 999px;
          background: #edd6d0;
          color: #694138;
          font-weight: bold;
          font-size: 11px;
        }

        .items-heading span:nth-child(2) {
          text-align: center;
        }

        .items-heading span:last-child {
          text-align: right;
        }

        .item-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 36px 76px;
          align-items: baseline;
          padding: 4px 10px;
          font-size: 11px;
          color: #5e3b33;
        }

        .item-name {
          overflow-wrap: anywhere;
          padding-right: 6px;
        }

        .item-qty {
          text-align: center;
        }

        .item-price {
          text-align: right;
          white-space: nowrap;
        }

        .payment-summary {
          padding-top: 8px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          padding: 3px 10px;
          font-size: 10.5px;
          color: #7c564d;
        }

        .summary-row strong {
          white-space: nowrap;
          font-weight: normal;
          color: #5e3b33;
        }

        .total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 5px;
          padding: 9px 14px;
          background: #edd6d0;
          border-radius: 999px;
          font-size: 15px;
          font-weight: bold;
          color: #5b362e;
          margin-top: 6px;
        }

        .total strong {
          white-space: nowrap;
          font-size: 15px;
        }

        .thanks {
          text-align: center;
          margin-top: 10px;
          padding: 10px 10px;
          background: #f2ded9;
          border-radius: 999px;
          color: #7b5249;
          font-size: 10.5px;
          line-height: 1.35;
        }

        .thanks p {
          margin: 2px 0;
        }

        .thanks .closing {
          font-style: italic;
        }

        @media print {
          body {
            background: #fdf6f0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .receipt {
            box-shadow: none;
          }
        }
      </style>
    </head>

    <body>
      <main class="receipt">

        <header class="header">
          <div class="bunny-wrap">
            ${bunny}
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
            <span>Total</span>
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

  

function renderReport(
    reportType,
    periodType = 'year',
    selectedYear = new Date().getFullYear(),
    selectedMonth = String(new Date().getMonth() + 1).padStart(2, '0')
) {
        const container = document.getElementById('report-content');
    container.dataset.activeReport = reportType;

    const year = Number(selectedYear);
    const month = Number(selectedMonth);

    const startDate = periodType === 'month'
        ? new Date(year, month - 1, 1)
        : new Date(year, 0, 1);

    const endDate = periodType === 'month'
        ? new Date(year, month, 1)
        : new Date(year + 1, 0, 1);

    const allSales = [...(state.data?.sales || [])]
        .sort((a, b) => {
            const dateDifference =
                new Date(a.created_at) - new Date(b.created_at);

            return dateDifference || String(a.id).localeCompare(String(b.id));
        });

    const sales = allSales.filter((sale) => {
        const date = new Date(sale.created_at);
        return date >= startDate && date < endDate;
    });
        const monthNames = [
        'Januari', 'Februari', 'Maret', 'April',
        'Mei', 'Juni', 'Juli', 'Agustus',
        'September', 'Oktober', 'November', 'Desember'
    ];

    const availableYears = [...new Set([
        new Date().getFullYear(),
        year,
        ...allSales.map((sale) => new Date(sale.created_at).getFullYear())
    ])].sort((a, b) => b - a);

    const yearOptions = availableYears.map((item) => `
        <option value="${item}" ${item === year ? 'selected' : ''}>
            ${item}
        </option>
    `).join('');

    const monthOptions = monthNames.map((name, index) => `
        <option value="${String(index + 1).padStart(2, '0')}"
            ${index + 1 === month ? 'selected' : ''}>
            ${name}
        </option>
    `).join('');

    const periodControls = `
        <div class="report-period-controls">
            <label>
                Periode
                <select data-report-period data-period-type>
                    <option value="month" ${periodType === 'month' ? 'selected' : ''}>
                        Bulanan
                    </option>
                    <option value="year" ${periodType === 'year' ? 'selected' : ''}>
                        Tahunan
                    </option>
                </select>
            </label>

            <label>
                Tahun
                <select data-report-period data-period-year>
                    ${yearOptions}
                </select>
            </label>

            <label ${periodType === 'year' ? 'hidden' : ''}>
                Bulan
                <select data-report-period data-period-month>
                    ${monthOptions}
                </select>
            </label>
        </div>
    `;
        const periodEnd = periodType === 'month'
        ? new Date(year, month, 0)
        : new Date(year, 11, 31);

    const periodEndLabel = periodEnd.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    const periodTitle = `Untuk Periode yang Berakhir pada ${periodEndLabel}`;

    // Susun baris jurnal berdasarkan transaksi.
    // Satu transaksi tidak boleh terpisah ke halaman berbeda.
    const journalPages = [];
    const salePage = new Map();

    let currentPage = [];
    let currentPageDebit = 0;
    let currentPageCredit = 0;

    sales.forEach((sale) => {
        const subtotal = Number(
            sale.subtotal_amount ?? sale.total_amount ?? 0
        );
        const pb1 = Number(sale.pb1_amount ?? 0);
        const total = Number(
            sale.total_amount ?? (subtotal + pb1)
        );

        const paymentAccount =
            sale.payment_method === 'Cash' ? 'Kas' : 'Bank';

        const date = sale.created_at;
        const reference = String(sale.id);
        const customer = customerName(sale.customer_id);

        const transactionRows = [
            {
                account: paymentAccount,
                debit: total,
                credit: 0
            },
            {
                account: 'Penjualan',
                debit: 0,
                credit: subtotal
            }
        ];

        if (pb1 > 0) {
            transactionRows.push({
                account: 'Utang PB1',
                debit: 0,
                credit: pb1
            });
        }

        // Jika transaksi berikutnya membuat halaman melebihi
        // 24 baris, pindahkan seluruh transaksi ke halaman baru.
        if (
            currentPage.length > 0 &&
            currentPage.length + transactionRows.length > 24
        ) {
            journalPages.push({
                rows: currentPage,
                totalDebit: currentPageDebit,
                totalCredit: currentPageCredit
            });

            currentPage = [];
            currentPageDebit = 0;
            currentPageCredit = 0;
        }

        const pageNumber = journalPages.length + 1;
        salePage.set(sale.id, pageNumber);

        transactionRows.forEach((row, index) => {
            currentPage.push({
                date,
                reference,
                account: row.account,
                debit: row.debit,
                credit: row.credit,
                description: `Penjualan - ${customer}`,
                firstRow: index === 0
            });

            currentPageDebit += row.debit;
            currentPageCredit += row.credit;
        });
    });

    if (currentPage.length > 0) {
        journalPages.push({
            rows: currentPage,
            totalDebit: currentPageDebit,
            totalCredit: currentPageCredit
        });
    }


// =========================
// LAPORAN PENDAPATAN
// =========================
if (reportType === 'revenue') {
    const startDate = document.getElementById('revenue-start-date')?.value || '';
    const endDate = document.getElementById('revenue-end-date')?.value || '';

    const filteredSales = sales.filter((sale) => {
        const date = new Date(sale.created_at);
        const dateKey = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')
        ].join('-');

        return (!startDate || dateKey >= startDate) &&
               (!endDate || dateKey <= endDate);
    });
    const dailyRevenue = new Map();

    let totalRevenue = 0;

    filteredSales.forEach((sale) => {
        const date = new Date(sale.created_at);
        const dateKey = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')
        ].join('-');

        const subtotal = Number(
            sale.subtotal_amount ?? sale.total_amount ?? 0
        );

        totalRevenue += subtotal;

        const existing = dailyRevenue.get(dateKey) || {
            date,
            transactions: 0,
            revenue: 0
        };

        existing.transactions += 1;
        existing.revenue += subtotal;

        dailyRevenue.set(dateKey, existing);
    });

    const dailyRows = [...dailyRevenue.values()]
        .sort((a, b) => a.date - b.date)
        .map((item) => `
            <tr>
                <td>${safe(item.date.toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                }))}</td>
                <td class="align-right">
                    ${item.transactions}
                </td>
                <td class="align-right">
                    ${money(item.revenue)}
                </td>
            </tr>
        `).join('');

container.innerHTML = `
    <div class="surface-heading">
        <div>
            <span class="eyebrow">LAPORAN AKUNTANSI</span>
            <h3>Laporan Pendapatan</h3>
            <p class="section-subtitle">
                Ringkasan pendapatan dari seluruh transaksi penjualan.
            </p>
        </div>
    </div>

    <div class="surface report-filter">
        <div class="report-filter-fields">
            <label>
                <span>Tanggal Awal</span>
                <input type="date" id="revenue-start-date" value="${startDate}">
            </label>

            <label>
                <span>Tanggal Akhir</span>
                <input type="date" id="revenue-end-date" value="${endDate}">
            </label>

            <button type="button" id="apply-revenue-filter">
                Terapkan
            </button>
        </div>
    </div>

    <div class="stats-grid report-summary-grid">
        <div class="stat-card">
            <div class="stat-top">
                <span>Total Pendapatan</span>
            </div>
            <strong>${money(totalRevenue)}</strong>
            <div class="stat-foot muted-foot">
                Tidak termasuk PB1
            </div>
        </div>

        <div class="stat-card">
            <div class="stat-top">
                <span>Jumlah Transaksi</span>
            </div>
            <strong>${filteredSales.length}</strong>
            <div class="stat-foot muted-foot">
                Seluruh transaksi tercatat
            </div>
        </div>
    </div>

    <section class="surface table-surface">
        <div class="surface-heading">
            <div>
                <h3>Ringkasan Pendapatan Harian</h3>
                <p class="section-subtitle">
                    Pendapatan dikelompokkan berdasarkan tanggal transaksi.
                </p>
            </div>
        </div>

        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Tanggal</th>
                        <th class="align-right">Jumlah Transaksi</th>
                        <th class="align-right">Pendapatan</th>
                    </tr>
                </thead>
                <tbody>
                    ${dailyRows || `
                        <tr>
                            <td colspan="3" class="empty-row">
                                Belum ada transaksi.
                            </td>
                        </tr>
                    `}
                </tbody>
                ${filteredSales.length ? `
                    <tfoot>
                        <tr>
                            <th>TOTAL</th>
                            <th class="align-right">${filteredSales.length}</th>
                            <th class="align-right">${money(totalRevenue)}</th>
                        </tr>
                    </tfoot>
                ` : ''}
            </table>
        </div>
    </section>
`;
        document.getElementById('apply-revenue-filter')
        .addEventListener('click', () => {
            const start = document.getElementById('revenue-start-date').value;
            const end = document.getElementById('revenue-end-date').value;

            if (start && end && start > end) {
                alert('Tanggal awal tidak boleh melebihi tanggal akhir.');
                return;
            }

            renderReport('revenue');
        });
    return;
}


// =========================
// LAPORAN PB1
// =========================
if (reportType === 'pb1') {
    const startDate = document.getElementById('pb1-start-date')?.value || '';
    const endDate = document.getElementById('pb1-end-date')?.value || '';

    const filteredSales = sales.filter((sale) => {
        const date = new Date(sale.created_at);
        const dateKey = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')
        ].join('-');

        return (!startDate || dateKey >= startDate) &&
               (!endDate || dateKey <= endDate);
    });

    const taxableSales = filteredSales.filter(
        (sale) => Number(sale.pb1_amount || 0) > 0
    );

    const dailyPB1 = new Map();
    let totalPB1 = 0;

    taxableSales.forEach((sale) => {
        const date = new Date(sale.created_at);
        const dateKey = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')
        ].join('-');

        const pb1 = Number(sale.pb1_amount || 0);
        totalPB1 += pb1;

        const existing = dailyPB1.get(dateKey) || {
            date,
            transactions: 0,
            amount: 0
        };

        existing.transactions += 1;
        existing.amount += pb1;

        dailyPB1.set(dateKey, existing);
    });

    const dailyRows = [...dailyPB1.values()]
        .sort((a, b) => a.date - b.date)
        .map((item) => `
            <tr>
                <td>${safe(item.date.toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                }))}</td>
                <td class="align-right">${item.transactions}</td>
                <td class="align-right">${money(item.amount)}</td>
            </tr>
        `).join('');

    container.innerHTML = `
        <div class="surface-heading">
            <div>
                <span class="eyebrow">LAPORAN AKUNTANSI</span>
                <h3>Laporan PB1</h3>
                <p class="section-subtitle">
                    Ringkasan PB1 yang dipungut dari transaksi penjualan.
                </p>
            </div>
        </div>

        <div class="surface report-filter">
            <div class="report-filter-fields">
                <label>
                    <span>Tanggal Awal</span>
                    <input type="date" id="pb1-start-date" value="${startDate}">
                </label>

                <label>
                    <span>Tanggal Akhir</span>
                    <input type="date" id="pb1-end-date" value="${endDate}">
                </label>

                <button type="button" id="apply-pb1-filter">
                    Terapkan
                </button>
            </div>
        </div>

        <div class="stats-grid report-summary-grid">
            <div class="stat-card">
                <div class="stat-top">
                    <span>Total PB1 Dipungut</span>
                </div>
                <strong>${money(totalPB1)}</strong>
                <div class="stat-foot muted-foot">
                    Dicatat sebagai utang PB1
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-top">
                    <span>Transaksi Dikenakan PB1</span>
                </div>
                <strong>${taxableSales.length}</strong>
                <div class="stat-foot muted-foot">
                    Transaksi dengan nilai PB1
                </div>
            </div>
        </div>

        <section class="surface table-surface">
            <div class="surface-heading">
                <div>
                    <h3>Rincian PB1 Harian</h3>
                    <p class="section-subtitle">
                        PB1 dikelompokkan berdasarkan tanggal transaksi.
                    </p>
                </div>
            </div>

            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Tanggal</th>
                            <th class="align-right">Jumlah Transaksi</th>
                            <th class="align-right">PB1</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dailyRows || `
                            <tr>
                                <td colspan="3" class="empty-row">
                                    Belum ada transaksi PB1.
                                </td>
                            </tr>
                        `}
                    </tbody>
                    ${taxableSales.length ? `
                        <tfoot>
                            <tr>
                                <th>TOTAL</th>
                                <th class="align-right">${taxableSales.length}</th>
                                <th class="align-right">${money(totalPB1)}</th>
                            </tr>
                        </tfoot>
                    ` : ''}
                </table>
            </div>
        </section>
    `;

    document.getElementById('apply-pb1-filter')
        .addEventListener('click', () => {
            const start = document.getElementById('pb1-start-date').value;
            const end = document.getElementById('pb1-end-date').value;

            if (start && end && start > end) {
                alert('Tanggal awal tidak boleh melebihi tanggal akhir.');
                return;
            }

            renderReport('pb1');
        });

    return;
}


// =========================
// LAPORAN PENERIMAAN KAS/BANK
// =========================
if (reportType === 'cash') {
    const startDate = document.getElementById('cash-start-date')?.value || '';
    const endDate = document.getElementById('cash-end-date')?.value || '';

    const filteredSales = sales.filter((sale) => {
        const date = new Date(sale.created_at);
        const dateKey = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')
        ].join('-');

        return (!startDate || dateKey >= startDate) &&
               (!endDate || dateKey <= endDate);
    });

    const dailyReceipts = new Map();

    let totalCash = 0;
    let totalBank = 0;

    filteredSales.forEach((sale) => {
        const date = new Date(sale.created_at);
        const dateKey = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')
        ].join('-');

        const total = Number(
            sale.total_amount ??
            (Number(sale.subtotal_amount ?? 0) + Number(sale.pb1_amount ?? 0))
        );

        const isCash = sale.payment_method === 'Cash';

        if (isCash) {
            totalCash += total;
        } else {
            totalBank += total;
        }

        const existing = dailyReceipts.get(dateKey) || {
            date,
            cash: 0,
            bank: 0,
            total: 0
        };

        if (isCash) {
            existing.cash += total;
        } else {
            existing.bank += total;
        }

        existing.total += total;
        dailyReceipts.set(dateKey, existing);
    });

    const totalReceipts = totalCash + totalBank;

    const dailyRows = [...dailyReceipts.values()]
        .sort((a, b) => a.date - b.date)
        .map((item) => `
            <tr>
                <td>${safe(item.date.toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                }))}</td>
                <td class="align-right">${money(item.cash)}</td>
                <td class="align-right">${money(item.bank)}</td>
                <td class="align-right">${money(item.total)}</td>
            </tr>
        `).join('');

    container.innerHTML = `
        <div class="surface-heading">
            <div>
                <span class="eyebrow">LAPORAN AKUNTANSI</span>
                <h3>Laporan Penerimaan Kas/Bank</h3>
                <p class="section-subtitle">
                    Ringkasan penerimaan pembayaran dari seluruh transaksi penjualan.
                </p>
            </div>
        </div>

        <div class="surface report-filter">
            <div class="report-filter-fields">
                <label>
                    <span>Tanggal Awal</span>
                    <input type="date" id="cash-start-date" value="${startDate}">
                </label>

                <label>
                    <span>Tanggal Akhir</span>
                    <input type="date" id="cash-end-date" value="${endDate}">
                </label>

                <button type="button" id="apply-cash-filter">
                    Terapkan
                </button>
            </div>
        </div>

        <div class="stats-grid report-summary-grid">
            <div class="stat-card">
                <div class="stat-top">
                    <span>Total Penerimaan Kas</span>
                </div>
                <strong>${money(totalCash)}</strong>
                <div class="stat-foot muted-foot">Pembayaran Cash</div>
            </div>

            <div class="stat-card">
                <div class="stat-top">
                    <span>Total Penerimaan Bank</span>
                </div>
                <strong>${money(totalBank)}</strong>
                <div class="stat-foot muted-foot">
                    QRIS, Debit Card, dan Credit Card
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-top">
                    <span>Total Penerimaan</span>
                </div>
                <strong>${money(totalReceipts)}</strong>
                <div class="stat-foot muted-foot">
                    Kas + Bank
                </div>
            </div>
        </div>

        <section class="surface table-surface">
            <div class="surface-heading">
                <div>
                    <h3>Rincian Penerimaan Harian</h3>
                    <p class="section-subtitle">
                        Penerimaan dikelompokkan berdasarkan tanggal dan metode pembayaran.
                    </p>
                </div>
            </div>

            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Tanggal</th>
                            <th class="align-right">Kas</th>
                            <th class="align-right">Bank</th>
                            <th class="align-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dailyRows || `
                            <tr>
                                <td colspan="4" class="empty-row">
                                    Belum ada penerimaan.
                                </td>
                            </tr>
                        `}
                    </tbody>
                    ${filteredSales.length ? `
                        <tfoot>
                            <tr>
                                <th>TOTAL</th>
                                <th class="align-right">${money(totalCash)}</th>
                                <th class="align-right">${money(totalBank)}</th>
                                <th class="align-right">${money(totalReceipts)}</th>
                            </tr>
                        </tfoot>
                    ` : ''}
                </table>
            </div>
        </section>
    `;

    document.getElementById('apply-cash-filter')
        .addEventListener('click', () => {
            const start = document.getElementById('cash-start-date').value;
            const end = document.getElementById('cash-end-date').value;

            if (start && end && start > end) {
                alert('Tanggal awal tidak boleh melebihi tanggal akhir.');
                return;
            }

            renderReport('cash');
        });

    return;
}


// =========================
// LAPORAN PENJUALAN PER PRODUK
// =========================
if (reportType === 'products') {
    const startDate = document.getElementById('products-start-date')?.value || '';
    const endDate = document.getElementById('products-end-date')?.value || '';

    const filteredSales = sales.filter((sale) => {
        const date = new Date(sale.created_at);
        const dateKey = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')
        ].join('-');

        return (!startDate || dateKey >= startDate) &&
               (!endDate || dateKey <= endDate);
    });

    const productSummary = new Map();

    filteredSales.forEach((sale) => {
        (sale.items || []).forEach((item) => {
            const productName = item.product_name || 'Produk tidak diketahui';

            const quantity = Number(item.quantity || 0);
            const unitPrice = Number(item.unit_price || 0);
            const lineTotal = Number(
                item.line_total ?? (quantity * unitPrice)
            );

            const existing = productSummary.get(productName) || {
                name: productName,
                quantity: 0,
                total: 0
            };

            existing.quantity += quantity;
            existing.total += lineTotal;

            productSummary.set(productName, existing);
        });
    });

    const products = [...productSummary.values()]
        .sort((a, b) => b.total - a.total);

    const totalQuantity = products.reduce(
        (sum, item) => sum + item.quantity, 0
    );

    const totalSales = products.reduce(
        (sum, item) => sum + item.total, 0
    );

    const productRows = products.map((item) => `
        <tr>
            <td>${safe(item.name)}</td>
            <td class="align-right">${item.quantity}</td>
            <td class="align-right">${money(
                item.quantity ? item.total / item.quantity : 0
            )}</td>
            <td class="align-right">${money(item.total)}</td>
        </tr>
    `).join('');

    container.innerHTML = `
        <div class="surface-heading">
            <div>
                <span class="eyebrow">LAPORAN AKUNTANSI</span>
                <h3>Laporan Penjualan per Produk</h3>
                <p class="section-subtitle">
                    Ringkasan jumlah dan nilai penjualan setiap produk.
                </p>
            </div>
        </div>

        <div class="surface report-filter">
            <div class="report-filter-fields">
                <label>
                    <span>Tanggal Awal</span>
                    <input type="date" id="products-start-date" value="${startDate}">
                </label>

                <label>
                    <span>Tanggal Akhir</span>
                    <input type="date" id="products-end-date" value="${endDate}">
                </label>

                <button type="button" id="apply-products-filter">
                    Terapkan
                </button>
            </div>
        </div>

        <div class="stats-grid report-summary-grid">
            <div class="stat-card">
                <div class="stat-top">
                    <span>Total Produk Terjual</span>
                </div>
                <strong>${totalQuantity}</strong>
                <div class="stat-foot muted-foot">
                    Seluruh unit produk
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-top">
                    <span>Total Nilai Penjualan</span>
                </div>
                <strong>${money(totalSales)}</strong>
                <div class="stat-foot muted-foot">
                    Tidak termasuk PB1
                </div>
            </div>
        </div>

        <section class="surface table-surface">
            <div class="surface-heading">
                <div>
                    <h3>Rincian Penjualan Produk</h3>
                    <p class="section-subtitle">
                        Diurutkan berdasarkan nilai penjualan terbesar.
                    </p>
                </div>
            </div>

            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Nama Produk</th>
                            <th class="align-right">Jumlah Terjual</th>
                            <th class="align-right">Harga/Pcs</th>
                            <th class="align-right">Total Penjualan</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${productRows || `
                            <tr>
                                <td colspan="4" class="empty-row">
                                    Belum ada produk terjual.
                                </td>
                            </tr>
                        `}
                    </tbody>
                    ${products.length ? `
                        <tfoot>
                            <tr>
                                <th>TOTAL</th>
                                <th class="align-right">${totalQuantity}</th>
                                <th class="align-right">-</th>
                                <th class="align-right">${money(totalSales)}</th>
                            </tr>
                        </tfoot>
                    ` : ''}
                </table>
            </div>
        </section>
    `;

    document.getElementById('apply-products-filter')
        .addEventListener('click', () => {
            const start = document.getElementById('products-start-date').value;
            const end = document.getElementById('products-end-date').value;

            if (start && end && start > end) {
                alert('Tanggal awal tidak boleh melebihi tanggal akhir.');
                return;
            }

            renderReport('products');
        });

    return;
}

    // =========================
    // BUKU BESAR
    // =========================
    if (reportType === 'ledger') {
        const accounts = {
            'Kas': [],
            'Bank': [],
            'Penjualan': [],
            'Utang PB1': []
        };

        sales.forEach((sale) => {
            const subtotal = Number(
                sale.subtotal_amount ?? sale.total_amount ?? 0
            );
            const pb1 = Number(sale.pb1_amount ?? 0);
            const total = Number(
                sale.total_amount ?? (subtotal + pb1)
            );

            const paymentAccount =
                sale.payment_method === 'Cash' ? 'Kas' : 'Bank';

            const entry = {
                date: sale.created_at,
                reference: `Hal. ${salePage.get(sale.id)}`
            };

            accounts[paymentAccount].push({
                ...entry,
                description: 'Penerimaan penjualan',
                debit: total,
                credit: 0
            });

            accounts['Penjualan'].push({
                ...entry,
                description: 'Penjualan',
                debit: 0,
                credit: subtotal
            });

            if (pb1 > 0) {
                accounts['Utang PB1'].push({
                    ...entry,
                    description: 'PB1 dipungut',
                    debit: 0,
                    credit: pb1
                });
            }
        });

        const accountSections = Object.entries(accounts)
            .map(([account, entries], index) => {
                const debitNormal =
                    account === 'Kas' || account === 'Bank';

                let openingBalance = 0;

allSales.forEach((sale) => {
    if (new Date(sale.created_at) >= startDate) return;

    const subtotal = Number(
        sale.subtotal_amount ?? sale.total_amount ?? 0
    );
    const pb1 = Number(sale.pb1_amount ?? 0);
    const total = Number(
        sale.total_amount ?? (subtotal + pb1)
    );

    const paymentAccount =
        sale.payment_method === 'Cash' ? 'Kas' : 'Bank';

    if (account === paymentAccount) {
        openingBalance += total;
    }

    if (account === 'Penjualan') {
        openingBalance += subtotal;
    }

    if (account === 'Utang PB1') {
        openingBalance += pb1;
    }
});

let balance = openingBalance;
let totalDebit = 0;
let totalCredit = 0;

const openingSide = openingBalance >= 0
    ? (debitNormal ? 'D' : 'K')
    : (debitNormal ? 'K' : 'D');

const openingRow = openingBalance !== 0 ? `
    <tr>
        <td>-</td>
        <td>Saldo awal</td>
        <td>-</td>
        <td class="align-right">-</td>
        <td class="align-right">-</td>
        <td class="align-right">
            ${money(Math.abs(openingBalance))} ${openingSide}
        </td>
    </tr>
` : '';

const movementRows = entries.map((entry) => {
    balance += debitNormal
        ? entry.debit - entry.credit
        : entry.credit - entry.debit;

    totalDebit += entry.debit;
    totalCredit += entry.credit;

    const date = new Date(entry.date)
        .toLocaleDateString('id-ID');

    const saldoNormal = debitNormal
        ? (balance >= 0 ? 'D' : 'K')
        : (balance >= 0 ? 'K' : 'D');

    return `
        <tr>
            <td>${safe(date)}</td>
            <td>${safe(entry.description)}</td>
            <td>${safe(entry.reference)}</td>
            <td class="align-right">
                ${entry.debit ? money(entry.debit) : '-'}
            </td>
            <td class="align-right">
                ${entry.credit ? money(entry.credit) : '-'}
            </td>
            <td class="align-right">
                ${money(Math.abs(balance))} ${saldoNormal}
            </td>
        </tr>
    `;
}).join('');

const rows = openingRow + movementRows;
                const finalBalance = balance >= 0
                    ? (debitNormal ? 'D' : 'K')
                    : (debitNormal ? 'K' : 'D');

                const accountClass = [
                    'ledger-cash',
                    'ledger-bank',
                    'ledger-revenue',
                    'ledger-tax'
                ][index];

                return `
                    <section class="ledger-account ${accountClass}">
                        <div class="ledger-account-heading">
                            <div>
                                <span class="eyebrow">
                                    BUKU BESAR · AKUN ${String(index + 1).padStart(2, '0')}
                                </span>
                                <h3>${account}</h3>
                                <p>
                                    Saldo normal:
                                    ${debitNormal ? 'Debit' : 'Kredit'}
                                </p>
                            </div>

                            <div class="ledger-final-balance">
                                <span>Saldo akhir</span>
                                <strong>
                                    ${money(Math.abs(balance))} ${finalBalance}
                                </strong>
                            </div>
                        </div>

                        <div class="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Tanggal</th>
                                        <th>Keterangan</th>
                                        <th>Ref</th>
                                        <th class="align-right">Debit</th>
                                        <th class="align-right">Kredit</th>
                                        <th class="align-right">Saldo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rows || `
                                        <tr>
                                            <td colspan="6" class="empty-row">
                                                Belum ada mutasi akun.
                                            </td>
                                        </tr>
                                    `}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <th colspan="3">Total Mutasi</th>
                                        <th class="align-right">
                                            ${money(totalDebit)}
                                        </th>
                                        <th class="align-right">
                                            ${money(totalCredit)}
                                        </th>
                                        <th class="align-right">
                                            ${money(Math.abs(balance))}
                                        </th>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </section>
                `;
            }).join('');

        container.innerHTML = `
            <div class="surface-heading">
                <div>
                    <span class="eyebrow">LAPORAN AKUNTANSI</span>
                    <h3>Buku Besar</h3>
                    <p class="section-subtitle">
                        Rincian mutasi dan saldo setiap akun.
                    </p>
                 </div>
            </div>
             ${periodControls}
             ${accountSections}
          `;

        return;
    }

    // =========================
    // JURNAL UMUM
    // =========================
    if (reportType === 'journal') {
        const pagesHTML = journalPages.map((page, index) => {
            const pageNumber = index + 1;

            const rows = page.rows.map((row) => `
                <tr>
                    <td>
                        ${row.firstRow
                            ? safe(new Date(row.date).toLocaleDateString('id-ID'))
                            : ''}
                    </td>
                    <td>
                        ${row.firstRow ? safe(row.reference) : ''}
                    </td>
                    <td class="${row.debit > 0 ? 'account-debit' : 'account-credit'}">
                       ${safe(row.account)}
                    </td>
                    <td class="align-right">
                        ${row.debit ? money(row.debit) : '-'}
                    </td>
                    <td class="align-right">
                        ${row.credit ? money(row.credit) : '-'}
                    </td>
                </tr>
            `).join('');

            return `
                <section class="journal-page">
                    <div class="journal-title">
                        <h2>Mowi's Bakery</h2>
                        <h3>JURNAL UMUM</h3>
<p>${periodTitle}</p>                    
</div>

                    <div class="journal-page-label">
                        <strong>Halaman ${pageNumber}</strong>
                    </div>

                    <div class="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Tanggal</th>
                                    <th>No. Bukti</th>
                                    <th>Akun</th>
                                    <th class="align-right">Debit</th>
                                    <th class="align-right">Kredit</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <th colspan="3">TOTAL HALAMAN ${pageNumber}</th>
                                    <th class="align-right">
                                        ${money(page.totalDebit)}
                                    </th>
                                    <th class="align-right">
                                        ${money(page.totalCredit)}
                                    </th>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div class="journal-page-footer">
                        Halaman ${pageNumber}
                    </div>
                </section>
            `;
        }).join('');

container.innerHTML = `
    ${periodControls}
    ${pagesHTML || `
        <section class="journal-page">
            <div class="journal-title">
                <h2>Mowi's Bakery</h2>
                <h3>JURNAL UMUM</h3>
                <p>${periodTitle}</p>
            </div>
            <p class="empty-row">Belum ada transaksi.</p>
        </section>
    `}
`;
        return;
    }

    // =========================
    // LAPORAN LAINNYA
    // =========================
    container.innerHTML = `
        <div class="surface-heading">
            <div>
                <span class="eyebrow">LAPORAN AKUNTANSI</span>
                <h3>Laporan sedang disiapkan</h3>
            </div>
        </div>
        <p class="section-subtitle">
            Laporan ini akan tersedia setelah tahap berikutnya selesai.
        </p>
    `;
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
        applyRoleAccess();
        renderProfile();
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
      
      if (target.dataset.report) {
  renderReport(target.dataset.report);
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
        document.addEventListener('change', (event) => {
        const target = event.target;

        if (!target.matches('[data-report-period]')) return;

        const container = document.getElementById('report-content');

        const reportType = container.dataset.activeReport;
        const periodType = container.querySelector('[data-period-type]').value;
        const year = Number(container.querySelector('[data-period-year]').value);
        const month = container.querySelector('[data-period-month]').value;

        renderReport(reportType, periodType, year, month);
    });
  }

  function applyRoleAccess() {
    const role = store.profile?.role;
    const isCashier = role === 'cashier';

    document.querySelectorAll(
        '.nav-link[data-view="products"], .nav-link[data-view="reports"]'
    ).forEach((button) => {
        button.style.display = isCashier ? 'none' : '';
    });
}
function renderProfile() {
    const profile = store.profile;
    if (!profile) return;

    const name = profile.full_name || store.user?.email || 'Pengguna';

    const initials = name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(word => word[0])
        .join('')
        .toUpperCase();

    document.getElementById('profile-avatar').textContent = initials;
    document.getElementById('profile-name').textContent = name;
    document.getElementById('profile-role').textContent =
    profile.role === 'owner' ? 'Owner' : 'Cashier';
}  
async function initialize() {
    updateDateLabels();
    setupEvents();
    try {
      const authenticated = await store.initialize();
      if (!authenticated) { showLogin(); return; }
      state.data = store.data;
      renderProfile();
      applyRoleAccess();
      render();
      showWorkspace();
      if (location.hash) switchView(location.hash.slice(1));
    } catch (error) {
      showLogin(error.message || 'Sesi tidak valid. Silakan masuk kembali.');
    }
  }

  document.addEventListener('DOMContentLoaded', initialize);
})();
