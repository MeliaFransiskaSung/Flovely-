(function () {
  const root = document.getElementById("cart-root");

  function render(items) {
    if (!items.length) {
      root.innerHTML = '<div class="empty-state"><p>Keranjangmu masih kosong.</p><a class="button button-primary" href="index.html">Jelajahi bouquet</a></div>';
      return;
    }

    const subtotal = items.reduce((sum, item) => sum + Flovely.priceForSize(item.product.harga, item.ukuran) * item.jumlah, 0);
    root.innerHTML = `
      <div class="cart-layout">
        <div class="cart-list">${items.map((item) => `
          <article class="cart-item" data-cart-id="${Flovely.escapeHtml(item.id)}">
            <img src="${Flovely.escapeHtml(item.product.gambar)}" alt="${Flovely.escapeHtml(item.product.nama_produk)}">
            <div><h3>${Flovely.escapeHtml(item.product.nama_produk)}</h3><p>${Flovely.escapeHtml(item.ukuran)} · ${Flovely.escapeHtml(item.warna)}${item.pesan_ucapan ? ` · Kartu: ${Flovely.escapeHtml(item.pesan_ucapan)}` : ""}</p>
              <div class="quantity-control"><button type="button" data-change="-1" aria-label="Kurangi jumlah">−</button><input type="number" min="1" max="${item.product.stok}" value="${item.jumlah}" aria-label="Jumlah"><button type="button" data-change="1" aria-label="Tambah jumlah">+</button></div><button class="remove-button" type="button" data-remove>Hapus</button>
            </div>
            <div class="cart-item-price">${Flovely.formatPrice(Flovely.priceForSize(item.product.harga, item.ukuran) * item.jumlah)}</div>
          </article>`).join("")}</div>
        <aside class="summary-card"><h2>Ringkasan belanja</h2><div class="summary-line"><span>Subtotal (${items.length} item)</span><strong>${Flovely.formatPrice(subtotal)}</strong></div><div class="summary-line"><span>Pengiriman</span><span>Dihitung saat konfirmasi</span></div><div class="summary-line summary-total"><span>Total sementara</span><strong>${Flovely.formatPrice(subtotal)}</strong></div><a class="button button-primary" href="checkout.html">Pesan Sekarang →</a><p class="summary-hint">Ongkir akan dikonfirmasi oleh tim Flovely.</p></aside>
      </div>`;
  }

  async function load() {
    try {
      render(await Flovely.request("/api/cart"));
    } catch (error) {
      root.innerHTML = `<div class="empty-state">${Flovely.escapeHtml(error.message)}</div>`;
    }
  }

  root.addEventListener("click", async (event) => {
    const item = event.target.closest("[data-cart-id]");
    if (!item) return;
    const id = item.dataset.cartId;
    try {
      if (event.target.closest("[data-remove]")) {
        await Flovely.request(`/api/cart/${encodeURIComponent(id)}`, { method: "DELETE" });
        await load();
        return;
      }
      const control = event.target.closest("[data-change]");
      if (control) {
        const input = item.querySelector("input");
        const quantity = Number(input.value) + Number(control.dataset.change);
        if (quantity < 1) return;
        await Flovely.request(`/api/cart/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: JSON.stringify({ jumlah: quantity })
        });
        await load();
      }
    } catch (error) {
      window.alert(error.message);
    }
  });

  load();
})();
