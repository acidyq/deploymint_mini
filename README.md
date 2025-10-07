# 🚀 Deploymint Mini

A minimal, no-frills process manager for Node.js applications.

## Features

- ✨ **Simple & Clean UI** - No authentication, no complex features
- 🔄 **Start/Stop/Restart** - Manage Node.js processes with one click
- 📊 **Real-time Status** - See if your servers are running or stopped
- ⚙️ **Easy Configuration** - Just specify directory, command, and port
- 💾 **Persistent** - Configurations saved to `servers.json`
- 🎯 **Zero Dependencies** - Works with native Node.js

## Quick Start

```bash
cd _deploymint_mini

# Install dependencies
npm install

# Start server
npm start
```

Access at: **http://localhost:4000**

## Usage

### 1. Add Your Server

- **Server Name**: Give it a name (e.g., "PasteBeam Downloader")
- **Server URL**: The URL it will run on (e.g., "http://localhost:3000")
- Click **"Add Server"**

### 2. Configure Your Server

Click the **⚙ (Configure)** button and enter:

- **Project Directory**: Full path to your project
  ```
  /Users/you/projects/pastebeam-downloader
  ```

- **Start Command**: Command to start your server
  ```
  npm start
  ```
  or
  ```
  node server.js
  ```

- **Port**: Port your server runs on
  ```
  3000
  ```

Click **"Save Configuration"**

### 3. Manage Your Server

- **Start** - Start the process
- **Stop** - Stop the process
- **Restart** - Restart the process
- **⚙** - Reconfigure
- **✕** - Remove from list

## Example: PasteBeam Downloader

**Configuration:**
- Directory: `/Users/you/projects/pastebeam_downloader`
- Command: `npm start`
- Port: `3000`

Once configured, click **Start** and your server will run in the background!

## Status Indicators

- 🟡 **unconfigured** - Needs configuration
- 🟢 **running** - Process is running (shows PID)
- 🔴 **stopped** - Process is stopped
- ⚪ **unknown** - Status unknown

## How It Works

1. **Configuration**: Saves your server settings to `servers.json`
2. **Starting**: Spawns a detached process using your command
3. **Status Check**: Uses `lsof` to check if port is in use
4. **Stopping**: Sends SIGTERM to the process PID

## API Endpoints

- `GET /api/status?url=<url>` - Check process status
- `POST /api/start` - Start process
- `POST /api/stop` - Stop process
- `POST /api/restart` - Restart process
- `GET /api/server-config?url=<url>` - Get server config
- `POST /api/server-config` - Save server config

## Configuration File

Server configurations are saved in `_deploymint_mini/servers.json`:

```json
{
  "http://localhost:3000": {
    "directory": "/path/to/project",
    "command": "npm start",
    "port": 3000
  }
}
```

## Requirements

- Node.js 18+
- macOS or Linux (uses `lsof` for port checking)

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Node.js, Express
- **Process Management**: Node.js `child_process`
- **Storage**: JSON file

## Notes

- Processes run detached in the background
- Starting a server automatically frees the configured port by terminating any process already bound to it
- Server data persisted to `servers.json`
- The app itself must stay running to manage servers
- Use pm2 or similar to keep Deploymint Mini running in production

## License

MIT
