const express = require('express');
const { spawn, exec } = require('child_process');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = 4000;

// Store running processes
const processes = new Map();
const configFile = path.join(__dirname, '../servers.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Load saved server configurations
function loadServers() {
    try {
        if (fs.existsSync(configFile)) {
            return JSON.parse(fs.readFileSync(configFile, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading servers:', error);
    }
    return {};
}

// Save server configurations
function saveServers(servers) {
    try {
        fs.writeFileSync(configFile, JSON.stringify(servers, null, 2));
    } catch (error) {
        console.error('Error saving servers:', error);
    }
}

function getConfigPorts(config) {
    const ports = new Set();

    const addPort = (value) => {
        if (value === undefined || value === null) {
            return;
        }

        const portNumber = Number(value);

        if (!Number.isNaN(portNumber) && portNumber > 0) {
            ports.add(portNumber);
        }
    };

    addPort(config.port);

    if (Array.isArray(config.ports)) {
        config.ports.forEach(addPort);
    }

    if (Array.isArray(config.additionalPorts)) {
        config.additionalPorts.forEach(addPort);
    }

    return Array.from(ports);
}

// Check if process is running on a port
function checkPort(port) {
    return new Promise((resolve) => {
        exec(`lsof -i :${port} -t`, (error, stdout) => {
            const output = stdout ? stdout.trim() : '';
            if (error || !output) {
                resolve({ running: false, pid: null, pids: [] });
            } else {
                const pids = output.split(/\s+/);
                resolve({ running: true, pid: pids[0], pids });
            }
        });
    });
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function killProcesses(pids) {
    if (!Array.isArray(pids) || pids.length === 0) {
        return;
    }

    for (const pid of pids) {
        await new Promise((resolve, reject) => {
            exec(`kill ${pid}`, (error) => {
                if (error && !/No such process/i.test(error.message)) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }
}

async function ensurePortFree(port) {
    const initial = await checkPort(port);
    if (!initial.running) {
        return { freed: false, pids: [] };
    }

    await killProcesses(initial.pids);
    await delay(400);

    const afterKill = await checkPort(port);
    if (afterKill.running) {
        throw new Error(`Unable to free port ${port}. Still in use by PID(s): ${afterKill.pids.join(', ')}`);
    }

    return { freed: true, pids: initial.pids };
}

async function ensurePortsFree(ports) {
    const freedPorts = [];

    for (const port of ports) {
        const result = await ensurePortFree(port);

        if (result.freed) {
            freedPorts.push({
                port,
                pids: result.pids
            });
        }
    }

    return freedPorts;
}

function launchServer(config, url) {
    const [cmd, ...args] = config.command.split(' ');
    const child = spawn(cmd, args, {
        cwd: config.directory,
        detached: true,
        stdio: 'ignore',
        shell: true
    });

    child.unref();

    processes.set(url, {
        pid: child.pid,
        startTime: new Date()
    });

    return child.pid;
}

// Get server config
app.get('/api/server-config', (req, res) => {
    const { url } = req.query;
    const servers = loadServers();
    const config = servers[url];

    if (!config) {
        return res.json({
            found: false,
            message: 'Server not configured. Please add configuration first.'
        });
    }

    res.json({ found: true, config });
});

// Save server config
app.post('/api/server-config', (req, res) => {
    const { url, directory, command, port } = req.body;

    if (!url || !directory || !command || !port) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: url, directory, command, port'
        });
    }

    const servers = loadServers();
    servers[url] = { directory, command, port };
    saveServers(servers);

    res.json({ success: true, message: 'Server configuration saved' });
});

// Check server status
app.get('/api/status', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const servers = loadServers();
        const config = servers[url];

        if (!config) {
            return res.json({ status: 'unconfigured', message: 'Server not configured' });
        }

        const ports = getConfigPorts(config);
        if (!ports.length) {
            return res.json({ status: 'unconfigured', message: 'No ports configured for server' });
        }
        const portChecks = await Promise.all(
            ports.map(async (port) => {
                const check = await checkPort(port);
                return {
                    port,
                    ...check
                };
            })
        );

        const runningPort = portChecks.find((check) => check.running);

        if (runningPort) {
            return res.json({
                status: 'running',
                pid: runningPort.pid,
                port: runningPort.port,
                ports: portChecks
            });
        } else {
            return res.json({
                status: 'stopped',
                port: ports[0],
                ports: portChecks
            });
        }
    } catch (error) {
        res.json({ status: 'unknown', error: error.message });
    }
});

// Start server
app.post('/api/start', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' });
    }

    try {
        const servers = loadServers();
        const config = servers[url];

        if (!config) {
            return res.status(400).json({
                success: false,
                error: 'Server not configured. Please configure the server first.'
            });
        }

        // Free the port if anything else is running there
        const ports = getConfigPorts(config);
        if (!ports.length) {
            return res.status(400).json({
                success: false,
                error: 'No ports configured. Please add at least one port.'
            });
        }
        let freedPortInfo = [];
        try {
            freedPortInfo = await ensurePortsFree(ports);
        } catch (portError) {
            return res.status(500).json({
                success: false,
                error: portError.message
            });
        }

        // Check if directory exists
        if (!fs.existsSync(config.directory)) {
            return res.status(400).json({
                success: false,
                error: `Directory not found: ${config.directory}`
            });
        }

        const pid = launchServer(config, url);

        const replacementNote = freedPortInfo.length
            ? ` Replaced previous process(es) on port(s): ${freedPortInfo
                  .map((info) => `${info.port} (PID(s): ${info.pids.join(', ')})`)
                  .join(', ')}.`
            : '';

        res.json({
            success: true,
            message: `Server starting on port ${ports[0]}.${replacementNote}`,
            pid,
            replacedPorts: freedPortInfo
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Stop server
app.post('/api/stop', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' });
    }

    try {
        const servers = loadServers();
        const config = servers[url];

        if (!config) {
            return res.status(400).json({
                success: false,
                error: 'Server not configured'
            });
        }

        const ports = getConfigPorts(config);
        if (!ports.length) {
            return res.status(400).json({
                success: false,
                error: 'No ports configured. Please add at least one port.'
            });
        }
        const portChecks = await Promise.all(
            ports.map(async (port) => {
                const check = await checkPort(port);
                return {
                    port,
                    ...check
                };
            })
        );

        const runningPorts = portChecks.filter((check) => check.running);

        if (!runningPorts.length) {
            return res.json({
                success: false,
                error: 'Server is not running'
            });
        }

        // Kill the process
        try {
            for (const portInfo of runningPorts) {
                await killProcesses(portInfo.pids);
                await delay(200);
            }
            await delay(200);

            processes.delete(url);

            res.json({
                success: true,
                message: `Server stopped on port(s): ${runningPorts
                    .map((info) => `${info.port} (PID(s): ${info.pids.join(', ')})`)
                    .join(', ')}`,
                stoppedPorts: runningPorts.map((info) => ({
                    port: info.port,
                    pids: info.pids
                }))
            });
        } catch (killError) {
            res.json({
                success: false,
                error: `Failed to stop server: ${killError.message}`
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Restart server
app.post('/api/restart', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' });
    }

    try {
        const servers = loadServers();
        const config = servers[url];

        if (!config) {
            return res.status(400).json({
                success: false,
                error: 'Server not configured'
            });
        }

        const ports = getConfigPorts(config);
        if (!ports.length) {
            return res.status(400).json({
                success: false,
                error: 'No ports configured. Please add at least one port.'
            });
        }
        let freedPortInfo = [];
        try {
            freedPortInfo = await ensurePortsFree(ports);
        } catch (portError) {
            return res.status(500).json({
                success: false,
                error: portError.message
            });
        }

        if (!fs.existsSync(config.directory)) {
            return res.status(400).json({
                success: false,
                error: `Directory not found: ${config.directory}`
            });
        }

        const pid = launchServer(config, url);
        const action = freedPortInfo.length ? 'restarted' : 'started';
        const replacementNote = freedPortInfo.length
            ? ` Replaced previous process(es) on port(s): ${freedPortInfo
                  .map((info) => `${info.port} (PID(s): ${info.pids.join(', ')})`)
                  .join(', ')}.`
            : '';

        res.json({
            success: true,
            message: `Server ${action} on port ${ports[0]}.${replacementNote}`,
            pid,
            replacedPorts: freedPortInfo
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Deploymint Mini API running on http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`📝 Config file: ${configFile}`);
});
