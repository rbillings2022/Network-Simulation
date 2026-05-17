// ============================================================
// animation.js — Packet dot animation along network edges
// ============================================================

function runPacketAnimation() {
    if (!window.cy) return;

    const nodes = window.cy.nodes();

    // ── Guard: need more than one device ─────────────────────
    if (NetworkState.devices.length <= 1) {
        showToast('You need more than one device in a network.', true);
        return;
    }

    const edges = window.cy.edges();
    if (edges.length === 0) {
        showToast('No connections found — connect devices first.', true);
        return;
    }

    // ── Build animation path ──────────────────────────────────
    // Find the first PC device as the starting point
    const startDevice = NetworkState.devices.find(d => d.type === 'PC')
                     ?? NetworkState.devices[0];

    const startNode = window.cy.$(`#${startDevice.id}`);
    if (startNode.empty()) return;

    // Walk the graph from startNode following connected edges
    const path = buildPath(startNode);
    if (path.length < 2) {
        showToast('Could not trace a path — make sure devices are connected.', true);
        return;
    }

    // ── Create the animated dot ───────────────────────────────
    const dot = _createDot();
    document.getElementById('cytoscape').appendChild(dot);

    // ── Animate forward then back ─────────────────────────────
    animateAlongPath(path, dot, () => {
        // Reached the end — animate back
        animateAlongPath([...path].reverse(), dot, () => {
            dot.remove();
        });
    });
}

// ── Build ordered node path from start ───────────────────────
function buildPath(startNode) {
    const visited = new Set();
    const path    = [startNode];
    visited.add(startNode.id());

    let current = startNode;

    while (true) {
        const neighbours = current.neighborhood('node').filter(n => !visited.has(n.id()));
        if (neighbours.empty()) break;

        const next = neighbours[0];
        path.push(next);
        visited.add(next.id());
        current = next;
    }

    return path;
}

// ── Animate dot along an array of cy nodes ───────────────────
function animateAlongPath(nodePath, dot, onComplete) {
    let index = 0;

    function step() {
        if (index >= nodePath.length - 1) {
            onComplete();
            return;
        }

        const fromNode = nodePath[index];
        const toNode   = nodePath[index + 1];

        // Pulse the edge between these two nodes
        const edgeId = fromNode.edgesWith(toNode).id();
        if (edgeId) pulseEdge(fromNode.id(), toNode.id(), 600);

        // Get canvas pixel positions
        const fromPos = _nodeCenter(fromNode);
        const toPos   = _nodeCenter(toNode);

        // Place dot at start
        dot.style.left = fromPos.x + 'px';
        dot.style.top  = fromPos.y + 'px';

        // Animation dot speed
        const duration  = 1200;
        const startTime = performance.now();

        function frame(now) {
            const elapsed  = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased    = easeInOut(progress);

            const x = fromPos.x + (toPos.x - fromPos.x) * eased;
            const y = fromPos.y + (toPos.y - fromPos.y) * eased;

            dot.style.left = x + 'px';
            dot.style.top  = y + 'px';

            if (progress < 1) {
                requestAnimationFrame(frame);
            } else {
                index++;
                //Pause animation time between devices
                setTimeout(step, 300); 
            }
        }

        requestAnimationFrame(frame);
    }

    step();
}

// ── Get canvas pixel center of a cytoscape node ──────────────
function _nodeCenter(node) {
    const container = document.getElementById('cytoscape');
    const rect      = container.getBoundingClientRect();
    const pan       = window.cy.pan();
    const zoom      = window.cy.zoom();
    const pos       = node.position();

    return {
        x: pos.x * zoom + pan.x,
        y: pos.y * zoom + pan.y
    };
}

// ── Create the dot element ────────────────────────────────────
function _createDot() {
    const dot = document.createElement('div');
    dot.id = 'packet-dot';
    dot.style.cssText = `
        position:   absolute;
        width:      14px;
        height:     14px;
        border-radius: 50%;
        background: #f4c430;
        box-shadow: 0 0 8px #f4c430, 0 0 16px #f4c43088;
        pointer-events: none;
        z-index:    100;
        transform:  translate(-50%, -50%);
        transition: none;
    `;
    return dot;
}

// ── Easing function ───────────────────────────────────────────
function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}