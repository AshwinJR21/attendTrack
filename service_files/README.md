# Attendance Tracker Service Setup Guide

This directory contains the systemd service files required to run the Attendance Tracker project 24/7 on an Ubuntu system. These services ensure that the backend, frontend, and Tailscale funnel start automatically upon system boot and restart themselves if they ever crash.

## Services Overview

1.  **`atbe.service` (Backend)**:
    - Runs the Flask Python application.
    - Uses the project's virtual environment.
    - Restarts automatically on failure.
2.  **`atfe.service` (Frontend)**:
    - Runs the Vite development server using `bun`.
    - Configured to wait for the backend to be ready before starting.
3.  **`atfun.service` (Tailscale Funnel)**:
    - Automatically runs `tailscale funnel 5000` on boot.
    - Ensures your backend port is exposed externally via Tailscale.
4.  **`atbrowser.service` (Browser Autostart)**:
    - Opens Firefox in fullscreen on `localhost:5173`.
    - Waits for the frontend and graphical session to be ready.

---

## Installation Instructions

Follow these steps once to set up the services:

> [!IMPORTANT]
> Before copying, open the `.service` files and replace the following:
> - `<PROJECT_ROOT>`: Full path to your project (e.g., `/home/ashwin/Desktop/attendance-tracker`).
> - `<YOUR_USERNAME>`: Your system username (run `whoami`).
> - `<PATH_TO_BUN>`: Path to bun (run `which bun`).

### 1. Copy Service Files
Copy the service files to the system-wide service directory:
```bash
sudo cp atbe.service atfe.service atfun.service atbrowser.service /etc/systemd/system/
```

### 2. Enable Services
This tells Ubuntu to start these services automatically on every boot:
```bash
sudo systemctl daemon-reload
sudo systemctl enable atbe
sudo systemctl enable atfe
sudo systemctl enable atfun
sudo systemctl enable atbrowser
```

### 3. Start Services
Trigger the services to start right now without rebooting:
```bash
sudo systemctl start atbe
sudo systemctl start atfe
sudo systemctl start atfun
sudo systemctl start atbrowser
```

---

## Verification & Monitoring

### Check if they are running:
```bash
systemctl status atbe
systemctl status atfe
systemctl status atfun
systemctl status atbrowser
```
- **Healthy Status**: `active (running)` for Backend/Frontend, and `active (exited)` for Funnel (which is normal).

### View live logs:
If you want to see what's happening in real-time (useful for debugging):
```bash
journalctl -u atbe -f
journalctl -u atfe -f
```

---

## Updating the Code (`git pull`)

If you pull new changes from the repository, you must restart the services to apply them:
```bash
sudo systemctl restart atbe
sudo systemctl restart atfe
```
*(The funnel does not need to be restarted unless you change the port).*

---

## Troubleshooting

- **Permissions**: Ensure your user has ownership of the project directory.
- **Port Conflicts**: Ensure no other process is already using port 5000 or 5173.
- **Tailscale**: Ensure Tailscale is logged in and active (`tailscale status`).
