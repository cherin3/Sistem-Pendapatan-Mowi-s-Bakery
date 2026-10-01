# Mowi's Bakery

Aplikasi pencatatan pendapatan bakery sederhana. Berjalan langsung di browser; tidak memakai Node.js, npm, `package.json`, atau server aplikasi.

## Struktur

```text
frontend/
  index.html
  styles.css
  crud.css
  app.js
backend/
  app.js
  schema.sql
```

## Jalankan mode demo

Buka `frontend/index.html` di browser. Mode demo memakai data contoh dan menyimpan perubahan di penyimpanan browser ini.

## Hubungkan Supabase

1. Buat project Supabase.
2. Buka **SQL Editor**, jalankan seluruh isi `backend/schema.sql`. Jika tabel sudah pernah dibuat, jalankan ulang seluruh file ini untuk memasang policy UPDATE/DELETE dan RPC CRUD terbaru; perintahnya aman dijalankan ulang.
3. URL project dan publishable key sudah menjadi koneksi bawaan di `backend/app.js`; aplikasi akan terhubung otomatis. Jika perlu menggantinya, buka **Pengaturan database**.
4. Jangan masukkan `service_role` key ke aplikasi browser.

Data model terdiri dari empat tabel: `customers` memiliki banyak `sales`; `sales` memiliki banyak `sale_items`; dan setiap `sale_item` merujuk `products`. RPC `create_sale`, `update_sale`, dan `delete_sale` mengelola transaksi serta stok secara atomik.

> Skema ini memberi akses CRUD ke peran `anon` agar aplikasi statis tanpa login dapat digunakan. Ini cocok untuk prototipe atau penggunaan terbatas, bukan data produksi publik. Sebelum dipublikasikan, aktifkan Supabase Auth dan ubah kebijakan RLS agar data hanya dapat diakses pengguna yang berwenang.
