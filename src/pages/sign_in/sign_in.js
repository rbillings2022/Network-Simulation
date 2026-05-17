const API_BASE = "http://localhost:3000/api";

      function showMessage(text, type = "error") {
        const el = document.getElementById("auth-message");
        el.textContent = text;
        el.className = `auth-message ${type}`;
      }

      function setLoading(loading) {
        document.getElementById("btn-text").classList.toggle("hidden", loading);
        document.getElementById("btn-spinner").classList.toggle("hidden", !loading);
        document.getElementById("login-btn").disabled = loading;
      }

      async function handleLogin() {
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        if (!email || !password) {
          showMessage("Please fill in all fields.");
          return;
        }

        setLoading(true);

        try {
          const res = await fetch(`${API_BASE}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });

          const data = await res.json();

          if (!res.ok) {
            showMessage(data.error || "Login failed.");
            return;
          }

          // Store user info (use JWT in production)
          sessionStorage.setItem("tracer_user", JSON.stringify(data.user));
          showMessage("Welcome back, " + data.user.name + "!", "success");

          setTimeout(() => {
            window.location.href = "../../../index.html";
          }, 800);
        } catch (err) {
          //Error message if not connected to server
          showMessage("Server is not connected. Please check connection.");
        } finally {
          setLoading(false);
        }
      }

      // Allow Enter key to submit
      document.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleLogin();
      });