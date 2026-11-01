(function () {
  const root = document.getElementById("site-header");
  if (!root) return;

  const activePage = window.location.pathname.split("/").pop() || "index.html";
  const navLink = (href, label, icon) => `<a class="nav-link${activePage === href ? " active" : ""}" href="${href}"><span aria-hidden="true">${icon}</span>${label}</a>`;
  const signedInLinks = Flovely.hasSession()
    ? `${navLink("orders.html", "Pesanan", "⌁")}${navLink("profile.html", "Profil", "◯")}`
    : "";
  root.innerHTML = `
    <header class="site-header">
      <div class="wrap header-inner">
        <a class="brand" href="index.html" aria-label="Flovely, ke halaman home">flovely<span>.</span></a>
        <button class="menu-toggle" type="button" aria-label="Buka navigasi" aria-expanded="false">☰</button>
        <nav class="main-nav" aria-label="Navigasi utama">
          ${navLink("index.html", "Home", "⌂")}
          ${navLink("wishlist.html", "Wishlist", "♡")}
          ${signedInLinks}
          <a class="nav-cart${activePage === "cart.html" ? " active" : ""}" href="cart.html"><span aria-hidden="true">♧</span> Keranjang</a>
        </nav>
      </div>
    </header>`;

  const toggle = root.querySelector(".menu-toggle");
  const nav = root.querySelector(".main-nav");
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
})();
