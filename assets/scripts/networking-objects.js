// ============================================================
// network-state.js — Global state and all utility functions
// ============================================================

// Global Network State
const NetworkState = {
    devices:       [],
    connections:   [],
    ipLeases:      [],   // [{ routerId, assignedIps: [] }]
    arpTable:      [],   // [{ deviceId, ip, mac }]
    simulationLog: [],
    deviceCounts:  { pc: 0, switch: 0, router: 0, server: 0 },
    dhcpCompleted: false
};

// Subnet Pool
const SUBNET_POOL = [
    { subnet: '192.168.1.0/24', lanIp: '192.168.1.1', mask: '255.255.255.0', range: '192.168.1' },
    { subnet: '192.168.2.0/24', lanIp: '192.168.2.1', mask: '255.255.255.0', range: '192.168.2' },
    { subnet: '192.168.3.0/24', lanIp: '192.168.3.1', mask: '255.255.255.0', range: '192.168.3' },
    { subnet: '192.168.4.0/24', lanIp: '192.168.4.1', mask: '255.255.255.0', range: '192.168.4' },
];
let subnetPoolIndex = 0; // tracks which subnets have been assigned


let wanCounter = 0;

// Utility — MAC Address Generator
function generateMAC() {
    const usedMACs = new Set(NetworkState.devices.map(d => d.macAddress));

    let mac;
    do {
        mac = Array.from({ length: 6 }, () =>
            Math.floor(Math.random() * 256)
                .toString(16)
                .padStart(2, '0')
                .toUpperCase()
        ).join(':');
    } while (usedMACs.has(mac));

    return mac;
}

// Utility
function generateRouterSubnet() {
    if (subnetPoolIndex >= SUBNET_POOL.length) {
        logEvent('Subnet pool exhausted — max 4 routers supported.');
        return null;
    }
    return SUBNET_POOL[subnetPoolIndex++];
}

function generateWanIp() {
    wanCounter++;
    return `203.0.113.${wanCounter}`;
}
function initLeasePool(routerId) {
    const exists = NetworkState.ipLeases.find(l => l.routerId === routerId);
    if (!exists) {
        NetworkState.ipLeases.push({ routerId, assignedIps: [] });
    }
}

function getNextDHCPLease(routerId) {
    const router = NetworkState.devices.find(d => d.id === routerId);
    if (!router) return null;

    const subnetRange = router.subnetConfig?.range; // e.g. '192.168.1'
    if (!subnetRange) return null;

    const leasePool = NetworkState.ipLeases.find(l => l.routerId === routerId);
    if (!leasePool) return null;

    for (let host = 2; host <= 254; host++) {
        const candidate = `${subnetRange}.${host}`;
        if (!leasePool.assignedIps.includes(candidate)) {
            leasePool.assignedIps.push(candidate);
            logEvent(`DHCP: Leased ${candidate} from router ${routerId}`);
            return candidate;
        }
    }

    logEvent(`DHCP: Lease pool exhausted for router ${routerId}`);
    return null;
}

function releaseIPLease(routerId, ip) {
    const leasePool = NetworkState.ipLeases.find(l => l.routerId === routerId);
    if (!leasePool) return;

    leasePool.assignedIps = leasePool.assignedIps.filter(a => a !== ip);
    logEvent(`DHCP: Released ${ip} back to router ${routerId}`);
}

// Port
function createPort(id, interfaceName, ipAddress = null, subnetMask = null) {
    return {
        id,
        interfaceName,
        ipAddress,
        subnetMask,
        status: 'EMPTY',
        connectedTo: null
    };
}

// Device
function createBaseDevice(id, name, type) {
    return {
        id,
        name,
        type,
        status: 'ONLINE',
        macAddress: generateMAC(),
        ipAddress: null,
        subnetMask: null,
        defaultGateway: null,
        ports: []
    };
}

function createPC(id, name) {
    const device = createBaseDevice(id, name, 'PC');
    device.staticIp = false;
    device.ports = [
        createPort(`${id}-fa0`, 'Port0/0')
    ];
    return device;
}

function createSwitch(id, name) {
    const device = createBaseDevice(id, name, 'Switch');
    device.ipAddress  = null; // switches never get IPs — Layer 2 only
    device.subnetMask = null;
    device.defaultGateway = null;
    device.ports = [
        createPort(`${id}-fa0`, 'Port0/0'),
        createPort(`${id}-fa1`, 'Port0/1'),
        createPort(`${id}-fa2`, 'Port0/2'),
        createPort(`${id}-fa3`, 'Port0/3'),
    ];
    return device;
}

function createRouter(id, name) {
    const device = createBaseDevice(id, name, 'Router');
    device.staticIp = true;

    const subnetConfig = generateRouterSubnet();
    const wanIp        = generateWanIp();

    device.subnetConfig  = subnetConfig; // store for DHCP lookups
    device.ipAddress     = subnetConfig?.lanIp ?? null;
    device.subnetMask    = subnetConfig?.mask  ?? null;
    device.defaultGateway = null; // routers are gateways — they don't have one

    device.ports = [
        createPort(
            `${id}-fa0`,
            'Port0/0',
            subnetConfig?.lanIp ?? null,
            subnetConfig?.mask  ?? null
        ),
        createPort(
            `${id}-fa1`,
            'Port0/1',
            wanIp,
            null  // WAN port — public internet address, no subnet mask
        )
    ];

    initLeasePool(id);
    return device;
}

// Connection 
function createConnection(sourceDevice, sourcePortId, targetDevice, targetPortId) {
    const connectionId = `conn-${sourceDevice.id}-${targetDevice.id}-${Date.now()}`;

    const sourcePort = sourceDevice.ports.find(p => p.id === sourcePortId);
    const targetPort = targetDevice.ports.find(p => p.id === targetPortId);

    if (!sourcePort || !targetPort) {
        logEvent(`Connection failed: port not found between ${sourceDevice.id} and ${targetDevice.id}`);
        return null;
    }
    if (sourcePort.status === 'CONNECTED' || targetPort.status === 'CONNECTED') {
        logEvent(`Connection failed: port already in use`);
        return null;
    }

    // Atomically update both ports
    sourcePort.status      = 'CONNECTED';
    sourcePort.connectedTo = { deviceId: targetDevice.id, portId: targetPortId };
    targetPort.status      = 'CONNECTED';
    targetPort.connectedTo = { deviceId: sourceDevice.id, portId: sourcePortId };

    const connection = { id: connectionId, sourceDeviceId: sourceDevice.id, sourcePortId, targetDeviceId: targetDevice.id, targetPortId };
    NetworkState.connections.push(connection);

    logEvent(`Connected ${sourceDevice.name} (${sourcePort.interfaceName}) ↔ ${targetDevice.name} (${targetPort.interfaceName})`);
    return connection;
}

// Simulation Log
function logEvent(message) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = `[${timestamp}] ${message}`;
    NetworkState.simulationLog.push(entry);
    console.log(entry);
}
