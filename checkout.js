(function () {
  const root = document.getElementById("checkout-root");
  if (!Flovely.requireSession()) return;
  let cartItems = [];

  function render(items, profile) {
    cartItems = items;
    if (!items.length) {
      root.innerHTML = '<div class="empty-state"><p>Keranjangmu masih kosong.</p><a class="button button-primary" href="index.html">Cari bouquet</a></div>';
      return;
    }

    const subtotal = items.reduce((sum, item) => sum + Flovely.priceForSize(item.product.harga, item.ukuran) * item.jumlah, 0);
    root.innerHTML = `
      <div class="checkout-layout">
        <form id="checkout-form" class="checkout-form">
          <h2>Informasi penerima</h2>
          <label>Nama penerima<input name="nama_penerima" maxlength="100" required value="${Flovely.escapeHtml(profile?.nama || "")}" placeholder="Nama lengkap penerima"></label>
          <label>Nomor HP<input name="nomor_hp" type="tel" maxlength="30" required value="${Flovely.escapeHtml(profile?.nomor_hp || "")}" placeholder="08xxxxxxxxxx"></label>
          <label>Alamat lengkap<textarea name="alamat" maxlength="500" required placeholder="Jalan, nomor rumah, kecamatan, kota">${Flovely.escapeHtml(profile?.alamat || "")}</textarea></label>
          <label>Pesan tambahan<textarea name="pesan_tambahan" maxlength="500" placeholder="Catatan untuk pengiriman (opsional)"></textarea></label>
          <label>Metode pembayaran<select name="metode_pembayaran" required><option value="">Pilih metode pembayaran</option><option>Transfer Bank</option><option>QRIS</option><option>COD</option></select></label>
          <div class="form-message" aria-live="polite"></div>
          <button class="button button-primary button-wide" type="submit">Buat Pesanan</button>
        </form>
        <aside class="summary-card"><h2>Ringkasan pesanan</h2>
          <div class="checkout-items">${items.map((item) => `<div class="checkout-item"><span>${Flovely.escapeHtml(item.product.nama_produk)}<br><small>${Flovely.escapeHtml(item.ukuran)} · ${item.jumlah} buah</small></span><strong>${Flovely.formatPrice(Flovely.priceForSize(item.product.harga, item.ukuran) * item.jumlah)}</strong></div>`).join("")}</div>
          <div class="summary-line"><span>Subtotal</span><strong>${Flovely.formatPrice(subtotal)}</strong></div><div class="summary-line"><span>Pengiriman</span><span>Dikonfirmasi terpisah</span></div><div class="summary-line summary-total"><span>Total</span><strong>${Flovely.formatPrice(subtotal)}</strong></div>
          <p class="summary-hint">Harga bouquet belum termasuk ongkos kirim.</p>
        </aside>
      </div>`;

    root.querySelector("#checkout-form").addEventListener("submit", placeOrder);
  }

  async function placeOrder(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const message = form.querySelector(".form-message");
    button.disabled = true;
    button.textContent = "Memproses pesanan...";

    try {
      const body = Object.fromEntries(new FormData(form).entries());
      const order = await Flovely.request("/api/orders", {
        method: "POST",
        body: JSON.stringify(body)
      });
      root.innerHTML = `<div class="empty-state"><span class="auth-flower" style="margin:0 auto 15px">✓</span><h2>Pesanan berhasil dibuat!</h2><p>Nomor pesanan <strong>${Flovely.escapeHtml(order.nomor_pesanan)}</strong></p><p>Total pembayaran: <strong>${Flovely.formatPrice(order.total_harga)}</strong></p><a class="button button-primary" href="orders.html">Lihat Pesanan Saya</a></div>`;
    } catch (error) {
      message.textContent = error.message;
      button.disabled = false;
      button.textContent = "Buat Pesanan";
    }
  }

  Promise.all([
    Flovely.request("/api/cart"),
    Flovely.request("/api/profile").catch(() => null)
  ]).then(([items, profile]) => render(items, profile))
    .catch((error) => {
      root.innerHTML = `<div class="empty-state">${Flovely.escapeHtml(error.message)}</div>`;
    });
})();
