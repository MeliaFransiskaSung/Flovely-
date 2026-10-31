(function () {
  const root = document.getElementById("orders-root");
  if (!Flovely.requireSession()) return;

  function statusClass(status) {
    if (status === "Diproses") return "processed";
    if (status === "Dikirim") return "shipped";
    if (status === "Selesai") return "done";
    return "";
  }

  Flovely.request("/api/orders").then((orders) => {
    if (!orders.length) {
      root.innerHTML = '<div class="empty-state"><p>Belum ada pesanan.</p><a class="button button-primary" href="/">Jelajahi bouquet</a></div>';
      return;
    }

    root.innerHTML = `<div class="orders-list">${orders.map((order) => {
      const date = new Date(order.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
      return `<article class="order-card">
        <div class="order-top"><div><p class="order-id">${Flovely.escapeHtml(order.nomor_pesanan)}</p><p class="order-date">${date}</p></div><span class="status-pill ${statusClass(order.status)}">${Flovely.escapeHtml(order.status)}</span></div>
        <div class="order-lines">${order.order_items.map((item) => `<div class="order-line"><span>${Flovely.escapeHtml(item.nama_produk)} · ${Flovely.escapeHtml(item.ukuran)} · ${item.jumlah} buah</span><strong>${Flovely.formatPrice(item.harga * item.jumlah)}</strong></div>`).join("")}</div>
        <div class="order-bottom"><span>Total pembayaran <strong>${Flovely.formatPrice(order.total_harga)}</strong></span><button class="order-detail-button" type="button" data-order="${Flovely.escapeHtml(order.id)}">Detail pesanan →</button></div>
        <div class="order-detail" id="order-detail-${Flovely.escapeHtml(order.id)}" hidden></div>
      </article>`;
    }).join("")}</div>`;
  }).catch((error) => {
    root.innerHTML = `<div class="empty-state">${Flovely.escapeHtml(error.message)}</div>`;
  });

  root.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-order]");
    if (!button) return;
    const detail = root.querySelector(`#order-detail-${CSS.escape(button.dataset.order)}`);
    if (!detail.hidden) {
      detail.hidden = true;
      button.textContent = "Detail pesanan →";
      return;
    }
    try {
      const order = await Flovely.request(`/api/orders/${encodeURIComponent(button.dataset.order)}`);
      detail.innerHTML = `Penerima: ${Flovely.escapeHtml(order.nama_penerima)}<br>Alamat: ${Flovely.escapeHtml(order.alamat)}<br>Pembayaran: ${Flovely.escapeHtml(order.metode_pembayaran)}<br>${order.order_items.map((item) => `${Flovely.escapeHtml(item.nama_produk)} — ${Flovely.escapeHtml(item.warna)}${item.pesan_ucapan ? ` · Ucapan: ${Flovely.escapeHtml(item.pesan_ucapan)}` : ""}`).join("<br>")}`;
      detail.hidden = false;
      button.textContent = "Tutup detail ↑";
    } catch (error) {
      detail.textContent = error.message;
      detail.hidden = false;
    }
  });
})();
