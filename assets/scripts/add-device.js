const miniMenu       = document.getElementById("add-menu");
const addDropdownBtn = document.getElementById("add-dropdown");

// Grab the top-bar ul specifically — this is where device entries are inserted
const sidebarList = document.querySelector("#sidebar ul.top-bar");

let dropdownNumber = 0;

addDropdownBtn.addEventListener("click", (e) => {
    e.stopPropagation();

    const rect = addDropdownBtn.getBoundingClientRect();
    miniMenu.style.left   = rect.left + "px";
    miniMenu.style.bottom = (window.innerHeight - rect.top + 8) + "px";

    miniMenu.classList.toggle("open");
});

miniMenu.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const link = e.target.closest("a");
    if (!link) return;
    addDeviceToViewport(link.dataset.type); // called once — duplicate removed
    miniMenu.classList.remove("open");
});

document.addEventListener("click", () => {
    miniMenu.classList.remove("open");
});

function addDeviceToViewport(deviceType) {
    const type   = deviceType.toLowerCase();
    const counts = NetworkState.deviceCounts;

    let device;
    if      (type === 'pc')     { counts.pc++;     device = createPC    (`PC${counts.pc}`,         `PC-${counts.pc}`);         }
    else if (type === 'switch') { counts.switch++;  device = createSwitch(`Switch${counts.switch}`, `Switch-${counts.switch}`); }
    else if (type === 'router') { counts.router++;  device = createRouter(`Router${counts.router}`, `Router-${counts.router}`); }
    else if (type === 'server') { counts.server++;  device = createPC    (`Server${counts.server}`, `Server-${counts.server}`); }

    if (!device) return;

    // MAC is already set by the factory — log it to confirm
    console.log(`${device.name} created with MAC: ${device.macAddress}`);

    NetworkState.devices.push(device);

    if (window.cy) {
        window.cy.add({
            data: {
                id:     device.id,
                label:  buildNodeLabel(device),
                type:   type,
                status: device.status
            },
            position: getRandomPosition()  // ← random non-overlapping placement
        });
        window.cy.layout({ name: 'grid', animate: true, animationDuration: 300 }).run();
    }

    createSidebarEntry(device);
}

function buildNodeLabel(device) {
    const ip = device.ipAddress ?? 'UNASSIGNED';
    return `${device.name}\n${device.type}\n${ip}`;
}

function refreshNodeLabel(deviceId) {
    const device = NetworkState.devices.find(d => d.id === deviceId);
    if (!device || !window.cy) return;
    const node = window.cy.$(`#${deviceId}`);
    node.data('label',  buildNodeLabel(device));
    node.data('status', device.status);
}

// Sidebar
function createSidebarEntry(device) {
    const li = document.createElement("li");
    li.dataset.deviceId = device.id;

    li.innerHTML = `
        <button onclick="toggleSubMenu(this)" class="dropdown-btn">
            <span class="menu-title">${device.name}</span>
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3">
                <path d="M480-360 280-560h400L480-360Z"/>
            </svg>
        </button>
        <ul class="sub-menu">
            <div>
                <li class="connect-device-item">
                    <button class="dropdown-btn connect-expand-btn" onclick="toggleConnectSubmenu(this, '${device.id}')">
                        <span style="font-size:14px;padding-left:40px;">Connect Device</span>
                        <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#e3e3e3" class="arrow">
                            <path d="M480-360 280-560h400L480-360Z"/>
                        </svg>
                    </button>
                    <ul class="connect-submenu" id="connect-submenu-${device.id}"></ul>
                </li>
                <li><a href="#" onclick="toggleDevicePower('${device.id}'); return false;">Toggle On/Off</a></li>
                <li><a href="#" onclick="deleteDevice('${device.id}'); return false;">Delete</a></li>
            </div>
        </ul>
    `;

    // Insert before the empty dropdown-container li
    const dropdownContainer = sidebarList.querySelector('.dropdown-container');
    sidebarList.insertBefore(li, dropdownContainer);
}

function refreshSidebarDot(deviceId) {
    const li     = document.querySelector(`li[data-device-id="${deviceId}"]`);
    const device = NetworkState.devices.find(d => d.id === deviceId);
    if (!li || !device) return;
    const dot = li.querySelector('.status-dot');
    if (dot) dot.className = `status-dot ${device.status === 'ONLINE' ? 'online' : 'offline'}`;
}

//TogglePower 
function toggleDevicePower(deviceId) {
    const device = NetworkState.devices.find(d => d.id === deviceId);
    if (!device) return;

    device.status = device.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
    syncNodeOfflineState(deviceId);   // ← replaces the old edge/class logic
    if (window.cy) {
        const node  = window.cy.$(`#${deviceId}`);
        const edges = node.connectedEdges();
        node.data('status', device.status);
        if (device.status === 'OFFLINE') {
            edges.data('status', 'OFFLINE');
        } else {
            edges.removeData('status');
        }
    }

    if (device.type === 'Router' && device.status === 'OFFLINE') {
        NetworkState.devices
            .filter(d => d.defaultGateway === device.ipAddress)
            .forEach(d => logEvent(`Warning: ${d.name} lost its default gateway (${device.name} is offline).`));
    }

    if (['PC', 'Laptop', 'Phone'].includes(device.type) && device.status === 'OFFLINE' && device.ipAddress) {
        NetworkState.dhcpCompleted = false;
        logEvent(`DHCP reset: ${device.name} went offline.`);
    }

    refreshSidebarDot(deviceId);
    refreshNodeLabel(deviceId);
    logEvent(`${device.name} is now ${device.status}.`);
}

//Delete Device
function deleteDevice(deviceId) {
    const device = NetworkState.devices.find(d => d.id === deviceId);
    if (!device) return;

    if (device.ipAddress && !device.staticIp) {
        const router = findConnectedRouter(device);
        if (router) releaseIPLease(router.id, device.ipAddress);
    }

    if (device.type === 'Router') {
        const leasePool = NetworkState.ipLeases.find(l => l.routerId === deviceId);
        if (leasePool) leasePool.assignedIps = [];
    }

    NetworkState.connections
        .filter(c => c.sourceDeviceId === deviceId || c.targetDeviceId === deviceId)
        .forEach(conn => {
            const otherId   = conn.sourceDeviceId === deviceId ? conn.targetDeviceId : conn.sourceDeviceId;
            const otherPort = conn.sourceDeviceId === deviceId ? conn.targetPortId   : conn.sourcePortId;
            const other     = NetworkState.devices.find(d => d.id === otherId);
            if (!other) return;
            const port = other.ports.find(p => p.id === otherPort);
            if (port) { port.status = 'EMPTY'; port.connectedTo = null; }
        });

    NetworkState.connections = NetworkState.connections.filter(
        c => c.sourceDeviceId !== deviceId && c.targetDeviceId !== deviceId
    );
    NetworkState.arpTable   = NetworkState.arpTable.filter(e => e.deviceId !== deviceId);
    NetworkState.devices    = NetworkState.devices.filter(d => d.id !== deviceId);

    const type = device.type.toLowerCase();
    if (NetworkState.deviceCounts[type] !== undefined) NetworkState.deviceCounts[type]--;

    if (window.cy) window.cy.$(`#${deviceId}`).remove();

    const li = document.querySelector(`li[data-device-id="${deviceId}"]`);
    if (li) li.remove();

    if (typeof closeDevicePanel === 'function') closeDevicePanel();
    logEvent(`${device.name} deleted.`);
}

function openDevicePanelById(deviceId) {
    const device = NetworkState.devices.find(d => d.id === deviceId);
    if (device && typeof openDevicePanel === 'function') openDevicePanel(device);
}
function refreshNodeLabel(deviceId) {
    if (!window.cy) return;
    // Triggering a data update forces cytoscape-node-html-label to re-render
    const node = window.cy.$(`#${deviceId}`);
    node.data('updated', Date.now()); // dummy update to trigger redraw
}

function toggleConnectSubmenu(btn, sourceDeviceId) {
    const submenu = document.getElementById(`connect-submenu-${sourceDeviceId}`);
    if (!submenu) return;

    const isOpen = submenu.classList.contains('open');
    if (isOpen) {
        submenu.classList.remove('open');
        btn.classList.remove('rotate');
        return;
    }

    const sourceDevice = NetworkState.devices.find(d => d.id === sourceDeviceId);
    if (!sourceDevice) return;

    const validTypes = { PC: ['Switch'], Server: ['Switch'], Switch: ['Router'], Router: ['Router'] };
    const allowedTypes = validTypes[sourceDevice.type] ?? [];

    const targets = NetworkState.devices.filter(d =>
        allowedTypes.includes(d.type) &&
        d.id !== sourceDeviceId &&
        d.status === 'ONLINE' &&
        d.ports.some(p => p.status === 'EMPTY')
    );

    submenu.innerHTML = '';

    if (targets.length === 0) {
        submenu.innerHTML = `
            <li style="padding:6px 12px 6px 20px;font-size:12px;color:#6c7a8a;">
                No available ${allowedTypes.join('/')} on canvas
            </li>`;
    } else {
        targets.forEach(target => {
            const item = document.createElement('li');
            item.innerHTML = `
                <a href="#" style="padding-left:20px;font-size:13px;display:flex;align-items:center;gap:6px;">
                    <span class="status-dot ${target.status === 'ONLINE' ? 'online' : 'offline'}"></span>
                    ${target.name}
                </a>`;

            item.querySelector('a').addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                submenu.classList.remove('open');
                btn.classList.remove('rotate');
                setTimeout(() => {
                    showTargetPortsOnly(sourceDevice, target);
                }, 150);
            });

            submenu.appendChild(item);
        });
    }

    submenu.classList.add('open');
    btn.classList.add('rotate');
}
