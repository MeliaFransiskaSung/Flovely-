# Flovely

Toko bouquet sederhana menggunakan HTML, CSS, JavaScript, Express, dan Supabase.

## Menjalankan aplikasi

1. Pastikan Node.js versi 18 atau lebih baru sudah terpasang.
2. Buat project Supabase, lalu jalankan seluruh isi `supabase-schema.sql` melalui **SQL Editor** Supabase. Script membuat tabel, relasi, kebijakan RLS, fungsi checkout, dan enam produk contoh.
3. Jika project Supabase sudah memiliki skema Flovely, jalankan kembali seluruh isi `supabase-schema.sql` melalui **SQL Editor** untuk menambahkan tabel dan fungsi checkout tamu. Langkah ini diperlukan agar pesanan tanpa login dapat disimpan dengan aman.
4. Salin `.env.example` menjadi `.env`, lalu isi `SUPABASE_URL` dan `SUPABASE_KEY` dari pengaturan project Supabase. Gunakan publishable/anon key, **jangan** gunakan service-role key.
5. Jalankan:

   ```sh
   npm install
   npm start
   ```

6. Buka `http://localhost:3000`.

File `.env` hanya digunakan server dan diabaikan Git. Wishlist dan keranjang untuk pengunjung tersimpan di browser. Checkout tamu mencatat pesanan ke Supabase, tetapi riwayatnya tidak ditautkan ke akun.

## Catatan aplikasi

- Endpoint privat memverifikasi access token Supabase dan menjalankan query menggunakan token pengguna. RLS membatasi akses profil, keranjang, wishlist, dan pesanan ke pemiliknya.
- Checkout akun dan checkout tamu dijalankan dalam fungsi database agar total dihitung dari harga produk di database, stok diperiksa/dikurangi, dan pesanan disimpan secara atomik.
- Harga ukuran Medium adalah 1,25× harga dasar dan Large 1,5×, dibulatkan ke Rp1.000 terdekat. Ongkos kirim belum termasuk dan dikonfirmasi terpisah.
