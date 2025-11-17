// Import the WebSocket library
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Create an HTTP server to serve the HTML file
const server = http.createServer((req, res) => {
    // Serve the index.html file for all requests
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading index.html');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// Create WebSocket server attached to the HTTP server
const wss = new WebSocket.Server({ server });

// Store all connected clients
const clients = new Map();

// Handle new WebSocket connections
wss.on('connection', (ws) => {
    console.log('New client connected');

    // Generate a temporary ID for this connection (will be replaced by client's ID)
    let tempId = Math.random().toString(36).substr(2, 9);

    // Handle incoming messages from clients
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // Store client information including their color
            if (data.type === 'touchUpdate') {
                // Update the client's ID mapping
                if (!clients.has(data.clientId)) {
                    clients.set(data.clientId, { ws, color: data.color });
                    console.log(`Client registered: ${data.clientId} with color ${data.color}`);
                }

                // Broadcast this touch update to all OTHER clients
                clients.forEach((client, id) => {
                    // Don't send the message back to the sender
                    if (id !== data.clientId && client.ws.readyState === WebSocket.OPEN) {
                        client.ws.send(JSON.stringify({
                            type: 'touchUpdate',
                            clientId: data.clientId,
                            color: data.color,
                            touches: data.touches
                        }));
                    }
                });
            }

            // Handle clearing touches when client lifts all fingers
            if (data.type === 'clearTouches') {
                // Broadcast clear message to all OTHER clients
                clients.forEach((client, id) => {
                    if (id !== data.clientId && client.ws.readyState === WebSocket.OPEN) {
                        client.ws.send(JSON.stringify({
                            type: 'clearTouches',
                            clientId: data.clientId
                        }));
                    }
                });
            }

        } catch (err) {
            console.error('Error parsing message:', err);
        }
    });

    // Handle client disconnection
    ws.on('close', () => {
        console.log('Client disconnected');

        // Find and remove the disconnected client
        let disconnectedId = null;
        clients.forEach((client, id) => {
            if (client.ws === ws) {
                disconnectedId = id;
            }
        });

        if (disconnectedId) {
            clients.delete(disconnectedId);

            // Notify all remaining clients to remove this client's touches
            clients.forEach((client) => {
                if (client.ws.readyState === WebSocket.OPEN) {
                    client.ws.send(JSON.stringify({
                        type: 'clearTouches',
                        clientId: disconnectedId
                    }));
                }
            });
        }
    });

    // Handle errors
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Open your browser to see the app`);
});