# AttendTrack Backend 🐍

The backend is a lightweight yet powerful Flask API that serves as the bridge between the UI, the Telegram Bot, and the Google Sheets storage layer.

## 📂 Core Components

### 1. `sheets_service.py` (The Engine)
This module contains the primary business logic. It handles:
- **Zero-Config Discovery**: Automatically finds the "Attendance" folder and resolves the correct spreadsheet IDs based on the current year.
- **Hierarchical Logging**: Logs into sheets named `Month_Activity_Log` inside `Attendance_YYYY` books.
- **State Management**: Real-time status lookup and WFH approval verification.

### 2. `telegram_bot.py` (The Bot Manager)
Manages all interactions with the Telegram Bot API:
- **Registration**: `/register <EMP_ID>` binds a Telegram ID to an employee name.
- **On-the-go Logging**: `/in` and `/out` commands for remote workers.
- **WFH Requests**: Handles the round-trip approval flow between employees and admins.

### 3. `app.py` (The API Layer)
Exposes RESTful endpoints for the frontend and webhooks for Telegram:
- `GET /employees`: Fetches active employees.
- `POST /attendance`: Processes clock-in/out requests.
- `GET /daily-minutes`: Calculates hours worked in real-time.
- `POST /telegram/webhook`: The main ingestion point for bot updates.

---

## 🕒 Automated Scheduler

AttendTrack features a background scheduler that triggers at **00:00:00 IST** daily:
- **Midnight Rollover**: Automatically checks out any employees still clocked in from the previous day and checks them back in on the new day/book to ensure daily reporting accuracy.

---

## 🛠️ Security

All sensitive data is handled via Environment Variables:
- `TELEGRAM_TOKEN`: Your secret bot token.
- `ADMIN_CHAT_ID`: Your Telegram ID (for approval notifications).
- `GOOGLE_SERVICE_ACCOUNT_FILE`: Path to your service account JSON.

---

## 📜 Requirements
- `Flask`: API Framework.
- `google-api-python-client`: Drive & Sheets interaction.
- `python-dotenv`: Secure configuration.
- `apscheduler`: Managing time-based rollovers.
