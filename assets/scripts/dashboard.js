document.addEventListener("dblclick", function (e) {
    if (e.target.classList.contains("menu-title")) makeEditable(e.target);
});

function makeEditable(span) {
    const input = document.createElement("input");
    input.type  = "text";
    input.value = span.textContent;
    input.classList.add("edit-input");
    span.replaceWith(input);
    input.select();
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") saveEdit(input); });
    input.addEventListener("blur",    ()  => saveEdit(input));
}

function saveEdit(input) {
    const newSpan = document.createElement("span");
    newSpan.classList.add("menu-title");
    newSpan.textContent = input.value.trim() || "Untitled Menu";
    input.replaceWith(newSpan);
}

function toggleSidebar() {
    sidebar.classList.toggle('close');
    toggleButton.classList.toggle('rotate');
    Array.from(sidebar.getElementsByClassName('show')).forEach(ul => {
        ul.classList.remove('show');
        ul.previousElementSibling.classList.remove('rotate');
    });
}

function toggleSubMenu(button) {
    button.nextElementSibling.classList.toggle('show');
    button.classList.toggle('rotate');
    if (sidebar.classList.contains('close')) {
        sidebar.classList.toggle('close');
        toggleButton.classList.toggle('rotate');
    }
}

// ─── dashboard.js ────────────────────────────────────────────────────────────
// Handles Save and Load topology features for the Tracer canvas.
// Depends on: window.cy (cytoscape), NetworkState (networking-objects.js)
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:3000/api";

// Helpers
function getCurrentUser() {
    try {
        return JSON.parse(sessionStorage.getItem("tracer_user"));
    } catch {
        return null;
    }
}

function showToast(message, type = "success") {
    const existing = document.getElementById("tracer-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "tracer-toast";
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 32px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === "error" ? "#e05c5c" : "#2a7ea1"};
        color: #f4f4f4;
        padding: 10px 22px;
        border-radius: 10px;
        font-family: Montserrat, sans-serif;
        font-size: 14px;
        z-index: 9999;
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        transition: opacity 0.4s;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

