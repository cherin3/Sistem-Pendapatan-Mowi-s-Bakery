(() => {
  const store = window.BakeryStore;
  const productEmojis = ['🥐', '🍞', '🍰', '🍪', '🧁', '🥖'];
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
    document.getElementById('stat-today').textContent = money(today.reduce((sum, sale) => sum + Number(sale.total_amount), 0));
    document.getElementById('stat-month').textContent = money(month.reduce((sum, sale) => sum + Number(sale.total_amount), 0));
    document.getElementById('stat-count').textContent = new Intl.NumberFormat('id-ID').format(month.length);
    document.getElementById('stat-products').textContent = new Intl.NumberFormat('id-ID').format(state.data.products.filter((product) => product.is_active !== false).length);
    document.getElementById('stat-today-note').textContent = `${today.length} transaksi tercatat`;
  }

  function renderChart() {
    const chart = document.getElementById('bar-chart');
    const now = new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + index);
      const amount = state.data.sales.filter((sale) => dayKey(new Date(sale.created_at)) === dayKey(date)).reduce((sum, sale) => sum + Number(sale.total_amount), 0);
      return { date, amount };
    });
    const maximum = Math.max(...days.map((day) => day.amount), 1);
    chart.innerHTML = days.map(({ date, amount }) => {
      const today = dayKey(date) === dayKey(now);
      const height = amount ? Math.max(8, amount / maximum * 100) : 3;
      return `<div class="bar-column${today ? ' today' : ''}" title="${safe(date.toLocaleDateString('id-ID'))}: ${money(amount)}"><div class="bar-track"><span class="bar-fill" style="--bar-height:${height}%"></span></div><span class="bar-day">${today ? 'Hari ini' : safe(date.toLocaleDateString('id-ID', { weekday: 'short' }))}</span></div>`;
    }).join('');
    document.getElementById('chart-total').textContent = money(days.reduce((sum, day) => sum + day.amount, 0));
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
      const actions = target === 'recent-table-body' ? '' : `<td class="row-actions"><button type="button" class="icon-action" title="Ubah transaksi" aria-label="Ubah transaksi" data-edit="sale" data-id="${safe(sale.id)}">✎</button><button type="button" class="icon-action danger-action" title="Hapus transaksi" aria-label="Hapus transaksi" data-delete="sale" data-id="${safe(sale.id)}">×</button></td>`;
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
    const products = [...state.data.products].sort((a, b) => a.name.localeCompare(b.name));
    document.getElementById('product-count').textContent = `${products.length} produk`;
    document.getElementById('products-table-body').innerHTML = products.length ? products.map((product, index) => `<tr><td><span class="table-customer"><span class="favorite-thumb">${productEmojis[index % productEmojis.length]}</span><span class="customer-name">${safe(product.name)}</span></span></td><td>${safe(product.category || 'Lainnya')}</td><td>${Number(product.stock) <= 5 ? `<span class="stock-low">${Number(product.stock)} tersisa</span>` : `${Number(product.stock)} pcs`}</td><td class="align-right table-total">${money(product.price)}</td><td class="row-actions"><button type="button" class="icon-action" title="Ubah produk" aria-label="Ubah produk" data-edit="product" data-id="${safe(product.id)}">✎</button><button type="button" class="icon-action danger-action" title="Hapus produk" aria-label="Hapus produk" data-delete="product" data-id="${safe(product.id)}">×</button></td></tr>`).join('') : '<tr><td class="empty-row" colspan="5">Belum ada produk.</td></tr>';
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
    renderStats(); renderChart(); renderFavorites();
    renderSales(sortedSales().slice(0, 5), 'recent-table-body');
    renderTransactions(); renderProducts(); renderCustomers(); renderCustomerOptions();
    const demo = store.mode !== 'live';
    const status = document.getElementById('connection-status');
    status.className = `connection-status${demo ? '' : ' live'}`;
    status.innerHTML = `<i></i> ${demo ? 'Mode demo lokal' : 'Terhubung ke Supabase'}`;
  }

  function switchView(view) {
    if (!['overview', 'transactions', 'products', 'customers'].includes(view)) return;
    document.querySelectorAll('.view-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `view-${view}`));
    document.querySelectorAll('.nav-link[data-view]').forEach((link) => link.classList.toggle('active', link.dataset.view === view));
    document.getElementById('page-breadcrumb').textContent = { overview: 'Ringkasan', transactions: 'Transaksi', products: 'Produk', customers: 'Pelanggan' }[view];
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
    const total = [...document.querySelectorAll('.sale-item-row')].reduce((sum, row) => {
      const product = state.data.products.find((item) => item.id === row.querySelector('select').value);
      return sum + (product ? product.price * (Number(row.querySelector('input').value) || 0) : 0);
    }, 0);
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
      product: { eyebrow: 'KATALOG BAKERY', add: 'Tambah produk', edit: 'Ubah produk', fields: '<label class="field-label">Nama produk<input name="name" required maxlength="100" placeholder="Contoh: Danish pastry"></label><label class="field-label">Kategori<input name="category" required maxlength="50" placeholder="Roti, Pastry, Cake..."></label><label class="field-label">Harga jual<input name="price" type="number" min="0" step="500" required placeholder="18000"></label><label class="field-label">Stok<input name="stock" type="number" min="0" step="1" required value="0"></label>' },
      customer: { eyebrow: 'KOMUNITAS MOWI\'S', add: 'Tambah pelanggan', edit: 'Ubah pelanggan', fields: '<label class="field-label">Nama pelanggan<input name="name" required maxlength="100" placeholder="Nama lengkap"></label><label class="field-label">Nomor telepon<input name="phone" type="tel" maxlength="30" placeholder="08xx xxxx xxxx"></label>' }
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
    document.querySelectorAll('.nav-link[data-view]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
    document.addEventListener('click', (event) => {
      const target = event.target.closest('button, a');
      if (!target) return;
      if (target.dataset.goto) { event.preventDefault(); switchView(target.dataset.goto); }
      if (target.dataset.action === 'sale') openSale();
      if (target.dataset.action === 'product' || target.dataset.action === 'customer') openEntity(target.dataset.action);
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
    document.getElementById('open-settings').addEventListener('click', () => {
      document.getElementById('supabase-url').value = store.config?.url || '';
      document.getElementById('supabase-key').value = store.config?.key || '';
      document.getElementById('connection-message').textContent = '';
      document.getElementById('settings-dialog').showModal();
    });
    document.getElementById('settings-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = document.getElementById('connection-message');
      const button = event.currentTarget.querySelector('[type="submit"]');
      button.disabled = true;
      message.textContent = 'Memeriksa koneksi...';
      try {
        await store.connect(document.getElementById('supabase-url').value.trim(), document.getElementById('supabase-key').value.trim());
        state.data = store.data; render(); document.getElementById('settings-dialog').close();
      } catch (error) { message.textContent = `Tidak dapat terhubung: ${error.message}`; }
      finally { button.disabled = false; }
    });
    document.getElementById('use-demo').addEventListener('click', () => {
      store.useDemo(); state.data = store.data; render(); document.getElementById('settings-dialog').close();
    });
  }

  async function initialize() {
    updateDateLabels();
    setupEvents();
    await store.initialize();
    state.data = store.data;
    render();
    if (location.hash) switchView(location.hash.slice(1));
  }

  document.addEventListener('DOMContentLoaded', initialize);
})();
