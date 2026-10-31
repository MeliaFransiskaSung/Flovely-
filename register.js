(function () {
  const form = document.getElementById("register-form");
  const message = form.querySelector(".form-message");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const password = formData.get("password");
    if (password !== formData.get("confirm_password")) {
      message.textContent = "Konfirmasi password belum sama.";
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    message.textContent = "Membuat akun...";
    try {
      const result = await Flovely.request("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          nama: formData.get("nama"),
          email: formData.get("email"),
          password
        })
      });
      if (result.session) {
        Flovely.saveSession(result.session);
        window.location.href = "index.html";
        return;
      }
      message.textContent = result.message;
      message.classList.add("success");
      button.disabled = false;
    } catch (error) {
      message.textContent = error.message;
      button.disabled = false;
    }
  });
})();
