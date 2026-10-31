(function () {
  const SUPABASE_URL = "https://ypcaujoqkqhwxhrlpely.supabase.co";
  const SUPABASE_KEY = "sb_publishable_uC5vBXtOP19NaZucxQnr4Q_f2-w6rwL";
  const LEGACY_TOKEN_KEY = "flovely_access_token";
  const LEGACY_REFRESH_KEY = "flovely_refresh_token";

  const client = window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(LEGACY_REFRESH_KEY);

  function clientError(fallback) {
    return new Error(fallback || "Terjadi kesalahan. Silakan coba lagi.");
  }

  function databaseError(error, fallback) {
    return new Error((error && error.message) || fallback);
  }

  function text(value, maxLength = 500) {
    return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
  }

  function validVariant(ukuran, warna) {
    return ["Small", "Medium", "Large"].includes(ukuran) && text(warna, 40);
  }

  async function getUser() {
    if (!client) return null;
    const { data, error } = await client.auth.getUser();
    if (error) return null;
    return data.user || null;
  }

  async function requireUser() {
    const user = await getUser();
    if (!user) throw clientError("Silakan login untuk melanjutkan.");
    return user;
  }

  async function findProduct(productId) {
    const { data, error } = await client
      .from("products")
      .select("id, stok")
      .eq("id", productId)
      .maybeSingle();
    if (error) throw databaseError(error, "Gagal memeriksa bouquet.");
    if (!data) throw clientError("Bouquet tidak ditemukan.");
    return data;
  }

  async function listCart(userId) {
    const { data, error } = await client
      .from("cart")
      .select("id, product_id, ukuran, warna, jumlah, pesan_ucapan, created_at, product:products(id, nama_produk, harga, gambar, stok)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw databaseError(error, "Gagal mengambil keranjang. Silakan coba lagi.");
    return data || [];
  }

  async function addToCart(userId, body) {
    const { product_id, ukuran, warna, jumlah, pesan_ucapan = "" } = body || {};
    const quantity = Number(jumlah);
    if (!text(product_id, 80) || !validVariant(ukuran, warna)
      || !Number.isInteger(quantity) || quantity < 1 || quantity > 99
      || typeof pesan_ucapan !== "string" || pesan_ucapan.length > 300) {
      throw clientError("Pilihan bouquet atau jumlah tidak valid.");
    }

    const product = await findProduct(product_id);

    const { data: existing, error: cartError } = await client
      .from("cart")
      .select("id, jumlah")
      .eq("user_id", userId)
      .eq("product_id", product_id)
      .eq("ukuran", ukuran)
      .eq("warna", warna)
      .maybeSingle();
    if (cartError) throw databaseError(cartError, "Gagal memperbarui keranjang.");

    const nextQuantity = (existing ? existing.jumlah : 0) + quantity;
    if (nextQuantity > product.stok) throw clientError("Jumlah melebihi stok yang tersedia.");

    const save = existing
      ? client.from("cart").update({ jumlah: nextQuantity, pesan_ucapan }).eq("id", existing.id)
      : client.from("cart").insert({
        user_id: userId, product_id, ukuran, warna, jumlah: quantity, pesan_ucapan
      });
    const { data, error } = await save
      .select("id, product_id, ukuran, warna, jumlah, pesan_ucapan")
      .single();
    if (error) throw databaseError(error, "Gagal menambahkan bouquet ke keranjang.");
    return data;
  }

  async function updateCartItem(userId, id, body) {
    const quantity = Number(body && body.jumlah);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw clientError("Jumlah harus berupa angka antara 1 dan 99.");
    }

    const { data: row, error: readError } = await client
      .from("cart")
      .select("id, product:products(stok)")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (readError) throw databaseError(readError, "Gagal memeriksa keranjang.");
    if (!row) throw clientError("Item keranjang tidak ditemukan.");
    if (quantity > row.product.stok) throw clientError("Jumlah melebihi stok yang tersedia.");

    const { data, error } = await client
      .from("cart")
      .update({ jumlah: quantity })
      .eq("id", id)
      .eq("user_id", userId)
      .select("id, product_id, ukuran, warna, jumlah, pesan_ucapan")
      .single();
    if (error) throw databaseError(error, "Gagal mengubah jumlah bouquet.");
    return data;
  }

  async function removeCartItem(userId, id) {
    const { error } = await client
      .from("cart")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw databaseError(error, "Gagal menghapus bouquet dari keranjang.");
    return { message: "Item dihapus dari keranjang." };
  }

  async function listWishlist(userId) {
    const { data, error } = await client
      .from("wishlist")
      .select("id, product_id, created_at, product:products(id, nama_produk, deskripsi, harga, gambar, rating, stok)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw databaseError(error, "Gagal mengambil wishlist. Silakan coba lagi.");
    return data || [];
  }

  async function addToWishlist(userId, body) {
    const product_id = body && body.product_id;
    if (!text(product_id, 80)) throw clientError("Produk tidak valid.");
    await findProduct(product_id);

    const { data, error } = await client
      .from("wishlist")
      .upsert({ user_id: userId, product_id }, { onConflict: "user_id,product_id", ignoreDuplicates: true })
      .select("id, product_id")
      .maybeSingle();
    if (error) throw databaseError(error, "Gagal menyimpan wishlist.");
    return data || { product_id };
  }

  async function removeFromWishlist(userId, productId) {
    const { error } = await client
      .from("wishlist")
      .delete()
      .eq("user_id", userId)
      .eq("product_id", productId);
    if (error) throw databaseError(error, "Gagal menghapus wishlist.");
    return { message: "Bouquet dihapus dari wishlist." };
  }

  async function getProfile(userId) {
    const { data, error } = await client
      .from("profiles")
      .select("id, nama, email, nomor_hp, alamat, created_at")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw databaseError(error, "Gagal mengambil profil. Silakan coba lagi.");
    if (!data) throw clientError("Profil belum tersedia. Silakan daftar kembali.");
    return data;
  }

  async function updateProfile(userId, body) {
    const { nama, nomor_hp, alamat } = body || {};
    if (!text(nama, 100) || !text(nomor_hp, 30) || !text(alamat, 500)) {
      throw clientError("Nama, nomor HP, dan alamat harus diisi.");
    }
    const { data, error } = await client
      .from("profiles")
      .update({ nama: nama.trim(), nomor_hp: nomor_hp.trim(), alamat: alamat.trim() })
      .eq("id", userId)
      .select("id, nama, email, nomor_hp, alamat, created_at")
      .single();
    if (error) throw databaseError(error, "Gagal menyimpan profil. Silakan coba lagi.");
    return data;
  }

  async function listOrders(userId) {
    const { data, error } = await client
      .from("orders")
      .select("id, nomor_pesanan, total_harga, status, created_at, order_items(id, nama_produk, ukuran, warna, jumlah, harga)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw databaseError(error, "Gagal mengambil pesanan. Silakan coba lagi.");
    return data || [];
  }

  async function getOrder(userId, id) {
    const { data, error } = await client
      .from("orders")
      .select("id, nomor_pesanan, nama_penerima, nomor_hp, alamat, total_harga, metode_pembayaran, status, created_at, order_items(id, nama_produk, ukuran, warna, jumlah, harga, pesan_ucapan)")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw databaseError(error, "Gagal mengambil detail pesanan.");
    if (!data) throw clientError("Pesanan tidak ditemukan.");
    return data;
  }

  async function createOrder(userId, body) {
    const { nama_penerima, nomor_hp, alamat, pesan_tambahan = "", metode_pembayaran } = body || {};
    if (!text(nama_penerima, 100) || !text(nomor_hp, 30) || !text(alamat, 500)
      || typeof pesan_tambahan !== "string" || pesan_tambahan.length > 500
      || !["Transfer Bank", "COD", "QRIS"].includes(metode_pembayaran)) {
      throw clientError("Periksa kembali data penerima dan metode pembayaran.");
    }

    const { data: orderId, error } = await client.rpc("create_flovely_order", {
      p_nama_penerima: nama_penerima.trim(),
      p_nomor_hp: nomor_hp.trim(),
      p_alamat: alamat.trim(),
      p_pesan_tambahan: pesan_tambahan.trim(),
      p_metode_pembayaran: metode_pembayaran
    });
    if (error) {
      const message = error.message.includes("EMPTY_CART") ? "Keranjang Anda masih kosong."
        : error.message.includes("INSUFFICIENT_STOCK") ? "Stok bouquet tidak mencukupi. Perbarui keranjang Anda."
          : "Pesanan gagal dibuat. Silakan periksa data dan coba lagi.";
      throw clientError(message);
    }

    const { data, error: readError } = await client
      .from("orders")
      .select("id, nomor_pesanan, total_harga, status, created_at, order_items(id, nama_produk, ukuran, warna, jumlah, harga, pesan_ucapan)")
      .eq("id", orderId)
      .eq("user_id", userId)
      .single();
    if (readError) throw databaseError(readError, "Pesanan dibuat, tetapi ringkasannya gagal dimuat.");
    return data;
  }

  async function request(url, options = {}) {
    if (!client) throw clientError("Koneksi ke Supabase belum siap. Muat ulang halaman lalu coba lagi.");

    const method = (options.method || "GET").toUpperCase();
    const body = options.body ? JSON.parse(options.body) : {};
    const parsed = new URL(url, window.location.href);
    const path = parsed.pathname.replace(/\/+$/, "");

    if (path === "/api/auth/login" && method === "POST") {
      const { data, error } = await client.auth.signInWithPassword({
        email: String(body.email || "").trim(),
        password: String(body.password || "")
      });
      if (error || !data.session) {
        const message = error && /email not confirmed/i.test(error.message)
          ? "Email belum diverifikasi. Silakan cek inbox kamu."
          : "Email atau password tidak sesuai.";
        throw clientError(message);
      }
      return { session: data.session };
    }

    if (path === "/api/auth/register" && method === "POST") {
      const nama = body.nama;
      const email = body.email;
      const password = body.password;
      if (!text(nama, 100) || !text(email, 254) || typeof password !== "string" || password.length < 6) {
        throw clientError("Isi nama, email, dan password minimal 6 karakter.");
      }
      const { data, error } = await client.auth.signUp({
        email: String(email).trim(),
        password,
        options: { data: { nama: String(nama).trim() } }
      });
      if (error) {
        const message = /already registered/i.test(error.message)
          ? "Email sudah terdaftar. Silakan login."
          : "Pendaftaran gagal. Periksa kembali data Anda.";
        throw clientError(message);
      }
      return {
        message: data.session
          ? "Akun berhasil dibuat."
          : "Akun berhasil dibuat. Silakan cek email untuk verifikasi.",
        session: data.session
      };
    }

    if (path === "/api/auth/logout" && method === "POST") {
      const { error } = await client.auth.signOut();
      if (error) throw databaseError(error, "Tidak dapat keluar. Silakan coba lagi.");
      return { message: "Anda berhasil logout." };
    }

    if (path === "/api/products" && method === "GET") {
      let query = client.from("products").select("*").order("created_at", { ascending: false });
      const search = parsed.searchParams.get("q");
      if (search) query = query.ilike("nama_produk", `%${search}%`);
      const { data, error } = await query;
      if (error) throw databaseError(error, "Gagal mengambil daftar bouquet. Silakan coba lagi.");
      return data || [];
    }

    const productMatch = path.match(/^\/api\/products\/([^/]+)$/);
    if (productMatch && method === "GET") {
      const { data, error } = await client
        .from("products")
        .select("*")
        .eq("id", decodeURIComponent(productMatch[1]))
        .maybeSingle();
      if (error) throw databaseError(error, "Gagal mengambil detail bouquet. Silakan coba lagi.");
      if (!data) throw clientError("Bouquet tidak ditemukan.");
      return data;
    }

    if (path === "/api/profile" && method === "GET") {
      return getProfile((await requireUser()).id);
    }

    if (path === "/api/profile" && method === "PUT") {
      return updateProfile((await requireUser()).id, body);
    }

    if (path === "/api/cart" && method === "GET") {
      return listCart((await requireUser()).id);
    }

    if (path === "/api/cart" && method === "POST") {
      return addToCart((await requireUser()).id, body);
    }

    const cartMatch = path.match(/^\/api\/cart\/([^/]+)$/);
    if (cartMatch && method === "PUT") {
      return updateCartItem((await requireUser()).id, decodeURIComponent(cartMatch[1]), body);
    }
    if (cartMatch && method === "DELETE") {
      return removeCartItem((await requireUser()).id, decodeURIComponent(cartMatch[1]));
    }

    if (path === "/api/wishlist" && method === "GET") {
      return listWishlist((await requireUser()).id);
    }

    if (path === "/api/wishlist" && method === "POST") {
      return addToWishlist((await requireUser()).id, body);
    }

    const wishlistMatch = path.match(/^\/api\/wishlist\/([^/]+)$/);
    if (wishlistMatch && method === "DELETE") {
      return removeFromWishlist((await requireUser()).id, decodeURIComponent(wishlistMatch[1]));
    }

    if (path === "/api/orders" && method === "POST") {
      return createOrder((await requireUser()).id, body);
    }

    if (path === "/api/orders" && method === "GET") {
      return listOrders((await requireUser()).id);
    }

    const orderMatch = path.match(/^\/api\/orders\/([^/]+)$/);
    if (orderMatch && method === "GET") {
      return getOrder((await requireUser()).id, decodeURIComponent(orderMatch[1]));
    }

    throw clientError("Endpoint tidak ditemukan.");
  }

  function saveSession() {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(LEGACY_REFRESH_KEY);
  }

  function clearSession() {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(LEGACY_REFRESH_KEY);
    if (client) client.auth.signOut().catch(() => {});
  }

  function hasSession() {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      try {
        const value = JSON.parse(localStorage.getItem(key));
        if (value && value.access_token) return true;
      } catch {
        // Abaikan nilai sesi yang rusak.
      }
    }
    return false;
  }

  function requireSession() {
    if (!hasSession()) {
      const next = window.location.pathname + window.location.search;
      window.location.href = `login.html?next=${encodeURIComponent(next)}`;
      return false;
    }
    return true;
  }

  function priceForSize(basePrice, size) {
    const multiplier = size === "Large" ? 1.5 : size === "Medium" ? 1.25 : 1;
    return Math.round((Number(basePrice) * multiplier) / 1000) * 1000;
  }

  function formatPrice(amount) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(Number(amount) || 0);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  window.Flovely = {
    supabase: client,
    request,
    saveSession,
    clearSession,
    hasSession,
    requireSession,
    getUser,
    priceForSize,
    formatPrice,
    escapeHtml
  };
})();
