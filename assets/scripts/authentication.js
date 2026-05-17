// User Profile

function loadUserProfile() {
    const user = getCurrentUser();

    const avatarEl = document.getElementById("user-avatar");
    const nameEl   = document.getElementById("user-name");

    //FORCED LOG-IN handler
    if (!user) {
        // Not logged in — redirect to sign in
        //window.location.href = "src/pages/sign_in/sign_in.html";
        return;
    }

    // First letter of their name as the avatar initial
    const initial = user.name ? user.name.charAt(0).toUpperCase() : "?";
    avatarEl.textContent = initial;
    nameEl.textContent   = user.name;
}

// Logout

function handleLogout() {
    sessionStorage.removeItem("tracer_user");
    // Optionally notify the server (fire-and-forget)
    fetch(`${API_BASE}/logout`, { method: "POST" }).catch(() => {});
}

// Serialization 

function serializeCanvas() {
    const elements = window.cy.elements().map(el => ({
        group:    el.isNode() ? "nodes" : "edges",
        data:     el.data(),
        position: el.isNode() ? el.position() : undefined,
        classes:  el.classes().join(" ")
    }));

    return {
        devices:  JSON.parse(JSON.stringify(NetworkState.devices)),
        elements
    };
}

function deserializeCanvas(state) {
    if (!state || !state.devices || !state.elements) {
        showToast("Invalid topology data.", "error");
        return;
    }

    // Clear existing state
    NetworkState.devices.length = 0;
    window.cy.elements().remove();

    if (typeof rebuildSidebarDeviceList === "function") {
        rebuildSidebarDeviceList();
    }

    // Restore devices
    state.devices.forEach(d => NetworkState.devices.push(d));

    // Restore cytoscape elements 
    const nodes = state.elements.filter(e => e.group === "nodes");
    const edges = state.elements.filter(e => e.group === "edges");

    nodes.forEach(el => {
        window.cy.add({ group: "nodes", data: el.data, position: el.position });
    });

    edges.forEach(el => {
        const srcExists = window.cy.$(`#${el.data.source}`).length > 0;
        const tgtExists = window.cy.$(`#${el.data.target}`).length > 0;
        if (srcExists && tgtExists) {
            window.cy.add({ group: "edges", data: el.data });
        }
    });
    
    state.devices.forEach(d => {
        if (typeof refreshNodeLabel === "function")     refreshNodeLabel(d.id);
        if (typeof syncNodeOfflineState === "function") syncNodeOfflineState(d.id);
    });

    if (typeof addDeviceToSidebar === "function") {
        state.devices.forEach(d => addDeviceToSidebar(d));
    }

    window.cy.fit(undefined, 40);
}

// Save Modal

function openSaveModal() {
    document.getElementById("save-name-input").value = "";
    document.getElementById("save-modal-error").textContent = "";
    document.getElementById("save-modal").classList.add("open");
    setTimeout(() => document.getElementById("save-name-input").focus(), 50);
}

function closeSaveModal() {
    document.getElementById("save-modal").classList.remove("open");
}

async function handleSaveConfirm() {
    const name    = document.getElementById("save-name-input").value.trim();
    const errorEl = document.getElementById("save-modal-error");

    if (!name) {
        errorEl.textContent = "Please enter a name for this topology.";
        return;
    }

    const user = getCurrentUser();
    if (!user) {
        errorEl.textContent = "You must be logged in to save.";
        return;
    }

    if (!window.cy || window.cy.nodes().length === 0) {
        errorEl.textContent = "Canvas is empty — add some devices first.";
        return;
    }

    const btn = document.getElementById("save-confirm-btn");
    btn.textContent = "Saving…";
    btn.disabled    = true;

    try {
        const res = await fetch(`${API_BASE}/topologies`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ userId: user.id, name, state: serializeCanvas() })
        });

        const data = await res.json();

        if (!res.ok) {
            errorEl.textContent = data.error || "Save failed.";
            return;
        }

        closeSaveModal();
        showToast(`"${name}" save successful!`);

    } catch {
        errorEl.textContent = "Could not reach server.";
    } finally {
        btn.textContent = "Save";
        btn.disabled    = false;
    }
}

// Load Modal

async function openLoadModal() {
    document.getElementById("load-modal").classList.add("open");

    const user   = getCurrentUser();
    const listEl = document.getElementById("topology-list");

    if (!user) {
        listEl.innerHTML = `<p class="modal-error">You must be logged in to load saves.</p>`;
        return;
    }

    listEl.innerHTML = `<p class="modal-hint">Loading your topologies…</p>`;

    try {
        // Fetches ONLY topologies belonging to the logged-in user's ID
        const res  = await fetch(`${API_BASE}/topologies/${user.id}`);
        const data = await res.json();

        if (!res.ok || !data.topologies) {
            listEl.innerHTML = `<p class="modal-error">Failed to load topologies.</p>`;
            return;
        }

        if (data.topologies.length === 0) {
            listEl.innerHTML = `<p class="modal-hint">No saved topologies yet.</p>`;
            return;
        }

        listEl.innerHTML = "";
        data.topologies.forEach(topo => {
            const date = new Date(topo.created_at).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric"
            });

            const item = document.createElement("div");
            item.className = "topology-item";
            item.innerHTML = `
                <div>
                    <div class="topology-item-name">${escapeHtml(topo.name)}</div>
                    <span>${date}</span>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="#949baf">
                    <path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"/>
                </svg>
            `;
            item.addEventListener("click", () => handleLoadTopology(topo.id, topo.name));
            listEl.appendChild(item);
        });

    } catch {
        listEl.innerHTML = `<p class="modal-error">Could not reach server.</p>`;
    }
}

function closeLoadModal() {
    document.getElementById("load-modal").classList.remove("open");
}

async function handleLoadTopology(topoId, topoName) {
    closeLoadModal();

    try {
        const res  = await fetch(`${API_BASE}/topologies/load/${topoId}`);
        const data = await res.json();

        if (!res.ok || !data.state) {
            showToast("Failed to load topology.", "error");
            return;
        }

        deserializeCanvas(data.state);

        // Confirmation message
        showToast(`'${topoName}' Network Loaded`);

    } catch {
        showToast("Could not reach server.", "error");
    }
}

// Wire everything up after DOM loads
document.addEventListener("DOMContentLoaded", () => {

    // Populate user profile in sidebar
    loadUserProfile();

    // Toolbar buttons
    document.getElementById("save-btn").addEventListener("click", openSaveModal);
    document.getElementById("load-btn").addEventListener("click", openLoadModal);

    // Save modal
    document.getElementById("save-confirm-btn").addEventListener("click", handleSaveConfirm);
    document.getElementById("save-cancel-btn").addEventListener("click", closeSaveModal);
    document.getElementById("save-modal").addEventListener("click", e => {
        if (e.target === document.getElementById("save-modal")) closeSaveModal();
    });
    document.getElementById("save-name-input").addEventListener("keydown", e => {
        if (e.key === "Enter") handleSaveConfirm();
    });

    // Load modal
    document.getElementById("load-cancel-btn").addEventListener("click", closeLoadModal);
    document.getElementById("load-modal").addEventListener("click", e => {
        if (e.target === document.getElementById("load-modal")) closeLoadModal();
    });

    // Logout 
    const logoutLink = document.getElementById("logout-link");
    if (logoutLink) {
        logoutLink.addEventListener("click", handleLogout);
    }
});
