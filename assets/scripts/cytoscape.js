document.addEventListener("DOMContentLoaded", function () {

    const cy = cytoscape({
        container: document.getElementById('cytoscape'),
        elements: [],
        userZoomingEnabled:    true,
        userPanningEnabled:    true,
        boxSelectionEnabled:   false,

        style: [
            // ── Base node ─────────────────────────────────────
            {
                selector: 'node',
                style: {
                    'shape':'round-rectangle',
                    'background-color': '#1e3a52',
                    'background-image': 'none',
                    'border-width': 2,
                    'border-color':'#4c5b79',
                    'label': '',       // HTML label handles this
                    'width':   200,
                    'height':  300,
                }
            },

            // ── Device type border colors ─────────────────────
            {
                selector: 'node[type="pc"]',
                style: {
                    'border-color':       '#2a7ea1',
                    'background-image':   'assets/icons/computer.png',
                    'background-fit':     'none',
                    'background-width':   '30px',
                    'background-height':  '30px',
                    'background-position-x': '50%',
                    'background-position-y': '12px',
                    'background-opacity': 0.15,
                    'height': 300
                }
            },
            {
                selector: 'node[type="switch"]',
                style: {
                    'border-color':       '#3a9a6e',
                    'background-image':   'assets/icons/switch.png',
                    'background-fit':     'none',
                    'background-width':   '30px',
                    'background-height':  '30px',
                    'background-position-x': '50%',
                    'background-position-y': '12px',
                    'background-opacity': 0.15,
                    'height': 350
                }
            },
            {
                selector: 'node[type="router"]',
                style: {
                    'border-color':       '#a17a2a',
                    'background-image':   'assets/icons/router.png',
                    'background-fit':     'none',
                    'background-width':   '30px',
                    'background-height':  '30px',
                    'background-position-x': '50%',
                    'background-position-y': '12px',
                    'background-opacity': 0.15,
                    'height': 460
                }
            },
            {
                selector: 'node[type="server"]',
                style: {
                    'border-color':       '#8a3aa1',
                    'background-image':   'assets/icons/server.png',
                    'background-fit':     'none',
                    'background-width':   '30px',
                    'background-height':  '30px',
                    'background-position-x': '50%',
                    'background-position-y': '12px',
                    'background-opacity': 0.15,
                    'height': 220
                }
            },

            // ── OFFLINE state ─────────────────────────────────
            {
                selector: 'node.offline',
                style: {
                    'background-color': '#172738',
                    'border-color':     '#3a3a4a',
                    'opacity':          0.5
                }
            },

            // ── Connection mode: source highlight ─────────────
            {
                selector: 'node.connecting-source',
                style: {
                    'border-color':  '#2a7ea1',
                    'border-width':  4,
                    'shadow-blur':   12,
                    'shadow-color':  '#2a7ea1',
                    'shadow-opacity': 0.8,
                    'shadow-offset-x': 0,
                    'shadow-offset-y': 0
                }
            },

            // ── Selected node ─────────────────────────────────
            {
                selector: 'node:selected',
                style: {
                    'border-color':   '#2a7ea1',
                    'border-width':   3,
                    'shadow-blur':    8,
                    'shadow-color':   '#2a7ea1',
                    'shadow-opacity': 0.6,
                    'shadow-offset-x': 0,
                    'shadow-offset-y': 0
                }
            },

            // ── Edges ─────────────────────────────────────────
            {
                selector: 'edge',
                style: {
                    'width':              2,
                    'line-color':         '#4c5b79',
                    'curve-style':        'bezier',
                    'label':              '',
                    'font-size':          '10px',
                    'color':              '#f4f4f4',
                    'text-background-color':   '#1e3a52',
                    'text-background-opacity': 1,
                    'text-background-padding': '3px',
                    'text-border-color':  '#4c5b79',
                    'text-border-width':  1,
                    'text-border-opacity': 1,
                    'text-rotation':      'autorotate',
                    'opacity':            1
                }
            },
            // Edge label shows on hover (class toggled via JS)
            {
                selector: 'edge.hovered',
                style: {
                    'label':        'data(hoverLabel)',
                    'line-color':   '#2a7ea1',
                    'width':        3
                }
            },
            // OFFLINE edge — hidden
            {
                selector: 'edge.offline',
                style: { 'display': 'none' }
            },
            // Packet animation — active edge pulses
            {
                selector: 'edge.packet-active',
                style: {
                    'line-color':   '#f4c430',
                    'width':        4,
                    'line-style':   'dashed',
                    'line-dash-pattern': [8, 4]
                }
            }
        ],

        // Preset layout — nodes stay where user drags them
        layout: { name: 'preset' }
    });

    window.cy = cy;
    
    // ── HTML Labels ───────────────────────────────────────────
    cy.nodeHtmlLabel([
        {
            query: 'node',
            valign:    'center',
            halign:    'center',
            valignBox: 'center',
            halignBox: 'center',
            tpl: function (data) {
                const device = NetworkState.devices.find
                (d => d.id === data.id);
                if (!device) return '';

                const statusColor = device.status === 'ONLINE' ? '#4caf50' : '#6c7a8a';

                const statusDot = `<span style="
                    width:9px;height:9px;border-radius:50%;
                    background:${statusColor};
                    display:inline-block;flex-shrink:0;
                    box-shadow:0 0 4px ${statusColor};
                "></span>`;

                const divider = `<div style="height:0.5px;background:#4c5b79;margin:4px 0;"></div>`;

                const row = (label, value, valueColor = '#f4f4f4') => `
                    <div style="display:flex;justify-content:space-between;align-items:baseline;padding:1px 0;gap:4px;">
                        <span style="font-size:9px;color:#6c7a8a;flex-shrink:0;">${label}</span>
                        <span style="font-size:9px;color:${valueColor};text-align:right;word-break:break-all;">${value}</span>
                    </div>`;

                const portDot = (connected) => connected
                    ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#4caf50;flex-shrink:0;"></span>`
                    : `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;border:1.5px solid #6c7a8a;background:transparent;flex-shrink:0;"></span>`;

                const portRow = (p) => {
                    const connected = p.status === 'CONNECTED';
                    const connLabel = connected && p.connectedTo ? ` → ${p.connectedTo.deviceId}` : '';
                    return `
                        <div style="display:flex;align-items:center;gap:4px;padding:1px 0;">
                            ${portDot(connected)}
                            <span style="font-size:9px;color:${connected ? '#4caf50' : '#949baf'};">
                                ${p.interfaceName}${connLabel}
                            </span>
                        </div>`;
                };

                // ── PC / Laptop / Phone ───────────────────────────────────
                if (['PC', 'Laptop', 'Phone'].includes(device.type)) {
                    const ip      = device.ipAddress      ?? 'UNASSIGNED';
                    const mask    = device.subnetMask     ?? 'N/A';
                    const gateway = device.defaultGateway ?? 'NONE';
                    return `
                        <div style="width:170px;font-family:Montserrat,sans-serif;pointer-events:none;">
                            <div style="display:flex;align-items:center;gap:6px;padding:6px 8px 4px;">
                                ${statusDot}
                                <span style="font-size:11px;font-weight:600;color:#f4f4f4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                                    ${device.name}
                                </span>
                                <span style="font-size:9px;color:#6c7a8a;margin-left:auto;">${device.type}</span>
                            </div>
                            ${divider}
                            <div style="padding:2px 8px 6px;">
                                ${row('IP', ip, ip === 'UNASSIGNED' ? '#e57373' : '#2a7ea1')}
                                ${row('Mask', mask)}
                                ${row('Gateway', gateway, gateway === 'NONE' ? '#6c7a8a' : '#4caf50')}
                                ${row('MAC', device.macAddress, '#7a8db4')}
                                ${divider}
                                <div style="font-size:9px;color:#6c7a8a;margin-bottom:3px;">Ports</div>
                                ${device.ports.filter(p => p.interfaceName !== 'FastEthernet0/1').map(portRow).join('')}
                            </div>
                        </div>`;
                }

                // ── Switch ────────────────────────────────────────────────
                if (device.type === 'Switch') {
                    const connectedCount = device.ports.filter(p => p.status === 'CONNECTED').length;
                    return `
                        <div style="width:170px;font-family:Montserrat,sans-serif;pointer-events:none;">
                            <div style="display:flex;align-items:center;gap:6px;padding:6px 8px 4px;">
                                ${statusDot}
                                <span style="font-size:11px;font-weight:600;color:#f4f4f4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                                    ${device.name}
                                </span>
                                <span style="font-size:9px;color:#6c7a8a;margin-left:auto;">Switch</span>
                            </div>
                            ${divider}
                            <div style="padding:2px 8px 6px;">
                                ${row('MAC', device.macAddress, '#7a8db4')}
                                ${row('Layer', '2 — no IP', '#6c7a8a')}
                                ${row('Ports used', `${connectedCount} / 4`, connectedCount === 4 ? '#e57373' : '#4caf50')}
                                ${divider}
                                <div style="font-size:9px;color:#6c7a8a;margin-bottom:3px;">Ports</div>
                                ${device.ports.filter(p => p.interfaceName !== 'FastEthernet0/1').map(portRow).join('')}
                            </div>
                        </div>`;
                }

                // ── Router ────────────────────────────────────────────────
                if (device.type === 'Router') {
                    const lanPort = device.ports.find(p => p.interfaceName === 'FastEthernet0/0');
                    const wanPort = device.ports.find(p => p.interfaceName === 'FastEthernet0/1');
                    const leasePool  = NetworkState.ipLeases.find(l => l.routerId === device.id);
                    const leaseCount = leasePool?.assignedIps?.length ?? 0;

                    return `
                        <div style="width:170px;font-family:Montserrat,sans-serif;pointer-events:none;">
                            <div style="display:flex;align-items:center;gap:6px;padding:6px 8px 4px;">
                                ${statusDot}
                                <span style="font-size:11px;font-weight:600;color:#f4f4f4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                                    ${device.name}
                                </span>
                                <span style="font-size:9px;color:#6c7a8a;margin-left:auto;">Router</span>
                            </div>
                            ${divider}
                            <div style="padding:2px 8px 6px;">
                                ${row('MAC', device.macAddress, '#7a8db4')}
                                ${row('Subnet', device.subnetConfig?.subnet ?? 'N/A')}
                                ${row('DHCP leases', `${leaseCount} issued`, leaseCount > 0 ? '#4caf50' : '#6c7a8a')}
                                ${divider}
                                <div style="font-size:9px;color:#6c7a8a;margin-bottom:3px;">
                                    LAN — FastEthernet0/0
                                </div>
                                <div style="padding-left:4px;margin-bottom:4px;">
                                    ${row('IP', lanPort?.ipAddress ?? 'N/A', '#2a7ea1')}
                                    ${row('Mask', device.subnetMask ?? 'N/A')}
                                    ${row('Status', lanPort?.status ?? 'EMPTY', lanPort?.status === 'CONNECTED' ? '#4caf50' : '#6c7a8a')}
                                    ${lanPort?.connectedTo ? row('→', lanPort.connectedTo.deviceId, '#4caf50') : ''}
                                </div>
                                ${divider}
                                <div style="font-size:9px;color:#6c7a8a;margin-bottom:3px;">
                                    WAN — FastEthernet0/1
                                </div>
                                <div style="padding-left:4px;">
                                    ${row('IP', wanPort?.ipAddress ?? 'N/A', '#a17a2a')}
                                    ${row('Type', 'Public / Internet', '#6c7a8a')}
                                    ${row('Status', wanPort?.status ?? 'EMPTY', wanPort?.status === 'CONNECTED' ? '#4caf50' : '#6c7a8a')}
                                    ${wanPort?.connectedTo ? row('→', wanPort.connectedTo.deviceId, '#4caf50') : ''}
                                </div>
                            </div>
                        </div>`;
                }

                // ── Server ────────────────────────────────────────────────
                if (device.type === 'Server') {
                    const ip      = device.ipAddress      ?? 'UNASSIGNED';
                    const mask    = device.subnetMask     ?? 'N/A';
                    const gateway = device.defaultGateway ?? 'NONE';
                    const services = device.services ?? [];
                    return `
                        <div style="width:170px;font-family:Montserrat,sans-serif;pointer-events:none;">
                            <div style="display:flex;align-items:center;gap:6px;padding:6px 8px 4px;">
                                ${statusDot}
                                <span style="font-size:11px;font-weight:600;color:#f4f4f4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                                    ${device.name}
                                </span>
                                <span style="font-size:9px;color:#8a3aa1;margin-left:auto;">${device.serverType ?? 'Server'}</span>
                            </div>
                            ${divider}
                            <div style="padding:2px 8px 6px;">
                                ${row('IP', ip, ip === 'UNASSIGNED' ? '#e57373' : '#2a7ea1')}
                                ${row('Mask', mask)}
                                ${row('Gateway', gateway, gateway === 'NONE' ? '#6c7a8a' : '#4caf50')}
                                ${row('MAC', device.macAddress, '#7a8db4')}
                                ${row('Static IP', 'Yes', '#a17a2a')}
                                ${divider}
                                <div style="font-size:9px;color:#6c7a8a;margin-bottom:3px;">Ports</div>
                                ${device.ports.map(portRow).join('')}
                                ${services.length > 0 ? `
                                    ${divider}
                                    <div style="font-size:9px;color:#6c7a8a;margin-bottom:3px;">Services</div>
                                    ${services.map(s => row(s.name, s.enabled ? 'ON' : 'OFF', s.enabled ? '#4caf50' : '#6c7a8a')).join('')}
                                ` : ''}
                            </div>
                        </div>`;
                }

                return '';
            }
        }
    ]);

    // ── Edge hover label ──────────────────────────────────────
    cy.on('mouseover', 'edge', function (evt) {
        evt.target.addClass('hovered');
    });
    cy.on('mouseout', 'edge', function (evt) {
        evt.target.removeClass('hovered');
    });

    // ── Node tap → open device panel ─────────────────────────
    cy.on('tap', 'node', function (evt) {
        const nodeId = evt.target.data('id');
        const device = NetworkState.devices.find(d => d.id === nodeId);
        if (device && typeof openDevicePanel === 'function') {
            openDevicePanel(device);
        }
    });

    // ── Canvas tap → close panel ──────────────────────────────
    cy.on('tap', function (evt) {
        if (evt.target === cy && typeof closeDevicePanel === 'function') {
            closeDevicePanel();
        }
    });
});


// ── Helpers called by add-device.js / connection-ui.js ───────

/** Places a new node at a random non-overlapping position */
function getRandomPosition() {
    const container = document.getElementById('cytoscape');
    const w = container.clientWidth  || 800;
    const h = container.clientHeight || 600;
    const padding  = 80;
    const nodeSize = 150;

    const existingPositions = window.cy
        ? window.cy.nodes().map(n => n.position())
        : [];

    let pos, attempts = 0;
    do {
        pos = {
            x: padding + Math.random() * (w - padding * 2 - nodeSize),
            y: padding + Math.random() * (h - padding * 2 - nodeSize)
        };
        attempts++;
    } while (
        attempts < 50 &&
        existingPositions.some(p =>
            Math.abs(p.x - pos.x) < nodeSize &&
            Math.abs(p.y - pos.y) < nodeSize
        )
    );

    return pos;
}

/** Refreshes the HTML label for a node after state changes */
function refreshNodeLabel(deviceId) {
    if (!window.cy) return;
    window.cy.$(`#${deviceId}`).data('updated', Date.now());
}

/** Applies or removes the offline class on a node and its edges */
function syncNodeOfflineState(deviceId) {
    if (!window.cy) return;
    const node   = window.cy.$(`#${deviceId}`);
    const device = NetworkState.devices.find(d => d.id === deviceId);
    if (!device) return;

    if (device.status === 'OFFLINE') {
        node.addClass('offline');
        node.connectedEdges().addClass('offline');
    } else {
        node.removeClass('offline');
        // Only restore edges where BOTH endpoints are online
        node.connectedEdges().forEach(edge => {
            const srcId = edge.data('source');
            const tgtId = edge.data('target');
            const srcDevice = NetworkState.devices.find(d => d.id === srcId);
            const tgtDevice = NetworkState.devices.find(d => d.id === tgtId);
            if (srcDevice?.status === 'ONLINE' && tgtDevice?.status === 'ONLINE') {
                edge.removeClass('offline');
            }
        });
    }
}

/** Pulses an edge during packet animation, then restores it */
function pulseEdge(sourceId, targetId, durationMs = 600) {
    if (!window.cy) return;
    const edge = window.cy.edges(`[source="${sourceId}"][target="${targetId}"], [source="${targetId}"][target="${sourceId}"]`);
    edge.addClass('packet-active');
    setTimeout(() => edge.removeClass('packet-active'), durationMs);
}