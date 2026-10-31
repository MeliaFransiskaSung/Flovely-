(function () {
  const grid = document.getElementById("product-list");
  const searchInput = document.getElementById("product-search");
  let savedIds = new Set();
  let searchTimer;

  // Inisialisasi Supabase Client
  const SUPABASE_URL = 'https://ypcaujoqkqhwxhrlpely.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_uC5vBxTOp19NaZucxQnr4Q_f2-w6rwL';
  const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

  function productCard(product) {
    const saved = savedIds.has(product.id);
    return `
      <article class="product-card">
        <a class="product-image" href="detail.html?id=${encodeURIComponent(product.id)}">
          <img src="${Flovely.escapeHtml(product.gambar)}" alt="${Flovely.escapeHtml(product.nama_produk)}" loading="lazy">
        </a>
        <button class="wishlist-button${saved ? " saved" : ""}" type="button" data-wishlist="${Flovely.escapeHtml(product.id)}" aria-label="${saved ? "Hapus dari" : "Simpan ke"} wishlist" aria-pressed="${saved}">${saved ? "♥" : "♡"}</button>
        <div class="product-info">
          <div class="product-rating">★ ${Number(product.rating || 5).toFixed(1)} <span>· Bouquet pilihan</span></div>
          <h3>${Flovely.escapeHtml(product.nama_produk)}</h3>
          <div class="product-bottom"><span class="product-price">${Flovely.formatPrice(product.harga)}</span><a class="product-link" href="detail.html?id=${encodeURIComponent(product.id)}">Lihat detail →</a></div>
        </div>
      </article>`;
  }

  // Ambil data produk langsung dari Supabase
  async function loadProducts(query = "") {
    grid.innerHTML = '<p class="muted">Memuat bouquet favorit...</p>';
    try {
      if (!supabaseClient) throw new Error("Supabase SDK belum dimuat di HTML.");

      let dbQuery = supabaseClient.from("products").select("*");
      if (query) {
        dbQuery = dbQuery.ilike("nama_produk", `%${query}%`);
      }

      const { data: products, error } = await dbQuery;

      if (error) throw error;

      grid.innerHTML = products && products.length
        ? products.map(productCard).join("")
        : '<div class="empty-state">Bouquet tidak ditemukan. Coba kata pencarian lain.</div>';
    } catch (error) {
      grid.innerHTML = `<div class="empty-state">${Flovely.escapeHtml(error.message)}</div>`;
    }
  }

  // Muat Wishlist User dari Supabase
  async function initWishlist() {
    try {
      if (!supabaseClient) return;
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) {
        const { data: items, error } = await supabaseClient
          .from("wishlists")
          .select("product_id")
          .eq("user_id", user.id);

        if (!error && items) {
          savedIds = new Set(items.map((item) => item.product_id));
        }
      }
    } catch (err) {
      console.error("Gagal mengambil wishlist:", err);
    } finally {
      loadProducts(searchInput ? searchInput.value.trim() : "");
    }
  }

  // Panggil Inisialisasi
  initWishlist();

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => loadProducts(searchInput.value.trim()), 250);
    });
  }

  // Toggle Wishlist via Supabase
  grid.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-wishlist]");
    if (!button) return;

    if (!supabaseClient) return;
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      window.location.href = `login.html?next=${encodeURIComponent("index.html")}`;
      return;
    }

    const productId = button.dataset.wishlist;
    try {
      if (savedIds.has(productId)) {
        // Hapus dari wishlist
        const { error } = await supabaseClient
          .from("wishlists")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", productId);

        if (error) throw error;
        savedIds.delete(productId);
      } else {
        // Tambahkan ke wishlist
        const { error } = await supabaseClient
          .from("wishlists")
          .insert([{ user_id: user.id, product_id: productId }]);

        if (error) throw error;
        savedIds.add(productId);
      }

      button.classList.toggle("saved", savedIds.has(productId));
      button.textContent = savedIds.has(productId) ? "♥" : "♡";
      button.setAttribute("aria-pressed", String(savedIds.has(productId)));
    } catch (error) {
      window.alert(error.message);
    }
  });
})();