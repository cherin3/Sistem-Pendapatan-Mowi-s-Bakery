(() => {
	const configKey = 'mowis-bakery-supabase';
	const dataKey = 'mowis-bakery-demo-data';
	const sessionKey = 'mowis-bakery-auth-session';
	const defaultConfig = {
		url: 'https://mremqkoofstntzrhpwvo.supabase.co',
		key: 'sb_publishable_suQVXA3yTnVU6UNOhKZgTQ_VgAPxJ-6'
	};
	const productsSeed = [
		['Croissant Butter', 'Pastry', 18000, 28], ['Sourdough Loaf', 'Roti', 42000, 12],
		['Strawberry Shortcake', 'Cake', 38000, 9], ['Cinnamon Roll', 'Pastry', 22000, 16],
		['Choco Chip Cookie', 'Cookies', 12000, 34], ['Milk Bun', 'Roti', 15000, 20]
	];
	const customersSeed = [
		['Nadia Putri', '0812 3456 7890'], ['Raka Pratama', '0813 2468 1357'],
		['Salsa Maharani', '0821 7788 9900'], ['Dimas Arya', '0857 1100 2233']
	];
	const salesSeed = [
		[0, 0, 'QRIS', [[0, 2], [4, 2]]], [0, 1, 'Tunai', [[1, 1], [3, 2]]],
		[1, 2, 'Transfer', [[2, 1], [0, 2]]], [2, 0, 'QRIS', [[3, 3], [5, 2]]],
		[3, 3, 'Tunai', [[1, 1], [4, 3]]], [4, 1, 'QRIS', [[0, 3], [2, 1]]],
		[6, 2, 'Transfer', [[3, 2], [4, 2]]], [8, 3, 'Tunai', [[5, 3], [0, 1]]],
		[11, 0, 'QRIS', [[2, 1], [3, 2]]], [15, 1, 'Transfer', [[1, 2], [4, 2]]],
		[24, 2, 'Tunai', [[0, 2], [5, 2]]], [40, 3, 'QRIS', [[3, 3], [2, 1]]]
	];
	const state = { mode: 'locked', config: loadConfig(), session: loadSession(), data: null };

	function seedData() {
		const products = productsSeed.map(([name, category, price, stock], index) => ({ id: `demo-p${index + 1}`, name, category, price, stock, is_active: true }));
		const customers = customersSeed.map(([name, phone], index) => ({ id: `demo-c${index + 1}`, name, phone }));
		const sales = salesSeed.map(([days, customerIndex, payment, lines], index) => {
			const items = lines.map(([productIndex, quantity]) => {
				const product = products[productIndex];
				return { product_id: product.id, product_name: product.name, quantity, unit_price: product.price, line_total: product.price * quantity };
			});
			return {
				id: `demo-s${index + 1}`, customer_id: customers[customerIndex].id, payment_method: payment,
				total_amount: items.reduce((sum, item) => sum + item.line_total, 0),
				created_at: new Date(Date.now() - days * 86400000 - (index + 1) * 3600000).toISOString(), items
			};
		});
		return { customers, products, sales };
	}

	function loadConfig() {
		try {
			const saved = JSON.parse(localStorage.getItem(configKey) || 'null');
			if (saved && typeof saved === 'object' && saved.url && saved.key) return saved;
			return defaultConfig;
		} catch { return defaultConfig; }
	}

	function loadSession() {
		try { return JSON.parse(localStorage.getItem(sessionKey) || 'null'); } catch { return null; }
	}

	function saveSession(session) {
		state.session = session;
		if (session) localStorage.setItem(sessionKey, JSON.stringify(session));
		else localStorage.removeItem(sessionKey);
	}

	function normalizeSession(session) {
		return {
			access_token: session.access_token,
			refresh_token: session.refresh_token,
			expires_at: session.expires_at || Math.floor(Date.now() / 1000) + Number(session.expires_in || 3600),
			user: session.user
		};
	}

	async function authRequest(path, options = {}, accessToken = null) {
		if (!state.config?.url || !state.config?.key) throw new Error('Konfigurasi Supabase belum tersedia.');
		const headers = { apikey: state.config.key, 'Content-Type': 'application/json', ...options.headers };
		if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
		const response = await fetch(`${state.config.url.replace(/\/$/, '')}/auth/v1/${path}`, { ...options, headers });
		if (!response.ok) {
			const body = await response.text();
			let message = body;
			try { const parsed = JSON.parse(body); message = parsed.msg || parsed.message || parsed.error_description || parsed.error || body; } catch { /* Keep the server response. */ }
			const error = new Error(message || `Supabase Auth merespons ${response.status}.`);
			error.status = response.status;
			throw error;
		}
		if (response.status === 204) return null;
		return response.json();
	}

	async function refreshSession() {
		if (!state.session?.refresh_token) throw new Error('Sesi login berakhir. Silakan masuk kembali.');
		const refreshed = await authRequest('token?grant_type=refresh_token', {
			method: 'POST', body: JSON.stringify({ refresh_token: state.session.refresh_token })
		});
		const session = normalizeSession(refreshed);
		saveSession(session);
		return session.access_token;
	}

	async function getAccessToken() {
		if (!state.session?.access_token) throw new Error('Silakan masuk dengan akun operator.');
		if (Number(state.session.expires_at) * 1000 <= Date.now() + 60000) return refreshSession();
		return state.session.access_token;
	}

	async function login(email, password) {
		const result = await authRequest('token?grant_type=password', {
			method: 'POST', body: JSON.stringify({ email, password })
		});
		saveSession(normalizeSession(result));
		try {
			await refresh();
		} catch (error) {
			state.mode = 'locked';
			state.data = null;
			throw error;
		}
	}

	async function logout() {
		if (state.session?.access_token) {
			try { await authRequest('logout', { method: 'POST' }, await getAccessToken()); } catch { /* Clear the local session even if the network is unavailable. */ }
		}
		saveSession(null);
		state.mode = 'locked';
		state.data = null;
	}

	function persist() {
		try { localStorage.setItem(dataKey, JSON.stringify(state.data)); } catch { /* Keep the active session usable if storage is unavailable. */ }
	}

	function loadDemo() {
		try {
			const saved = JSON.parse(localStorage.getItem(dataKey) || 'null');
			if (saved && Array.isArray(saved.customers) && Array.isArray(saved.products) && Array.isArray(saved.sales)) return saved;
		} catch { /* Seed a fresh demo after malformed local data. */ }
		state.data = seedData();
		persist();
		return state.data;
	}

	async function request(path, options = {}) {
		if (!state.config?.url || !state.config?.key) throw new Error('Isi Project URL dan anon key Supabase terlebih dahulu.');
		const token = await getAccessToken();
		const response = await fetch(`${state.config.url.replace(/\/$/, '')}/rest/v1/${path}`, {
			...options,
			headers: {
				apikey: state.config.key,
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
				...options.headers
			}
		});
		if (!response.ok) {
			const body = await response.text();
			let message = body;
			try { const parsed = JSON.parse(body); message = parsed.message || parsed.hint || body; } catch { /* Keep the server response. */ }
			throw new Error(message || `Supabase merespons ${response.status}.`);
		}
		if (response.status === 204) return null;
		return response.json();
	}

	async function refresh() {
		const [customers, products, sales, saleItems] = await Promise.all([
			request('customers?select=*&order=created_at.desc'),
			request('products?select=*&is_active=eq.true&order=name.asc'),
			request('sales?select=*&order=created_at.desc'),
			request('sale_items?select=*')
		]);
		const bySale = new Map();
		saleItems.forEach((item) => {
			const group = bySale.get(item.sale_id) || [];
			group.push(item);
			bySale.set(item.sale_id, group);
		});
		state.data = { customers, products, sales: sales.map((sale) => ({ ...sale, items: bySale.get(sale.id) || [] })) };
		state.mode = 'live';
	}

	async function initialize() {
		state.data = null;
		state.mode = 'locked';
		if (!state.session?.access_token) return false;
		try {
			const token = await getAccessToken();
			const user = await authRequest('user', {}, token);
			state.session.user = user;
			saveSession(state.session);
			await refresh();
			return true;
		} catch (error) {
			if (error.status === 401) saveSession(null);
			state.mode = 'locked';
			state.data = null;
			throw error;
		}
	}

	function validateItems(items) {
		if (!Array.isArray(items) || items.length === 0) throw new Error('Tambahkan minimal satu produk ke pesanan.');
		for (const item of items) {
			if (!item.product_id || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1) throw new Error('Pilih produk dan jumlah yang valid.');
		}
	}

	async function create(type, values) {
		const table = type === 'product' ? 'products' : 'customers';
		const record = type === 'product'
			? { name: values.name.trim(), category: values.category.trim(), price: Number(values.price), stock: Number(values.stock), is_active: true }
			: { name: values.name.trim(), phone: values.phone.trim() || null };
		if (state.mode === 'live') {
			await request(`${table}?select=*`, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(record) });
			await refresh();
			return;
		}
		const rows = state.data[type === 'product' ? 'products' : 'customers'];
		rows.push({ ...record, id: `demo-${type}-${crypto.randomUUID()}`, created_at: new Date().toISOString() });
		persist();
	}

	async function update(type, id, values) {
		const table = type === 'product' ? 'products' : 'customers';
		const record = type === 'product'
			? { name: values.name.trim(), category: values.category.trim(), price: Number(values.price), stock: Number(values.stock) }
			: { name: values.name.trim(), phone: values.phone.trim() || null };
		if (state.mode === 'live') {
			const changed = await request(`${table}?id=eq.${encodeURIComponent(id)}&select=id`, {
				method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(record)
			});
			if (!Array.isArray(changed) || changed.length === 0) {
				throw new Error('Tidak ada data yang berhasil diubah. Pastikan policy UPDATE sudah aktif dengan menjalankan ulang backend/schema.sql di Supabase.');
			}
			await refresh();
			return;
		}
		const rows = state.data[type === 'product' ? 'products' : 'customers'];
		const index = rows.findIndex((item) => item.id === id);
		if (index < 0) throw new Error('Data tidak ditemukan.');
		rows[index] = { ...rows[index], ...record };
		persist();
	}

	async function remove(type, id) {
		if (state.mode === 'live') {
			if (type === 'sale') {
				await request('rpc/delete_sale', { method: 'POST', body: JSON.stringify({ sale_id: id }) });
			} else {
				const table = type === 'product' ? 'products' : 'customers';
				const deleted = await request(`${table}?id=eq.${encodeURIComponent(id)}&select=id`, {
					method: 'DELETE', headers: { Prefer: 'return=representation' }
				});
				if (!Array.isArray(deleted) || deleted.length === 0) {
					throw new Error('Tidak ada data yang berhasil dihapus. Pastikan policy DELETE sudah aktif dengan menjalankan ulang backend/schema.sql di Supabase.');
				}
			}
			await refresh();
			return;
		}
		if (type === 'sale') {
			const sale = state.data.sales.find((item) => item.id === id);
			if (!sale) throw new Error('Transaksi tidak ditemukan.');
			sale.items.forEach((item) => {
				const product = state.data.products.find((candidate) => candidate.id === item.product_id);
				if (product) product.stock = Number(product.stock) + Number(item.quantity);
			});
			state.data.sales = state.data.sales.filter((item) => item.id !== id);
		} else if (type === 'product') {
			state.data.products = state.data.products.filter((item) => item.id !== id);
			state.data.sales.forEach((sale) => sale.items.forEach((item) => { if (item.product_id === id) item.product_id = null; }));
		} else {
			state.data.customers = state.data.customers.filter((item) => item.id !== id);
			state.data.sales.forEach((sale) => { if (sale.customer_id === id) sale.customer_id = null; });
		}
		persist();
	}

	async function createSale(payload) {
		validateItems(payload.items);
		if (state.mode === 'live') {
			await request('rpc/create_sale', { method: 'POST', body: JSON.stringify({ sale_payload: payload }) });
			await refresh();
			return;
		}
		const amounts = new Map();
		payload.items.forEach((item) => amounts.set(item.product_id, (amounts.get(item.product_id) || 0) + Number(item.quantity)));
		for (const [id, quantity] of amounts) {
			const product = state.data.products.find((item) => item.id === id);
			if (!product) throw new Error('Produk tidak ditemukan.');
			if (Number(product.stock) < quantity) throw new Error(`Stok ${product.name} tidak mencukupi.`);
		}
		const items = payload.items.map((item) => {
			const product = state.data.products.find((row) => row.id === item.product_id);
			product.stock = Number(product.stock) - Number(item.quantity);
			return { product_id: product.id, product_name: product.name, quantity: Number(item.quantity), unit_price: Number(product.price), line_total: Number(product.price) * Number(item.quantity) };
		});
		state.data.sales.push({ ...payload, id: `demo-sale-${crypto.randomUUID()}`, total_amount: items.reduce((sum, item) => sum + item.line_total, 0), created_at: new Date().toISOString(), items });
		persist();
	}

	async function updateSale(payload) {
		validateItems(payload.items);
		if (state.mode === 'live') {
			await request('rpc/update_sale', { method: 'POST', body: JSON.stringify({ sale_id: payload.id, sale_payload: payload }) });
			await refresh();
			return;
		}
		const sale = state.data.sales.find((item) => item.id === payload.id);
		if (!sale) throw new Error('Transaksi tidak ditemukan.');
		const available = new Map();
		sale.items.forEach((item) => available.set(item.product_id, (available.get(item.product_id) || 0) + Number(item.quantity)));
		const requested = new Map();
		payload.items.forEach((item) => requested.set(item.product_id, (requested.get(item.product_id) || 0) + Number(item.quantity)));
		for (const [id, quantity] of requested) {
			const product = state.data.products.find((row) => row.id === id);
			if (!product) throw new Error('Produk tidak ditemukan.');
			if (Number(product.stock) + (available.get(id) || 0) < quantity) throw new Error(`Stok ${product.name} tidak mencukupi.`);
		}
		state.data.products.forEach((product) => {
			product.stock = Number(product.stock) + (available.get(product.id) || 0) - (requested.get(product.id) || 0);
		});
		sale.items = payload.items.map((item) => {
			const product = state.data.products.find((row) => row.id === item.product_id);
			return { product_id: product.id, product_name: product.name, quantity: Number(item.quantity), unit_price: Number(product.price), line_total: Number(product.price) * Number(item.quantity) };
		});
		sale.customer_id = payload.customer_id || null;
		sale.payment_method = payload.payment_method;
		sale.total_amount = sale.items.reduce((sum, item) => sum + item.line_total, 0);
		persist();
	}

	async function connect(url, key) {
		if (!url || !key) throw new Error('Project URL dan anon key harus diisi.');
		const normalized = url.replace(/\/$/, '');
		if (!/^https:\/\/[\w.-]+\.supabase\.co$/i.test(normalized)) throw new Error('Gunakan Project URL Supabase yang valid.');
		const previous = state.config;
		state.config = { url: normalized, key };
		try {
			const check = await request('products?select=id&limit=1');
			if (!Array.isArray(check)) throw new Error('Respons Supabase tidak dikenali.');
			await refresh();
			localStorage.setItem(configKey, JSON.stringify(state.config));
		} catch (error) {
			state.config = previous;
			throw error;
		}
	}

	function useDemo() {
		localStorage.setItem(configKey, JSON.stringify('demo'));
		state.config = null;
		state.mode = 'demo';
		state.data = loadDemo();
	}

	window.BakeryStore = {
		get data() { return state.data; },
		get mode() { return state.mode; },
		get config() { return state.config; },
		get user() { return state.session?.user || null; },
		initialize, login, logout, create, update, remove, createSale, updateSale
	};
})();
