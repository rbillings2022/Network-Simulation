// ============================================================
// connection-ui.js — Two-step port connection UI flow
// ============================================================

// State
NetworkState.connectionMode  = false;
NetworkState.pendingSource   = null; // { device, portId }

// Toast
function showToast(message, isError = true) {
    const existing = document.getElementById('conn-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'conn-toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 32px;
        left: 50%;
        transform: translateX(-50%);
        background: ${isError ? '#6b2a2a' : '#1e5c38'};
        color: #f4f4f4;
        padding: 10px 20px;
        border-radius: 10px;
        font-family: Montserrat, sans-serif;
        font-size: 13px;
        z-index: 999;
        border: 1px solid ${isError ? '#a33' : '#2a7a50'};
        transition: opacity 300ms;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Reset connection mode
function resetConnectionMode() {
    NetworkState.connectionMode = false;
    NetworkState.pendingSource  = null;
    // Remove any port-picker overlays
    document.querySelectorAll('.port-picker').forEach(el => el.remove());
    // Remove canvas highlight class
    document.querySelectorAll('.cy-connecting').forEach(el => el.classList.remove('cy-connecting'));
    if (window.cy) window.cy.nodes().removeClass('connecting-source');
}

// User clicks "Connect" on a device card
function startConnection(deviceId) {
    const device = NetworkState.devices.find(d => d.id === deviceId);
    if (!device) return;

    if (device.status === 'OFFLINE') {
        showToast(`${device.name} is offline — cannot connect.`);
        return;
    }

    resetConnectionMode(); // clear any previous attempt

    NetworkState.connectionMode = true;
    showPortPicker(device, 'source');
}

// Port Picker UI
function showPortPicker(device, mode) {
    document.querySelectorAll('.port-picker').forEach(el => el.remove());

    const emptyPorts = device.ports.filter(p => p.status === 'EMPTY');

    const picker = document.createElement('div');
    picker.className = 'port-picker';
    picker.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1e3a52;
        border: 1px solid #4c5b79;
        border-radius: 12px;
        padding: 20px;
        z-index: 300;
        width: 280px;
        font-family: Montserrat, sans-serif;
        color: #f4f4f4;
        font-size: 13px;
    `;

    const title = mode === 'source'
        ? `Select source port on <strong>${device.name}</strong>`
        : `Select target port on <strong>${device.name}</strong>`;

    picker.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <span>${title}</span>
            <button onclick="resetConnectionMode()"
                style="background:none;border:none;color:#949baf;cursor:pointer;font-size:18px;">✕</button>
        </div>
        <div id="port-list"></div>
    `;

    const portList = picker.querySelector('#port-list');

    if (emptyPorts.length === 0) {
        portList.innerHTML = `<div style="color:#949baf;padding:8px 0;">No available ports</div>`;
    } else {
        emptyPorts.forEach(port => {
            const btn = document.createElement('button');
            btn.textContent = port.interfaceName;
            btn.style.cssText = `
                display: block;
                width: 100%;
                margin-bottom: 8px;
                padding: 10px 12px;
                background: #172738;
                border: 1px solid #4c5b79;
                border-radius: 8px;
                color: #f4f4f4;
                font-family: Montserrat, sans-serif;
                font-size: 13px;
                text-align: left;
                cursor: pointer;
                transition: background 150ms;
            `;
            btn.onmouseenter = () => btn.style.background = '#2a7ea1';
            btn.onmouseleave = () => btn.style.background = '#172738';

            btn.addEventListener('click', () => {
                if (mode === 'source') {
                    onSourcePortSelected(device, port.id);
                } else {
                    onTargetPortSelected(device, port.id);
                }
            });

            portList.appendChild(btn);
        });
    }

    document.body.appendChild(picker);
}

// Source port chosen
function onSourcePortSelected(device, portId) {
    NetworkState.pendingSource = { device, portId };
    document.querySelectorAll('.port-picker').forEach(el => el.remove());

    // Highlight source node on canvas
    if (window.cy) {
        window.cy.$(`#${device.id}`).addClass('connecting-source');
    }

    showToast(`${device.name} → ${getPortName(device, portId)} selected. Now click a target device.`, false);

    // Listen for next device click
    enableTargetSelection();
}

function getPortName(device, portId) {
    const port = device.ports.find(p => p.id === portId);
    return port ? port.interfaceName : portId;
}

// Enable target selection
function enableTargetSelection() {
    // Canvas click
    if (window.cy) {
        window.cy.once('tap', 'node', function (evt) {
            if (!NetworkState.connectionMode) return;
            const targetId = evt.target.data('id');
            const target   = NetworkState.devices.find(d => d.id === targetId);
            if (!target) return;

            // Prevent clicking the same device
            if (target.id === NetworkState.pendingSource.device.id) {
                showToast('Cannot connect a device to itself.');
                enableTargetSelection(); // re-arm
                return;
            }

            onTargetDeviceSelected(target);
        });
    }
}

// Target device clicked
function onTargetDeviceSelected(targetDevice) {
    if (targetDevice.status === 'OFFLINE') {
        showToast(`${targetDevice.name} is offline — cannot connect.`);
        resetConnectionMode();
        return;
    }

    const sourceDevice = NetworkState.pendingSource.device;
    const sourcePortId = NetworkState.pendingSource.portId;

    // Filter target's empty ports that are valid candidates
    const candidatePorts = targetDevice.ports.filter(p => {
        if (p.status !== 'EMPTY') return false;
        const check = canConnect(sourceDevice, sourcePortId, targetDevice, p.id);
        return check.valid;
    });

    if (candidatePorts.length === 0) {
        // Run canConnect with the first port to get a reason string for the toast
        const firstPort = targetDevice.ports[0];
        const check     = firstPort
            ? canConnect(sourceDevice, sourcePortId, targetDevice, firstPort.id)
            : { reason: 'No compatible ports available.' };
        showToast(check.reason);
        resetConnectionMode();
        return;
    }

    // Show target port picker
    showFilteredPortPicker(targetDevice, candidatePorts);
}

// Like showPortPicker but only shows pre-validated ports
function showFilteredPortPicker(device, ports) {
    document.querySelectorAll('.port-picker').forEach(el => el.remove());

    const picker = document.createElement('div');
    picker.className = 'port-picker';
    picker.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1e3a52;
        border: 1px solid #4c5b79;
        border-radius: 12px;
        padding: 20px;
        z-index: 300;
        width: 280px;
        font-family: Montserrat, sans-serif;
        color: #f4f4f4;
        font-size: 13px;
    `;

    picker.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <span>Select target port on <strong>${device.name}</strong></span>
            <button onclick="resetConnectionMode()"
                style="background:none;border:none;color:#949baf;cursor:pointer;font-size:18px;">✕</button>
        </div>
        <div id="port-list"></div>
    `;

    const portList = picker.querySelector('#port-list');

    ports.forEach(port => {
        const btn = document.createElement('button');
        btn.textContent = port.interfaceName;
        btn.style.cssText = `
            display: block;
            width: 100%;
            margin-bottom: 8px;
            padding: 10px 12px;
            background: #172738;
            border: 1px solid #4c5b79;
            border-radius: 8px;
            color: #f4f4f4;
            font-family: Montserrat, sans-serif;
            font-size: 13px;
            text-align: left;
            cursor: pointer;
            transition: background 150ms;
        `;
        btn.onmouseenter = () => btn.style.background = '#2a7ea1';
        btn.onmouseleave = () => btn.style.background = '#172738';
        btn.addEventListener('click', () => onTargetPortSelected(device, port.id));
        portList.appendChild(btn);
    });

    document.body.appendChild(picker);
}

// Target port chosen
function onTargetPortSelected(targetDevice, targetPortId) {
    const { device: sourceDevice, portId: sourcePortId } = NetworkState.pendingSource;

    const result = canConnect(sourceDevice, sourcePortId, targetDevice, targetPortId);

    if (!result.valid) {
        showToast(result.reason);
        resetConnectionMode();
        return;
    }

    // Create the Connection object and update both ports atomically
    const connection = createConnection(sourceDevice, sourcePortId, targetDevice, targetPortId);

    if (!connection) {
        showToast('Connection failed — see console for details.');
        resetConnectionMode();
        return;
    }

    // Add edge to Cytoscape
    if (window.cy) {
        window.cy.add({
            data: {
                id:     connection.id,
                source: sourceDevice.id,
                target: targetDevice.id
            }
        });
        window.cy.nodes().removeClass('connecting-source');
    }

    // Trigger DHCP if an end device just connected to a router subnet
    const endDeviceTypes = ['PC', 'Laptop', 'Phone', 'Server'];
    [sourceDevice, targetDevice].forEach(device => {
        if (endDeviceTypes.includes(device.type) && !device.ipAddress && !device.staticIp) {
            assignIPviaDHCP(device);
            refreshNodeLabel(device.id);
        }
    });

    showToast(
        `Connected: ${sourceDevice.name} (${getPortName(sourceDevice, sourcePortId)}) ↔ ${targetDevice.name} (${getPortName(targetDevice, targetPortId)})`,
        false
    );

    // Refresh both device panels if open
    [sourceDevice, targetDevice].forEach(d => {
        if (typeof openDevicePanel === 'function') {
            const panel = document.getElementById('device-panel');
            if (panel && panel.style.display !== 'none') openDevicePanel(d);
        }
    });

    resetConnectionMode();
}

// Sidebar "Connect Device" flow
const VALID_TARGETS = {
    'PC':     ['Switch'],
    'Server': ['Switch'],
    'Switch': ['Router'],
    'Router': ['Router']
};

function openConnectMenu(sourceDeviceId) {
    const sourceDevice = NetworkState.devices.find(d => d.id === sourceDeviceId);
    if (!sourceDevice) return;

    if (sourceDevice.status === 'OFFLINE') {
        showToast(`${sourceDevice.name} is offline — cannot connect.`);
        return;
    }

    // Check source has empty ports
    const sourceEmptyPorts = sourceDevice.ports.filter(p => p.status === 'EMPTY');
    if (sourceEmptyPorts.length === 0) {
        showToast(`${sourceDevice.name} has no available ports.`);
        return;
    }

    const validTypes = VALID_TARGETS[sourceDevice.type];
    if (!validTypes) {
        showToast(`${sourceDevice.type} cannot initiate connections from this menu.`);
        return;
    }

    // Find all valid target devices on canvas
    const targets = NetworkState.devices.filter(d =>
        validTypes.includes(d.type) &&
        d.id !== sourceDevice.id &&
        d.status === 'ONLINE' &&
        d.ports.some(p => p.status === 'EMPTY')
    );

    if (targets.length === 0) {
        showToast(`No available ${validTypes.join(' or ')} devices on canvas.`);
        return;
    }

    _showTargetDevicePicker(sourceDevice, targets);
}

// Pick target device
function _showTargetDevicePicker(sourceDevice, targets) {
    document.querySelectorAll('.port-picker').forEach(el => el.remove());

    const picker = _buildPickerShell(`Connect <strong>${sourceDevice.name}</strong> to:`);
    const portList = picker.querySelector('#port-list');

    targets.forEach(target => {
        const btn = _buildPortButton(`${target.name} (${target.type})`, () => {
            picker.remove();
            _showSourcePortPicker(sourceDevice, target);
        });
        portList.appendChild(btn);
    });

    document.body.appendChild(picker);
}

// Pick source port
function _showSourcePortPicker(sourceDevice, targetDevice) {
    document.querySelectorAll('.port-picker').forEach(el => el.remove());

    const emptyPorts = sourceDevice.ports.filter(p => p.status === 'EMPTY');
    
    // Temporary debug
    console.log('Source ports:', sourceDevice.ports);
    console.log('Empty ports:', emptyPorts);

    const picker = _buildPickerShell(`Port on <strong>${sourceDevice.name}</strong>:`);
    const portList = picker.querySelector('#port-list');

    if (emptyPorts.length === 0) {
        portList.innerHTML = `<div style="color:#949baf;padding:8px 0;">No available ports</div>`;
    } else {
        let anyRendered = false;
        emptyPorts.forEach(port => {
            const anyValid = targetDevice.ports.some(tp =>
                tp.status === 'EMPTY' && canConnect(sourceDevice, port.id, targetDevice, tp.id).valid
            );
            console.log(`Port ${port.id} anyValid:`, anyValid); // debug
            if (!anyValid) return;

            anyRendered = true;
            const btn = _buildPortButton(port.interfaceName, () => {
                NetworkState.pendingSource = { device: sourceDevice, portId: port.id };
                picker.remove();
                _showTargetPortPicker(sourceDevice, port.id, targetDevice);
            });
            portList.appendChild(btn);
        });

        if (!anyRendered) {
            portList.innerHTML = `<div style="color:#e57373;padding:8px 0;font-size:12px;">No compatible ports available.</div>`;
        }
    }

    document.body.appendChild(picker);
}

// Pick target port
// Sidebar target-port-only picker
function showTargetPortsOnly(sourceDevice, targetDevice) {
    // Auto-select first empty source port
    const sourcePort = sourceDevice.ports.find(p => p.status === 'EMPTY');
    if (!sourcePort) {
        showToast(`${sourceDevice.name} has no available ports.`);
        return;
    }

    const candidatePorts = targetDevice.ports.filter(p => {
        if (p.status !== 'EMPTY') return false;
        if (targetDevice.type === 'Switch' && 
            p.interfaceName === 'FastEthernet0/0' && 
            sourceDevice.type !== 'Router') return false;

        return canConnect(sourceDevice, sourcePort.id, targetDevice, p.id).valid;
    });

    if (candidatePorts.length === 0) {
        showToast('No compatible ports available on ' + targetDevice.name);
        return;
    }

    // Find the source device's submenu in the sidebar and inject port options there
    const sourceLi   = document.querySelector(`li[data-device-id="${sourceDevice.id}"]`);
    const subMenuDiv = sourceLi?.querySelector('.sub-menu div');
    if (!subMenuDiv) return;

    // Remove any previous port injection
    subMenuDiv.querySelectorAll('.injected-port').forEach(el => el.remove());

    // PORT Options Menu Inject a header
    const header = document.createElement('li');
    header.className = 'injected-port';
    header.innerHTML = `<span style="
        display:block;
        padding:4px 10px 2px 30px;
        font-size:15px;
        color: #2a7ea1;
        border-top:2px solid #4c5b79;
        margin-top:4px;
    ">Ports on ${targetDevice.name}:</span>`;
    subMenuDiv.appendChild(header);

    // Inject one clickable item per available port
    candidatePorts.forEach(port => {
        const portLi = document.createElement('li');
        portLi.className = 'injected-port';
        portLi.innerHTML = `
            <a href="#" style="
            padding-left:30px;
            font-size:13px;
            color: #4caf50;
            border:2px solid #4c5b79;">
                ○ ${port.interfaceName}
            </a>`;

        portLi.querySelector('a').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Clean up injected items
            subMenuDiv.querySelectorAll('.injected-port').forEach(el => el.remove());

            NetworkState.pendingSource = { device: sourceDevice, portId: sourcePort.id };
            _finaliseConnection(sourceDevice, sourcePort.id, targetDevice, port.id);
        });

        subMenuDiv.appendChild(portLi);
    });

    // Add a cancel option
    const cancelLi = document.createElement('li');
    cancelLi.className = 'injected-port';
    cancelLi.innerHTML = `<a href="#" style="padding-left:30px;font-size:12px;color:#6c7a8a;">✕ Cancel</a>`;
    cancelLi.querySelector('a').addEventListener('click', (e) => {
        e.preventDefault();
        subMenuDiv.querySelectorAll('.injected-port').forEach(el => el.remove());
    });
    subMenuDiv.appendChild(cancelLi);
}

// Finalise and draw edge
function _finaliseConnection(sourceDevice, sourcePortId, targetDevice, targetPortId) {
    const result = canConnect(sourceDevice, sourcePortId, targetDevice, targetPortId);
    if (!result.valid) {
        showToast(result.reason);
        resetConnectionMode();
        return;
    }

    const connection = createConnection(sourceDevice, sourcePortId, targetDevice, targetPortId);
    if (!connection) {
        showToast('Connection failed — see console.');
        return;
    }

    // Draw edge on canvas
    if (window.cy) {
        // Remove any existing edge between these two nodes first
        const existing = window.cy.edges(`[source="${sourceDevice.id}"][target="${targetDevice.id}"], [source="${targetDevice.id}"][target="${sourceDevice.id}"]`);
        if (existing.length === 0) {
            window.cy.add({
                group: 'edges',
                data: {
                    id:         connection.id,
                    source:     sourceDevice.id,
                    target:     targetDevice.id,
                    hoverLabel: `${getPortName(sourceDevice, sourcePortId)} ↔ ${getPortName(targetDevice, targetPortId)}`
                }
            });
        }
    }

    // Trigger DHCP for end devices entering a router subnet
    const endTypes = ['PC', 'Server', 'Laptop', 'Phone'];
    [sourceDevice, targetDevice].forEach(d => {
        if (endTypes.includes(d.type) && !d.ipAddress && !d.staticIp) {
            assignIPviaDHCP(d);
        }
    });

    // Force HTML label re-render on both nodes so ports show green
    _forceNodeRedraw(sourceDevice.id);
    _forceNodeRedraw(targetDevice.id);

    showToast(
        `Connected: ${sourceDevice.name} (${getPortName(sourceDevice, sourcePortId)}) ↔ ${targetDevice.name} (${getPortName(targetDevice, targetPortId)})`,
        false
    );

    resetConnectionMode();
}
function _forceNodeRedraw(deviceId) {
    if (!window.cy) return;
    const node = window.cy.$(`#${deviceId}`);
    if (node.empty()) return;
    node.data('updated', Date.now());
    setTimeout(() => node.data('updated', Date.now() + 1), 50);
}
