//adds an increasing number for dropdown menu
let dropdownNumber=0;

addDropdownBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // prevent document click from closing it immediately
    miniMenu.classList.toggle("open");
});
miniMenu.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const link = e.target.closest("a");
    if (!link) return;

    addDeviceToViewport(link.dataset.type); // <-- changed from createDropdown
    miniMenu.classList.remove("open");
});

document.addEventListener("click", () => {
    miniMenu.classList.remove("open");
});
// Track counts per device type separately
const deviceCounts = { PC: 0, Switch: 0, Router: 0 };

// Called from the mini menu click
function addDeviceToViewport(deviceType) {
    deviceCounts[deviceType]++;
    const id = `${deviceType}${deviceCounts[deviceType]}`;
    const type = deviceType.toLowerCase();

    // Add node to Cytoscape viewport
    if (window.cy) {
        window.cy.add({
            data: { id: id, type: type }
        });
        window.cy.layout({ name: 'grid' }).run(); // re-layout so nodes don't stack
    }

    // Add entry to sidebar
    createDropdown(deviceType, id);
}

// --- Core functions (all at top level) ---
function createDropdown(deviceType = "Device", id = null) {
    const label = id ?? `${deviceType} ${++dropdownNumber}`;

    const li = document.createElement("li");
    li.innerHTML = `
        <button onclick="toggleSubMenu(this)" class="dropdown-btn">
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M423.5-823.5Q400-847 400-880t23.5-56.5Q447-960 480-960t56.5 23.5Q560-913 560-880t-23.5 56.5Q513-800 480-800t-56.5-23.5ZM360-200v-480q-60-5-122-15t-118-25l20-80q78 21 166 30.5t174 9.5q86 0 174-9.5T820-800l20 80q-56 15-118 25t-122 15v480h-80v-240h-80v240h-80ZM291.5-11.5Q280-23 280-40t11.5-28.5Q303-80 320-80t28.5 11.5Q360-57 360-40t-11.5 28.5Q337 0 320 0t-28.5-11.5Zm160 0Q440-23 440-40t11.5-28.5Q463-80 480-80t28.5 11.5Q520-57 520-40t-11.5 28.5Q497 0 480 0t-28.5-11.5Zm160 0Q600-23 600-40t11.5-28.5Q623-80 640-80t28.5 11.5Q680-57 680-40t-11.5 28.5Q657 0 640 0t-28.5-11.5Z"/></svg>
            <span class="menu-title">${label}</span>
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3">
                <path d="M480-360 280-560h400L480-360Z"/>
            </svg>
        </button>
        <ul class="sub-menu">
            <div>
                <li><a href="#">IP Address</a></li>
                <li><a href="#">Rename</a></li>
                <li><a href="#">Delete</a></li>
            </div>
        </ul>
    `;

    sidebarList.insertBefore(li, sidebarList.lastElementChild);
}