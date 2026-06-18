# AttendTrack 🚀

AttendTrack is a modern, full-stack attendance tracking system designed for small to medium-sized teams. It features a vibrant, mobile-optimized web application and a seamlessly integrated Discord Bot for Work From Home (WFH) management.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

---

## 🌟 Key Features

- **Dynamic UI**: A beautiful, responsive React dashboard with progress rings and one-touch logging.
- **Discord Bot Integration**: Employees can clock IN/OUT and request WFH directly from Discord.
- **Auto-Hierarchical Storage**: Logic that automatically organizes attendance data into Yearly Books and Monthly Sheets in Google Drive.
- **Smart Rollover**: An automated midnight rollover system that manages multi-day work sessions accurately.
- **Centralized Master List**: A single source of truth for employee data and WFH approvals.

---

## 🏗️ System Architecture

AttendTrack follows a three-tier architecture:
1. **Frontend**: React + Vite + TypeScript (Mobile-first design).
2. **Backend**: Flask API + Python (Core business logic).
3. **Storage**: Google Drive API + Google Sheets (The "Database").
4. **Integration**: Discord Bot API (WFH Management).

---

## 🚀 Getting Started

### 📋 Prerequisites
- Python 3.10+
- Node.js & Bun (or NPM)
- A Google Cloud Project with Sheets and Drive APIs enabled.
- A Discord Bot Token (from Discord Developer Portal).

### 🛠️ Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/AshwinJR21/attendTrack.git
   cd attendTrack
   ```

2. **Backend Setup**:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```
   - Create a `.env` file based on `.env.example`.
   - Place your Google Service Account JSON in the `backend/` folder.

3. **Frontend Setup**:
   ```bash
   cd ../frontend
   bun install  # or npm install
   ```

### ⚙️ Google Drive Configuration
1. Create a folder in your Google Drive named **`Attendance`**.
2. Share this folder with your Google Service Account email (as Editor).
3. Inside this folder, create a spreadsheet named **`Employee_Master`**.
4. The system will automatically handle the rest!

---

## 📖 Directory Guides

Feel free to explore the detailed documentation for each component:
- [Backend Documentation](./backend/README.md)
- [Frontend Documentation](./frontend/README.md)

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](./LICENSE) file for details.

---

## ✨ Credits

Developed with ❤️ by Harish and Ashwin, at Angles3D.
