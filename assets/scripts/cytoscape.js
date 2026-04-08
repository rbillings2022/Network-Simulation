document.addEventListener("DOMContentLoaded", function () {

    const cy = cytoscape({
        container: document.getElementById('cytoscape'),
        elements: [], // Start with empty canvas
        style: [
            {
                selector: 'node[type="pc"]',
                style: {
                    'background-image': 'assets/icons/computer.png',
                    'background-image-containment': 'inside',
                    'background-color': '#172738',
                    'label': 'data(id)',
                    'color': '#fff',
                    'text-halign': 'center',
                    'text-valign': 'bottom',
                    'width': 60,
                    'height': 60
                }
            },
            {
                selector: 'node[type="switch"]',
                style: {
                    'background-image': 'assets/icons/switch.png',
                    'background-image-containment': 'inside',
                    'background-color': '#172738',
                    'label': 'data(id)',
                    'color': '#fff',
                    'text-halign': 'center',
                    'text-valign': 'bottom',
                    'width': 60,
                    'height': 60
                }
            },
            {
                selector: 'node[type="router"]',
                style: {
                    'background-image': 'assets/icons/router.png',
                    'background-image-containment': 'inside',
                    'background-color': '#172738',
                    'label': 'data(id)',
                    'color': '#fff',
                    'text-halign': 'center',
                    'text-valign': 'bottom',
                    'width': 60,
                    'height': 60
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 3,
                    'line-color': '#ccc'
                }
            }
        ],
        layout: { name: 'grid' }
    });

    // Expose cy so script.js can call addDeviceToCanvas()
    window.cy = cy;
});