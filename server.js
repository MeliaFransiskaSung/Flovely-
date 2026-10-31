require("dotenv").config();

const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const path = require("path");

const app = express();
const port = Number(process.env.PORT) || 3000;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("SUPABASE_URL dan SUPABASE_KEY wajib diatur di file .env.");
  process.exit(1);
}

app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

function createSupabase(token) {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
  });
}

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function handleDatabaseError(res, error, message) {
  console.error("Supabase request failed:", error.message);
  return sendError(res, 500, message);
}

function requireAuth(req, res, next) {
  const authorization = req.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!token) {
    return sendError(res, 401, "Silakan login untuk melanjutkan.");
  }

  const supabase = createSupabase(token);
  supabase.auth.getUser(token).then(({ data, error }) => {
    if (error || !data.user) {
      return sendError(res, 401, "Sesi login berakhir. Silakan login kembali.");
    }

    req.user = data.user;
    req.supabase = supabase;
    return next();
  }).catch((error) => {
    console.error("Token verification failed:", error.message);
    return sendError(res, 401, "Sesi login tidak valid. Silakan login kembali.");
  });
}

function isText(value, maxLength = 500) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

function validVariant(ukuran, warna) {
  return ["Small", "Medium", "Large"].includes(ukuran)
    && isText(warna, 40);
}

app.post("/api/auth/register", async (req, res) => {
  const { nama, email, password } = req.body || {};
  if (!isText(nama, 100) || !isText(email, 254) || typeof password !== "string" || password.length < 6) {
    return sendError(res, 400, "Isi nama, email, dan password minimal 6 karakter.");
  }

  const { data, error } = await createSupabase().auth.signUp({
    email: email.trim(),
    password,
    options: { data: { nama: nama.trim() } }
  });
  if (error) {
    return sendError(res, 400, error.message.includes("already registered")
      ? "Email sudah terdaftar. Silakan login."
      : "Pendaftaran gagal. Periksa kembali data Anda.");
  }
  return res.status(201).json({
    message: data.session
      ? "Akun berhasil dibuat."
      : "Akun berhasil dibuat. Silakan cek email untuk verifikasi.",
    session: data.session
  });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!isText(email, 254) || typeof password !== "string" || !password) {
    return sendError(res, 400, "Masukkan email dan password.");
  }

  const { data, error } = await createSupabase().auth.signInWithPassword({
    email: email.trim(),
    password
  });
  if (error || !data.session) {
    return sendError(res, 401, "Email atau password tidak sesuai.");
  }
  return res.json({
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: data.user
    }
  });
});

app.post("/api/auth/logout", requireAuth, async (req, res) => {
  const { error } = await req.supabase.auth.signOut();
  if (error) {
    return handleDatabaseError(res, error, "Tidak dapat keluar. Silakan coba lagi.");
  }
  return res.json({ message: "Anda berhasil logout." });
});

app.get("/api/products", async (req, res) => {
  let query = createSupabase()
    .from("products")
    .select("id, nama_produk, deskripsi, harga, gambar, kategori, rating, stok, created_at")
    .order("created_at", { ascending: false });

  const search = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  if (search) query = query.ilike("nama_produk", `%${search}%`);

  const { data, error } = await query;
  if (error) return handleDatabaseError(res, error, "Gagal mengambil daftar bouquet. Silakan coba lagi.");
  return res.json(data);
});

app.get("/api/products/:id", async (req, res) => {
  const { data, error } = await createSupabase()
    .from("products")
    .select("id, nama_produk, deskripsi, harga, gambar, kategori, rating, stok, created_at")
    .eq("id", req.params.id)
    .maybeSingle();

  if (error) return handleDatabaseError(res, error, "Gagal mengambil detail bouquet. Silakan coba lagi.");
  if (!data) return sendError(res, 404, "Bouquet tidak ditemukan.");
  return res.json(data);
});

app.use("/api", requireAuth);

app.get("/api/profile", async (req, res) => {
  const { data, error } = await req.supabase
    .from("profiles")
    .select("id, nama, email, nomor_hp, alamat, created_at")
    .eq("id", req.user.id)
    .maybeSingle();

  if (error) return handleDatabaseError(res, error, "Gagal mengambil profil. Silakan coba lagi.");
  if (!data) return sendError(res, 404, "Profil belum tersedia. Silakan daftar kembali.");
  return res.json(data);
});

app.put("/api/profile", async (req, res) => {
  const { nama, nomor_hp, alamat } = req.body || {};
  if (!isText(nama, 100) || !isText(nomor_hp, 30) || !isText(alamat, 500)) {
    return sendError(res, 400, "Nama, nomor HP, dan alamat harus diisi.");
  }

  const { data, error } = await req.supabase
    .from("profiles")
    .update({ nama: nama.trim(), nomor_hp: nomor_hp.trim(), alamat: alamat.trim() })
    .eq("id", req.user.id)
    .select("id, nama, email, nomor_hp, alamat, created_at")
    .single();

  if (error) return handleDatabaseError(res, error, "Gagal menyimpan profil. Silakan coba lagi.");
  return res.json(data);
});

app.get("/api/cart", async (req, res) => {
  const { data, error } = await req.supabase
    .from("cart")
    .select("id, product_id, ukuran, warna, jumlah, pesan_ucapan, created_at, product:products(id, nama_produk, harga, gambar, stok)")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: true });

  if (error) return handleDatabaseError(res, error, "Gagal mengambil keranjang. Silakan coba lagi.");
  return res.json(data);
});

app.post("/api/cart", async (req, res) => {
  const { product_id, ukuran, warna, jumlah, pesan_ucapan = "" } = req.body || {};
  const quantity = Number(jumlah);
  if (!isText(product_id, 80) || !validVariant(ukuran, warna)
    || !Number.isInteger(quantity) || quantity < 1 || quantity > 99
    || typeof pesan_ucapan !== "string" || pesan_ucapan.length > 300) {
    return sendError(res, 400, "Pilihan bouquet atau jumlah tidak valid.");
  }

  const { data: product, error: productError } = await req.supabase
    .from("products")
    .select("id, stok")
    .eq("id", product_id)
    .maybeSingle();
  if (productError) return handleDatabaseError(res, productError, "Gagal memeriksa stok bouquet.");
  if (!product) return sendError(res, 404, "Bouquet tidak ditemukan.");

  const { data: existing, error: cartError } = await req.supabase
    .from("cart")
    .select("id, jumlah")
    .eq("user_id", req.user.id)
    .eq("product_id", product_id)
    .eq("ukuran", ukuran)
    .eq("warna", warna)
    .maybeSingle();
  if (cartError) return handleDatabaseError(res, cartError, "Gagal memperbarui keranjang.");

  const nextQuantity = (existing ? existing.jumlah : 0) + quantity;
  if (nextQuantity > product.stok) return sendError(res, 400, "Jumlah melebihi stok yang tersedia.");

  const save = existing
    ? req.supabase.from("cart").update({ jumlah: nextQuantity, pesan_ucapan }).eq("id", existing.id)
    : req.supabase.from("cart").insert({
      user_id: req.user.id, product_id, ukuran, warna, jumlah: quantity, pesan_ucapan
    });
  const { data, error } = await save
    .select("id, product_id, ukuran, warna, jumlah, pesan_ucapan")
    .single();
  if (error) return handleDatabaseError(res, error, "Gagal menambahkan bouquet ke keranjang.");
  return res.status(existing ? 200 : 201).json(data);
});

app.put("/api/cart/:id", async (req, res) => {
  const quantity = Number(req.body && req.body.jumlah);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    return sendError(res, 400, "Jumlah harus berupa angka antara 1 dan 99.");
  }

  const { data: row, error: readError } = await req.supabase
    .from("cart")
    .select("id, product:products(stok)")
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .maybeSingle();
  if (readError) return handleDatabaseError(res, readError, "Gagal memeriksa keranjang.");
  if (!row) return sendError(res, 404, "Item keranjang tidak ditemukan.");
  if (quantity > row.product.stok) return sendError(res, 400, "Jumlah melebihi stok yang tersedia.");

  const { data, error } = await req.supabase
    .from("cart")
    .update({ jumlah: quantity })
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .select("id, product_id, ukuran, warna, jumlah, pesan_ucapan")
    .single();
  if (error) return handleDatabaseError(res, error, "Gagal mengubah jumlah bouquet.");
  return res.json(data);
});

app.delete("/api/cart/:id", async (req, res) => {
  const { error } = await req.supabase
    .from("cart")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", req.user.id);
  if (error) return handleDatabaseError(res, error, "Gagal menghapus bouquet dari keranjang.");
  return res.json({ message: "Item dihapus dari keranjang." });
});

app.get("/api/wishlist", async (req, res) => {
  const { data, error } = await req.supabase
    .from("wishlist")
    .select("id, product_id, created_at, product:products(id, nama_produk, deskripsi, harga, gambar, rating, stok)")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false });
  if (error) return handleDatabaseError(res, error, "Gagal mengambil wishlist. Silakan coba lagi.");
  return res.json(data);
});

app.post("/api/wishlist", async (req, res) => {
  const { product_id } = req.body || {};
  if (!isText(product_id, 80)) return sendError(res, 400, "Produk tidak valid.");

  const { data, error } = await req.supabase
    .from("wishlist")
    .upsert({ user_id: req.user.id, product_id }, { onConflict: "user_id,product_id", ignoreDuplicates: true })
    .select("id, product_id")
    .maybeSingle();
  if (error) return handleDatabaseError(res, error, "Gagal menyimpan wishlist.");
  return res.status(201).json(data || { product_id });
});

app.delete("/api/wishlist/:productId", async (req, res) => {
  const { error } = await req.supabase
    .from("wishlist")
    .delete()
    .eq("user_id", req.user.id)
    .eq("product_id", req.params.productId);
  if (error) return handleDatabaseError(res, error, "Gagal menghapus wishlist.");
  return res.json({ message: "Bouquet dihapus dari wishlist." });
});

app.post("/api/orders", async (req, res) => {
  const { nama_penerima, nomor_hp, alamat, pesan_tambahan = "", metode_pembayaran } = req.body || {};
  if (!isText(nama_penerima, 100) || !isText(nomor_hp, 30) || !isText(alamat, 500)
    || typeof pesan_tambahan !== "string" || pesan_tambahan.length > 500
    || !["Transfer Bank", "COD", "QRIS"].includes(metode_pembayaran)) {
    return sendError(res, 400, "Periksa kembali data penerima dan metode pembayaran.");
  }

  const { data: orderId, error } = await req.supabase.rpc("create_flovely_order", {
    p_nama_penerima: nama_penerima.trim(),
    p_nomor_hp: nomor_hp.trim(),
    p_alamat: alamat.trim(),
    p_pesan_tambahan: pesan_tambahan.trim(),
    p_metode_pembayaran: metode_pembayaran
  });
  if (error) {
    console.error("Order creation failed:", error.message);
    const message = error.message.includes("EMPTY_CART") ? "Keranjang Anda masih kosong."
      : error.message.includes("INSUFFICIENT_STOCK") ? "Stok bouquet tidak mencukupi. Perbarui keranjang Anda."
        : "Pesanan gagal dibuat. Silakan periksa data dan coba lagi.";
    return sendError(res, 400, message);
  }

  const { data, error: readError } = await req.supabase
    .from("orders")
    .select("id, nomor_pesanan, total_harga, status, created_at, order_items(id, nama_produk, ukuran, warna, jumlah, harga, pesan_ucapan)")
    .eq("id", orderId)
    .eq("user_id", req.user.id)
    .single();
  if (readError) return handleDatabaseError(res, readError, "Pesanan dibuat, tetapi ringkasannya gagal dimuat.");
  return res.status(201).json(data);
});

app.get("/api/orders", async (req, res) => {
  const { data, error } = await req.supabase
    .from("orders")
    .select("id, nomor_pesanan, total_harga, status, created_at, order_items(id, nama_produk, ukuran, warna, jumlah, harga)")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false });
  if (error) return handleDatabaseError(res, error, "Gagal mengambil pesanan. Silakan coba lagi.");
  return res.json(data);
});

app.get("/api/orders/:id", async (req, res) => {
  const { data, error } = await req.supabase
    .from("orders")
    .select("id, nomor_pesanan, nama_penerima, nomor_hp, alamat, total_harga, metode_pembayaran, status, created_at, order_items(id, nama_produk, ukuran, warna, jumlah, harga, pesan_ucapan)")
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .maybeSingle();
  if (error) return handleDatabaseError(res, error, "Gagal mengambil detail pesanan.");
  if (!data) return sendError(res, 404, "Pesanan tidak ditemukan.");
  return res.json(data);
});

app.use("/api", (req, res) => sendError(res, 404, "Endpoint tidak ditemukan."));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === "entity.parse.failed") {
    return sendError(res, 400, "Format data yang dikirim tidak valid.");
  }
  console.error("Request failed:", error.message);
  return sendError(res, 500, "Terjadi kesalahan pada server. Silakan coba lagi.");
});

app.listen(port, () => {
  console.log(`Flovely berjalan di http://localhost:${port}`);
});
