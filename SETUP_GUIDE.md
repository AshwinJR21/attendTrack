# Attendance Tracker Setup Guide

This guide provides step-by-step instructions for setting up the Attendance Tracker project from scratch on a new system. It covers configuring external services (Google Cloud, Telegram, Tailscale) and running the application locally.

---

## 1. Prerequisites
Ensure you have the following installed on your system:
- **Python 3.8+**
- **Bun** (recommended) or **Node.js**
- **Git**

---

## 2. External Services Setup (From Scratch)

### A. Google Cloud Platform (GCP)
The project uses Google Sheets as a database and Google Drive for file management.

1.  **Create a Project**: Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a new project (e.g., `Attendance-Tracker`).
2.  **Enable APIs**: 
    - Search for and enable the **Google Sheets API**.
    - Search for and enable the **Google Drive API**.
3.  **Create a Service Account**:
    - Go to **IAM & Admin > Service Accounts**.
    - Click **Create Service Account**. Give it a name and click **Create and Continue**.
    - Skip role assignment (not strictly needed for Sheets/Drive as you will share specific sheets with the account email).
4.  **Generate a Key**:
    - Click on your new service account and go to the **Keys** tab.
    - Click **Add Key > Create New Key**. Select **JSON**.
    - Save the downloaded file as `credentials.json` in the `backend/` directory of this project.
5.  **Copy the Email**: Note the service account email (e.g., `service-account@project-id.iam.gserviceaccount.com`). You will need this to share sheets later.

### B. Discord Bot
1.  **Create an Application**:
    - Go to the [Discord Developer Portal](https://discord.com/developers/applications).
    - Click **New Application** and give it a name.
    - Go to the **Bot** tab and click **Reset Token** to get your **API Token**.
2.  **Enable Intents**:
    - Under the **Bot** tab, enable **Server Members Intent** and **Message Content Intent**.
3.  **Get Your IDs**:
    - In Discord Settings > Advanced, enable **Developer Mode**.
    - Right-click your server's WFH request channel and select **Copy Channel ID** (`REQUEST_CHANNEL_ID`).
    - Right-click the admin notification channel and select **Copy Channel ID** (`ADMIN_CHANNEL_ID`).
    - Right-click an admin's profile and select **Copy User ID** to add to `ADMIN_CHAT_ID`.

---

## 3. Backend Setup

1.  **Navigate to Backend**:
    ```bash
    cd backend
    ```
2.  **Create Virtual Environment**:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```
3.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```
4.  **Configure Environment Variables**:
    Create a `.env` file in the `backend/` directory:
    ```env
    DISCORD_TOKEN=your_discord_bot_token_here
    ADMIN_CHAT_ID=your_admin_user_id
    REQUEST_CHANNEL_ID=your_request_channel_id
    ADMIN_CHANNEL_ID=your_admin_channel_id
    GOOGLE_SERVICE_ACCOUNT_FILE=credentials.json
    ```
    *Note: Ensure `credentials.json` (the Google Service Account key) is in the `backend/` folder.*

---

## 4. Frontend Setup

1.  **Navigate to Frontend**:
    ```bash
    cd ../frontend
    ```
2.  **Install Dependencies**:
    ```bash
    bun install  # Or 'npm install'
    ```
3.  **Configure Environment**:
    Create a `.env` file in the `frontend/` directory (you can copy `.env.example` as a template):
    ```env
    VITE_API_BASE=http://localhost:5000
    ```

---

## 4b. Dashboard Setup

The Next.js interactive workforce analytics dashboard allows real-time status and timeline monitoring across your LAN.

1.  **Navigate to Dashboard**:
    ```bash
    cd ../dashboard
    ```
2.  **Install Dependencies**:
    ```bash
    bun install  # Or 'npm install'
    ```
3.  **LAN Environment Config**:
    No environment variables are required by default! The dashboard uses advanced dynamic hostname extraction to automatically resolve your laptop's API base URL when loaded in other office browsers.
    *Note: If you ever want to override it to a specific URL, you can create a `.env.local` file inside `dashboard/` and specify `NEXT_PUBLIC_API_URL=http://<TARGET_IP>:5000`.*

---



## 6. Running the Application

### Step 1: Start the Backend
```bash
cd backend
source venv/bin/activate
python app.py
```
The backend will run on `http://0.0.0.0:5000` and start the Discord bot in the background.

### Step 4: Start the Frontend
```bash
cd frontend
bun dev
```

### Step 5: Start the Dashboard (For LAN access)
```bash
cd dashboard
bun run dev -- --hostname 0.0.0.0 --port 3000
```
This runs the dashboard on your LAN at `http://<LAPTOP_LAN_IP>:3000` with automatic dynamic resolution of the backend.

### Running Headless Background Services (Systemd Kiosk Mode)
If you want to run the application 24/7 on an Ubuntu laptop in the background (where the laptop screen only displays the punch-in/out frontend, and the dashboard/backend run in the background):

1.  **Register the background systemd services**:
    Copy all `.service` files to the system folder:
    ```bash
    sudo cp service_files/*.service /etc/systemd/system/
    ```
2.  **Enable and Start Services**:
    Reload the systemd manager, enable them to launch automatically on system boot, and start them:
    ```bash
    sudo systemctl daemon-reload
    sudo systemctl enable atbe atfe atdb
    sudo systemctl start atbe atfe atdb
    ```
3.  **Check Service Statuses**:
    Verify that all services are fully active:
    ```bash
    sudo systemctl status atbe atfe atdb
    ```
    *Now the backend, frontend kiosk, and LAN dashboard are running 24/7 in the background!*

---

## 7. Migrating to Another Laptop (Important Files & Git Pull)

When setting up your workforce system on the second Ubuntu laptop, follow this guide to pull changes and copy secrets securely.

### A. What to do BEFORE doing a `git pull`
Since `.env`, `credentials.json`, and `id_cache.json` are listed in `.gitignore` on both `dashboard` and `main` branches, **Git will never touch, delete, or overwrite your local configuration files** when running a pull!

However, as a standard security best practice, make sure you copy or backup these three critical configuration files from your old machine:
1.  **`backend/.env`**: Contains all your API tokens and Telegram bot configurations.
2.  **`backend/credentials.json`**: Your Google service account JSON key file.
3.  **`backend/id_cache.json`** (Optional): Holds cached Google Sheet spreadsheet/folder IDs. If missing, the backend will automatically search your Google Drive to locate the sheets, but carrying this file saves API calls!

### B. Performing the Git Pull (Which branch to pull?)
You must pull from the **`main`** branch! We have successfully merged all upgrades, consolidated directories, zero-configuration LAN dashboard endpoints, and headless background services into the primary `main` branch. It is now your stable source of truth.

On the other laptop, open a terminal in the root project folder and run:
```bash
# 1. Switch to the main branch
git checkout main

# 2. Pull the latest unified changes
git pull origin main
```

---

## 8. Troubleshooting
- **Port 5000 busy**: Run `lsof -i :5000` to find the PID and `kill -9 <PID>` to clear it.
- **Missing `cordova.variables.gradle` error**: If Android Studio says it can't find `cordova.variables.gradle`, it means you haven't run the sync command yet. Run `npm run build` followed by `npx cap sync` in the `frontend/` directory.
- **`unknown host: dl.google.com` error**: This is a network issue. Ensure you are connected to the internet and that Android Studio is NOT in "Offline Mode" (check the Gradle tab on the right). If you are on a restricted network, you may need to configure the HTTP Proxy in Android Studio Settings.
- **Google API Errors**: Double-check that the Service Account has been given permission to edit the target Google Sheet if you didn't let the script auto-create them.
- **Webhook Issues**: Ensure your backend URL is accessible via HTTPS (Tailscale Funnel handles this).
