(function () {
  const root = document.getElementById("profile-root");
  if (!Flovely.requireSession()) return;

  Flovely.request("/api/profile").then((profile) => {
    root.innerHTML = `
      <div class="profile-layout">
        <section class="panel"><h2>Informasi akun</h2><form id="profile-form" class="profile-form">
          <label class="form-stack">Nama<input name="nama" maxlength="100" required value="${Flovely.escapeHtml(profile.nama)}"></label>
          <label class="form-stack">Email<input type="email" disabled value="${Flovely.escapeHtml(profile.email)}"></label>
          <label class="form-stack">Nomor HP<input name="nomor_hp" type="tel" maxlength="30" required value="${Flovely.escapeHtml(profile.nomor_hp || "")}" placeholder="08xxxxxxxxxx"></label>
          <label class="form-stack">Alamat<textarea name="alamat" maxlength="500" required placeholder="Alamat lengkap">${Flovely.escapeHtml(profile.alamat || "")}</textarea></label>
          <div class="form-message" aria-live="polite"></div><button class="button button-primary" type="submit">Simpan perubahan</button>
        </form></section>
        <aside class="profile-links"><a href="orders.html">Pesanan saya <span>→</span></a><a href="wishlist.html">Wishlist <span>→</span></a><a href="cart.html">Keranjang <span>→</span></a><button type="button" id="logout-button">Logout <span>↗</span></button></aside>
      </div>`;

    const form = root.querySelector("#profile-form");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const message = form.querySelector(".form-message");
      button.disabled = true;
      try {
        await Flovely.request("/api/profile", {
          method: "PUT",
          body: JSON.stringify(Object.fromEntries(new FormData(form).entries()))
        });
        message.textContent = "Profil berhasil diperbarui.";
        message.classList.add("success");
      } catch (error) {
        message.textContent = error.message;
        message.classList.remove("success");
      } finally {
        button.disabled = false;
      }
    });

    root.querySelector("#logout-button").addEventListener("click", async () => {
      try {
        await Flovely.request("/api/auth/logout", { method: "POST" });
      } catch {
        // Token lokal tetap dihapus saat sesi server sudah berakhir.
      } finally {
        Flovely.clearSession();
        window.location.href = "index.html";
      }
    });
  }).catch((error) => {
    root.innerHTML = `<div class="empty-state">${Flovely.escapeHtml(error.message)}<p><a href="login.html">Login kembali</a></p></div>`;
  });
})();
