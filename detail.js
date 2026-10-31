(function () {
  const root = document.getElementById("detail-root");
  const productId = new URLSearchParams(window.location.search).get("id");
  if (!productId) {
    root.innerHTML = '<div class="empty-state">Bouquet tidak ditemukan. <a href="index.html">Kembali ke halaman utama</a></div>';
    return;
  }

  const colorOptions = ["Biru", "Putih", "Pink", "Merah", "Lavender"];
  let product;

  function currentSelection() {
    return {
      ukuran: root.querySelector('[name="ukuran"]:checked').value,
      warna: root.querySelector('[name="warna"]:checked').value,
      jumlah: Number(root.querySelector("#quantity").value),
      pesan_ucapan: root.querySelector("#message").value.trim()
    };
  }

  function updatePrice() {
    const size = root.querySelector('[name="ukuran"]:checked').value;
    root.querySelector("#detail-price").textContent = Flovely.formatPrice(Flovely.priceForSize(product.harga, size));
  }

  function render() {
    root.innerHTML = `
      <div class="detail-layout">
        <div class="detail-image"><img src="${Flovely.escapeHtml(product.gambar)}" alt="${Flovely.escapeHtml(product.nama_produk)}"></div>
        <section class="detail-copy">
          <span class="eyebrow">RANGKAIAN FLovely</span>
          <h1>${Flovely.escapeHtml(product.nama_produk)}</h1>
          <div class="detail-rating">★ ${Number(product.rating).toFixed(1)} <span class="muted">· Ulasan pelanggan Flovely</span></div>
          <div class="detail-price" id="detail-price"></div>
          <p class="detail-description">${Flovely.escapeHtml(product.deskripsi)}</p>
          <p class="stock-note">${product.stok > 0 ? `${product.stok} bouquet tersedia` : "Stok sedang habis"}</p>
          <div class="option-group"><span class="option-label">Pilih warna</span><div class="choice-row">${colorOptions.map((color, index) => `<label class="choice-chip"><input type="radio" name="warna" value="${color}" ${index === 0 ? "checked" : ""}><span>${color}</span></label>`).join("")}</div></div>
          <div class="option-group"><span class="option-label">Pilih ukuran</span><div class="choice-row">
            ${["Small", "Medium", "Large"].map((size, index) => `<label class="choice-chip"><input type="radio" name="ukuran" value="${size}" ${index === 0 ? "checked" : ""}><span>${size}</span></label>`).join("")}
          </div></div>
          <div class="option-group"><span class="option-label">Jumlah</span><div class="qty-row"><div class="quantity-control"><button type="button" data-quantity="-1" aria-label="Kurangi jumlah">−</button><input id="quantity" type="number" min="1" max="${Math.max(1, product.stok)}" value="1" aria-label="Jumlah bouquet"><button type="button" data-quantity="1" aria-label="Tambah jumlah">+</button></div><span class="stock-note">Maksimal ${product.stok}</span></div></div>
          <div class="option-group"><label class="option-label" for="message">Pesan ucapan</label><textarea id="message" class="message-area" maxlength="300" placeholder="Tulis pesan manis untuk kartu ucapan..."></textarea></div>
          <div class="form-message" aria-live="polite"></div>
          <div class="detail-actions"><button class="button button-primary" type="button" data-action="cart" ${product.stok < 1 ? "disabled" : ""}>Tambah ke Keranjang</button><button class="button button-soft" type="button" data-action="buy" ${product.stok < 1 ? "disabled" : ""}>Pesan Sekarang</button><button class="button icon-button" type="button" data-action="wishlist" aria-label="Simpan ke wishlist">♡</button></div>
        </section>
      </div>`;
    root.querySelectorAll('[name="ukuran"]').forEach((input) => input.addEventListener("change", updatePrice));
    updatePrice();
  }

  Flovely.request(`/api/products/${encodeURIComponent(productId)}`)
    .then((data) => {
      product = data;
      render();
    })
    .catch((error) => {
      root.innerHTML = `<div class="empty-state">${Flovely.escapeHtml(error.message)}<p><a href="index.html">Kembali ke halaman utama</a></p></div>`;
    });

  root.addEventListener("click", async (event) => {
    const quantityButton = event.target.closest("[data-quantity]");
    if (quantityButton) {
      const input = root.querySelector("#quantity");
      input.value = Math.max(1, Math.min(product.stok, Number(input.value) + Number(quantityButton.dataset.quantity)));
      return;
    }

    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action || !product) return;
    if (!Flovely.hasSession()) {
      window.location.href = `login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }

    const message = root.querySelector(".form-message");
    const selection = currentSelection();
    if (!Number.isInteger(selection.jumlah) || selection.jumlah < 1 || selection.jumlah > product.stok) {
      message.textContent = "Jumlah melebihi stok yang tersedia.";
      return;
    }

    try {
      if (action === "wishlist") {
        await Flovely.request("/api/wishlist", {
          method: "POST",
          body: JSON.stringify({ product_id: product.id })
        });
        message.textContent = "Bouquet tersimpan di wishlist.";
        message.classList.add("success");
        return;
      }
      await Flovely.request("/api/cart", {
        method: "POST",
        body: JSON.stringify({ product_id: product.id, ...selection })
      });
      if (action === "buy") window.location.href = "checkout.html";
      else {
        message.textContent = "Bouquet berhasil ditambahkan ke keranjang.";
        message.classList.add("success");
      }
    } catch (error) {
      message.textContent = error.message;
      message.classList.remove("success");
    }
  });
})();
