// ============================================================
// networking.js — Connection validation, IP assignment,
//                 ARP, Packet builder, simulation engine
// ============================================================

// Connection Validation
function canConnect(deviceA, portAId, deviceB, portBId) {
    const portA = deviceA.ports.find(p => p.id === portAId);
    const portB = deviceB.ports.find(p => p.id === portBId);

    if (!portA || !portB) {
        return { valid: false, reason: 'One or both ports do not exist.' };
    }

    // Port already in use
    if (portA.status === 'CONNECTED') {
        return { valid: false, reason: `Port ${portA.interfaceName} is already in use.` };
    }
    if (portB.status === 'CONNECTED') {
        return { valid: false, reason: `Port ${portB.interfaceName} is already in use.` };
    }

    const typeA = deviceA.type;
    const typeB = deviceB.type;
    const endDevices = ['PC', 'Laptop', 'Phone', 'Server'];

    // PC <-> PC or any end-device <-> end-device 
    if (endDevices.includes(typeA) && endDevices.includes(typeB)) {
        return { valid: false, reason: 'Direct end-device connections are not supported.' };
    }

    // Switch <-> Switch
    if (typeA === 'Switch' && typeB === 'Switch') {
        return { valid: false, reason: 'Switch uplinks are outside this simulation\'s scope.' };
    }

    // Switch capacity check
    if (typeA === 'Switch' && _switchFull(deviceA)) {
        return { valid: false, reason: 'Switch has no available ports (max 4 devices).' };
    }
    if (typeB === 'Switch' && _switchFull(deviceB)) {
        return { valid: false, reason: 'Switch has no available ports (max 4 devices).' };
    }

    // WAN port can only connect to another router's WAN port
    const WAN = 'FastEthernet0/1';
    if (portA.interfaceName === WAN || portB.interfaceName === WAN) {
        if (typeA !== 'Router' || typeB !== 'Router') {
            return { valid: false, reason: 'WAN port (FastEthernet0/1) can only connect to another Router.' };
        }
        if (portA.interfaceName !== WAN || portB.interfaceName !== WAN) {
            return { valid: false, reason: 'Router WAN connections must use FastEthernet0/1 on both sides.' };
        }
    }

    // End device → Switch: target must be an EMPTY switch port
    if (endDevices.includes(typeA) && typeB === 'Switch') {
        const emptyPort = deviceB.ports.find(p => p.status === 'EMPTY');
        if (!emptyPort) {
            return { valid: false, reason: 'Switch has no available ports (max 4 devices).' };
        }
    }
    if (endDevices.includes(typeB) && typeA === 'Switch') {
        const emptyPort = deviceA.ports.find(p => p.status === 'EMPTY');
        if (!emptyPort) {
            return { valid: false, reason: 'Switch has no available ports (max 4 devices).' };
        }
    }

    // Switch -> Router: must use router's LAN port (FastEthernet0/0)
    if (typeA === 'Switch' && typeB === 'Router') {
        if (portB.interfaceName !== 'FastEthernet0/0') {
            return { valid: false, reason: 'Switch must connect to Router\'s LAN port (FastEthernet0/0).' };
        }
    }
    if (typeB === 'Switch' && typeA === 'Router') {
        if (portA.interfaceName !== 'FastEthernet0/0') {
            return { valid: false, reason: 'Switch must connect to Router\'s LAN port (FastEthernet0/0).' };
        }
    }

    // End device direct to Router: must use LAN port
    if (endDevices.includes(typeA) && typeB === 'Router') {
        if (portB.interfaceName !== 'FastEthernet0/0') {
            return { valid: false, reason: 'End devices must connect to Router\'s LAN port (FastEthernet0/0).' };
        }
    }
    if (endDevices.includes(typeB) && typeA === 'Router') {
        if (portA.interfaceName !== 'FastEthernet0/0') {
            return { valid: false, reason: 'End devices must connect to Router\'s LAN port (FastEthernet0/0).' };
        }
    }

    return { valid: true, reason: 'OK' };
}

/** Returns true if all 4 switch ports are CONNECTED */
function _switchFull(switchDevice) {
    return switchDevice.ports.every(p => p.status === 'CONNECTED');
}


// IP Assignment
function findConnectedRouter(device) {
    const visited = new Set();

    function trace(currentDevice) {
        if (visited.has(currentDevice.id)) return null;
        visited.add(currentDevice.id);

        for (const port of currentDevice.ports) {
            if (port.status !== 'CONNECTED' || !port.connectedTo) continue;

            const neighbour = NetworkState.devices.find(d => d.id === port.connectedTo.deviceId);
            if (!neighbour) continue;

            if (neighbour.type === 'Router') return neighbour;

            // Traverse through switches
            if (neighbour.type === 'Switch') {
                const result = trace(neighbour);
                if (result) return result;
            }
        }
        return null;
    }

    return trace(device);
}

function assignIPviaDHCP(device) {
    if (device.staticIp) return;

    const router = findConnectedRouter(device);
    if (!router) {
        logEvent(`DHCP: No router found for ${device.name} — IP not assigned.`);
        return;
    }

    const ip = getNextDHCPLease(router.id);
    if (!ip) {
        logEvent(`DHCP: No addresses available for ${device.name}.`);
        return;
    }

    device.ipAddress     = ip;
    device.subnetMask    = '255.255.255.0';
    device.defaultGateway = router.ipAddress;

    // Register in ARP table
    _addToARP(device.id, ip, device.macAddress);

    logEvent(`DHCP: ${device.name} assigned ${ip} via ${router.name}`);
}

function releaseDeviceIP(device) {
    if (!device.ipAddress || device.staticIp) return;

    const router = findConnectedRouter(device);
    if (router) {
        releaseIPLease(router.id, device.ipAddress);
    }

    // Remove from ARP table
    _removeFromARP(device.id);

    device.ipAddress     = null;
    device.subnetMask    = null;
    device.defaultGateway = null;

    logEvent(`IP released: ${device.name} is no longer addressed.`);
}

function _addToARP(deviceId, ip, mac) {
    const existing = NetworkState.arpTable.find(e => e.deviceId === deviceId);
    if (existing) {
        existing.ip  = ip;
        existing.mac = mac;
    } else {
        NetworkState.arpTable.push({ deviceId, ip, mac });
    }
}

function _removeFromARP(deviceId) {
    NetworkState.arpTable = NetworkState.arpTable.filter(e => e.deviceId !== deviceId);
}

function resolveARP(senderDevice, targetIp) {
    const cached = NetworkState.arpTable.find(e => e.ip === targetIp);
    if (cached) return cached.mac;

    logEvent(`ARP Request: ${senderDevice.name} asks — who has ${targetIp}?`);

    const target = NetworkState.devices.find(d => d.ipAddress === targetIp);
    if (!target) {
        logEvent(`ARP: No device found with IP ${targetIp}`);
        return null;
    }

    logEvent(`ARP Reply: ${targetIp} is at ${target.macAddress} (${target.name})`);
    _addToARP(target.id, targetIp, target.macAddress);

    return target.macAddress;
}

function buildPacket(srcMAC, dstMAC, srcIP, dstIP, protocol, hopLabel, note) {
    return { srcMAC, dstMAC, srcIP, dstIP, protocol, hopLabel, note };
}

function requireDHCP() {
    if (!NetworkState.dhcpCompleted) {
        logEvent('Run DHCP Discovery first to assign IP addresses.');
        return false;
    }
    return true;
}

function runDHCPDiscovery() {
    const packets = [];
    const endDevices = ['PC', 'Laptop', 'Phone', 'Server'];

    NetworkState.devices
        .filter(d => endDevices.includes(d.type) && !d.ipAddress && !d.staticIp)
        .forEach(device => {
            const router = findConnectedRouter(device);
            if (!router) return;

            const offeredIp = getNextDHCPLease(router.id);
            if (!offeredIp) return;

            // DHCP Discover
            packets.push(buildPacket(
                device.macAddress, 'FF:FF:FF:FF:FF:FF',
                '0.0.0.0', '255.255.255.255',
                'DHCP',
                `${device.name} → broadcast`,
                `${device.name} sends DHCP Discover — requesting an IP address.`
            ));

            // DHCP Offer
            packets.push(buildPacket(
                router.macAddress, device.macAddress,
                router.ipAddress, offeredIp,
                'DHCP',
                `${router.name} → ${device.name}`,
                `${router.name} offers IP ${offeredIp} to ${device.name}.`
            ));

            // DHCP Request
            packets.push(buildPacket(
                device.macAddress, router.macAddress,
                '0.0.0.0', '255.255.255.255',
                'DHCP',
                `${device.name} → ${router.name}`,
                `${device.name} requests the offered IP ${offeredIp}.`
            ));

            // DHCP Acknowledge
            packets.push(buildPacket(
                router.macAddress, device.macAddress,
                router.ipAddress, offeredIp,
                'DHCP',
                `${router.name} → ${device.name}`,
                `${router.name} acknowledges — ${device.name} is now ${offeredIp}.`
            ));

            // Apply the IP
            device.ipAddress      = offeredIp;
            device.subnetMask     = '255.255.255.0';
            device.defaultGateway = router.ipAddress;
            _addToARP(device.id, offeredIp, device.macAddress);

            logEvent(`DHCP: ${device.name} assigned ${offeredIp} via ${router.name}`);
        });

    NetworkState.dhcpCompleted = true;
    logEvent('DHCP Discovery complete.');
    return packets;
}

function runSameLANComm(srcDevice, dstDevice) {
    if (!requireDHCP()) return [];

    const packets = [];
    const dstMac = resolveARP(srcDevice, dstDevice.ipAddress);

    packets.push(buildPacket(
        srcDevice.macAddress, dstMac,
        srcDevice.ipAddress, dstDevice.ipAddress,
        'MSG',
        `${srcDevice.name} → ${dstDevice.name}`,
        `${srcDevice.name} sends directly to ${dstDevice.name} on the same LAN.`
    ));

    logEvent(`MSG: ${srcDevice.name} → ${dstDevice.name} (same LAN)`);
    return packets;
}

function runInterSubnetComm(srcDevice, dstDevice) {
    if (!requireDHCP()) return [];

    const packets = [];
    const srcRouter = findConnectedRouter(srcDevice);
    const dstRouter = findConnectedRouter(dstDevice);

    if (!srcRouter || !dstRouter) {
        logEvent('Routing failed: one or both devices are not connected to a router.');
        return [];
    }

    const gatewayMac = resolveARP(srcDevice, srcRouter.ipAddress);
    packets.push(buildPacket(
        srcDevice.macAddress, gatewayMac,
        srcDevice.ipAddress, dstDevice.ipAddress,
        'MSG',
        `${srcDevice.name} → ${srcRouter.name}`,
        `${srcDevice.name} sends to its gateway ${srcRouter.name}. Dst IP is outside the local subnet.`
    ));

    const dstRouterWanMac = resolveARP(srcRouter, dstRouter.ports.find(p => p.interfaceName === 'FastEthernet0/1')?.ipAddress);
    packets.push(buildPacket(
        srcRouter.macAddress, dstRouterWanMac ?? dstRouter.macAddress,
        srcDevice.ipAddress, dstDevice.ipAddress,
        'MSG',
        `${srcRouter.name} → ${dstRouter.name}`,
        `${srcRouter.name} rewrites Layer 2 headers and forwards packet across WAN link to ${dstRouter.name}.`
    ));

    const dstMac = resolveARP(dstRouter, dstDevice.ipAddress);
    packets.push(buildPacket(
        dstRouter.macAddress, dstMac,
        srcDevice.ipAddress, dstDevice.ipAddress,
        'MSG',
        `${dstRouter.name} → ${dstDevice.name}`,
        `${dstRouter.name} rewrites Layer 2 headers again and delivers to ${dstDevice.name} on its LAN.`
    ));

    logEvent(`MSG: ${srcDevice.name} → ${dstDevice.name} (inter-subnet via ${srcRouter.name} and ${dstRouter.name})`);
    return packets;
}

function runDNSandHTTP(clientDevice, dnsServer, webServer) {
    if (!requireDHCP()) return [];

    const packets = [];

    // DNS Query
    const dnsMac = resolveARP(clientDevice, dnsServer.ipAddress);
    packets.push(buildPacket(
        clientDevice.macAddress, dnsMac,
        clientDevice.ipAddress, dnsServer.ipAddress,
        'DNS',
        `${clientDevice.name} → ${dnsServer.name}`,
        `${clientDevice.name} sends DNS query — asking for the IP of the web server.`
    ));

    // DNS Reply
    packets.push(buildPacket(
        dnsServer.macAddress, clientDevice.macAddress,
        dnsServer.ipAddress, clientDevice.ipAddress,
        'DNS',
        `${dnsServer.name} → ${clientDevice.name}`,
        `${dnsServer.name} replies with the IP address of the web server: ${webServer.ipAddress}.`
    ));

    // HTTP Request
    const webMac = resolveARP(clientDevice, webServer.ipAddress);
    packets.push(buildPacket(
        clientDevice.macAddress, webMac,
        clientDevice.ipAddress, webServer.ipAddress,
        'HTTP',
        `${clientDevice.name} → ${webServer.name}`,
        `${clientDevice.name} sends HTTP GET request to ${webServer.name}.`
    ));

    // HTTP Response
    packets.push(buildPacket(
        webServer.macAddress, clientDevice.macAddress,
        webServer.ipAddress, clientDevice.ipAddress,
        'HTTP',
        `${webServer.name} → ${clientDevice.name}`,
        `${webServer.name} responds with HTTP 200 OK.`
    ));

    logEvent(`HTTP: ${clientDevice.name} resolved DNS and fetched page from ${webServer.name}`);
    return packets;
}
