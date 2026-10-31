(function () {
  const TOKEN_KEY = "flovely_access_token";
  const REFRESH_KEY = "flovely_refresh_token";

  async function request(url, options = {}) {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch {
      throw new Error("Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.");
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && token) clearSession();
      throw new Error(data.error || "Terjadi kesalahan. Silakan coba lagi.");
    }
    return data;
  }

  function saveSession(session) {
    if (!session || !session.access_token) return;
    localStorage.setItem(TOKEN_KEY, session.access_token);
    if (session.refresh_token) localStorage.setItem(REFRESH_KEY, session.refresh_token);
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }

  function hasSession() {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  }

  function requireSession() {
    if (!hasSession()) {
      window.location.href = `/login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
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
    request,
    saveSession,
    clearSession,
    hasSession,
    requireSession,
    priceForSize,
    formatPrice,
    escapeHtml
  };
})();
