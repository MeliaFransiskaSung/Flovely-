(function () {
  const grid = document.getElementById("product-list");
  const searchInput = document.getElementById("product-search");
  let savedIds = new Set();
  let searchTimer;

  function productCard(product) {
    const saved = savedIds.has(product.id);
    return `
      <article class="product-card">
        <a class="product-image" href="detail.html?id=${encodeURIComponent(product.id)}">
          <img src="${Flovely.escapeHtml(product.gambar)}" alt="${Flovely.escapeHtml(product.nama_produk)}" loading="lazy">
        </a>
        <button class="wishlist-button${saved ? " saved" : ""}" type="button" data-wishlist="${Flovely.escapeHtml(product.id)}" aria-label="${saved ? "Hapus dari" : "Simpan ke"} wishlist" aria-pressed="${saved}">${saved ? "♥" : "♡"}</button>
        <div class="product-info">
          <h3>${Flovely.escapeHtml(product.nama_produk)}</h3>
          <div class="product-rating">★ ${Number(product.rating || 5).toFixed(1)} <span>· Favorit pelanggan</span></div>
          <div class="product-bottom"><span class="product-price">${Flovely.formatPrice(product.harga)}</span></div>
        </div>
      </article>`;
  }

  async function loadProducts(query = "") {
    grid.innerHTML = '<p class="muted">Memuat bouquet favorit...</p>';
    try {
      const products = await Flovely.request(`/api/products${query ? `?q=${encodeURIComponent(query)}` : ""}`);
      grid.innerHTML = products.length
        ? products.map(productCard).join("")
        : '<div class="empty-state">Bouquet tidak ditemukan. Coba kata pencarian lain.</div>';
    } catch (error) {
      grid.innerHTML = `<div class="empty-state">${Flovely.escapeHtml(error.message)}</div>`;
    }
  }

  async function initWishlist() {
    try {
      const items = await Flovely.request("/api/wishlist");
      savedIds = new Set(items.map((item) => item.product_id));
    } catch (error) {
      console.error("Gagal mengambil wishlist:", error);
    } finally {
      loadProducts(searchInput ? searchInput.value.trim() : "");
    }
  }

  initWishlist();

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => loadProducts(searchInput.value.trim()), 250);
    });
  }

  grid.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-wishlist]");
    if (!button) return;

    const productId = button.dataset.wishlist;
    try {
      if (savedIds.has(productId)) {
        await Flovely.request(`/api/wishlist/${encodeURIComponent(productId)}`, { method: "DELETE" });
        savedIds.delete(productId);
      } else {
        await Flovely.request("/api/wishlist", {
          method: "POST",
          body: JSON.stringify({ product_id: productId })
        });
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
