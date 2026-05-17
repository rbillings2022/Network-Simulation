const API_BASE = "http://localhost:3000/api";

      // ── Password strength ──────────────────────────────────────────────────
      document.getElementById("password").addEventListener("input", function () {
        const val = this.value;
        const bar = document.getElementById("strength-bar");
        const label = document.getElementById("strength-label");

        //Password Stength Logic
        let score = 0;
        if (val.length >= 8 && /[0-9]/.test(val)) score++;
        if (val.length >= 8 && /[!@#$%^&*()]/.test(val)) score++;
        if (val.length >= 8 && /[A-Z]/.test(val)) score++;
        if (val.length >= 8 && /[a-z]/.test(val)) score++;

        const levels = ["", "weak", "fair", "good", "strong"];
        const labels = ["", "Weak", "Fair", "Good", "Strong"];
        bar.className = `strength-bar ${levels[score]}`;
        label.textContent = score ? labels[score] : "";
      });

      //Helpers
      function showMessage(text, type = "error") {
        const el = document.getElementById("auth-message");
        el.textContent = text;
        el.className = `auth-message ${type}`;
      }

      function setLoading(loading) {
        document.getElementById("btn-text").classList.toggle("hidden", loading);
        document.getElementById("btn-spinner").classList.toggle("hidden", !loading);
        document.getElementById("register-btn").disabled = loading;
      }

      // ── Register handler ───────────────────────────────────────────────────
      async function handleRegister() {
        const name     = document.getElementById("name").value.trim();
        const email    = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirm  = document.getElementById("confirm").value;

        if (!name || !email || !password || !confirm) {
          showMessage("Please fill in all fields.");
          return;
        }
        if (password.length < 8) {
          showMessage("Password must be at least 8 characters.");
          return;
        }
        if (password !== confirm) {
          showMessage("Passwords do not match.");
          return;
        }

        setLoading(true);

        //Shipping the credidentials
        try {
          const res = await fetch(`${API_BASE}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password }),
          });

          const data = await res.json();

          if (!res.ok) {
            showMessage(data.error || "Registration failed.");
            return;
          }

          //When log_in is successful redirect to the sign_in page
          showMessage("Account created! Redirecting to sign in…", "success");
          setTimeout(() => {
            window.location.href = "../sign_in/sign_in.html";
          }, 1200);
        } catch (err) {
          showMessage("Could not reach server. Is it running?");
        } finally {
          setLoading(false);
        }
      }

      document.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleRegister();
      });