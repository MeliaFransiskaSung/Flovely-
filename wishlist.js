(function () {
  const root = document.getElementById("wishlist-root");
  if (!Flovely.requireSession()) return;

  async function load() {
    try {
      const entries = await Flovely.request("/api/wishlist");
      if (!entries.length) {
        root.innerHTML = '<div class="empty-state"><p>Wishlist-mu masih kosong.</p><a class="button button-primary" href="index.html">Temukan bouquet</a></div>';
        return;
      }
      root.innerHTML = `<div class="product-grid">${entries.map(({ product }) => `
        <article class="product-card">
          <a class="product-image" href="detail.html?id=${encodeURIComponent(product.id)}"><img src="${Flovely.escapeHtml(product.gambar)}" alt="${Flovely.escapeHtml(product.nama_produk)}" loading="lazy"></a>
          <button class="wishlist-button saved" type="button" data-remove="${Flovely.escapeHtml(product.id)}" aria-label="Hapus dari wishlist">♥</button>
          <div class="product-info"><div class="product-rating">★ ${Number(product.rating).toFixed(1)}</div><h3>${Flovely.escapeHtml(product.nama_produk)}</h3>
            <div class="product-bottom"><span class="product-price">${Flovely.formatPrice(product.harga)}</span><a class="product-link" href="detail.html?id=${encodeURIComponent(product.id)}">Lihat detail →</a></div>
          </div>
        </article>`).join("")}</div>`;
    } catch (error) {
      root.innerHTML = `<div class="empty-state">${Flovely.escapeHtml(error.message)}</div>`;
    }
  }

  root.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-remove]");
    if (!button) return;
    try {
      await Flovely.request(`/api/wishlist/${encodeURIComponent(button.dataset.remove)}`, { method: "DELETE" });
      await load();
    } catch (error) {
      window.alert(error.message);
    }
  });

  load();
})();
