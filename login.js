(function () {
  const form = document.getElementById("login-form");
  const message = form.querySelector(".form-message");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    message.textContent = "Memeriksa akun...";
    try {
      const result = await Flovely.request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries()))
      });
      Flovely.saveSession(result.session);
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "index.html";
    } catch (error) {
      message.textContent = error.message;
      button.disabled = false;
    }
  });
})();
