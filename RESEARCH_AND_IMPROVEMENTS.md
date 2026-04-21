# Attendance Tracker: System Analysis & Improvement Roadmap

This document provides a comprehensive breakdown of the testing landscape, identifies potential edge cases not yet covered by the implementation, and proposes architectural improvements for the Attendance Tracker system.

---

## 1. Test Checklist & Verified Edge Cases
These are the scenarios currently handled by the backend logic as of the latest updates.

### **State & Logic Tests**
- [x] **Normal Flow**: IN -> OUT (Success).
- [x] **Double IN Protection**: IN -> IN (Rejected with Error).
- [x] **Double OUT Protection**: OUT -> OUT (Rejected with Error).
- [x] **Location Mismatch**: IN (Home/Telegram) -> OUT (Office) (Rejected with Error).
- [x] **Initial State**: First punch as OUT (Rejected with "Already OUT").
- [x] **Cross-Platform Sync**: IN (Bot) -> IN (App) (Rejected).

### **Midnight Rollover (Overnight Sessions)**
- [x] **Daily Reset**: At 23:59, check-out anyone still IN.
- [x] **Session Continuity**: At 00:00, check-in those same people on the new sheet.
- [x] **Location Preservation**: Rollover preserves the original punch location (Home/Office).
- [x] **Year/Month Transition**: Rollover creates the new monthly sheet if the date crosses into a new month.

### **Telegram Integration**
- [x] **Employee Registration**: Link Telegram ID to Employee ID.
- [x] **WFH Approval Guard**: Bot punches only work if WFH is approved for the current date.
- [x] **Admin Approval Flow**: Admin can approve/reject WFH requests from Telegram using replies.

---

## 2. Brainstorming: Untapped Edge Cases (Vulnerabilities)
These are scenarios for which the system may not yet have robust error handling or preventative logic.

### **A. API & Infrastructure Limits**
- **Google Sheets Rate Limits**: The API has a limit of 60 requests per minute. If a large team (e.g., 100+ employees) all punch IN at exactly 9:00 AM, some requests may fail with a `429 Too Many Requests`.
- **Concurrent Request Race Condition**: If an employee triggers an "IN" punch from the Telegram Bot and the App at the exact same millisecond, the `get_rows` call for both might return `OUT`, resulting in two `IN` rows being appended because the first one wasn't committed yet.
- **Service Account Permissions**: If the Google Spreadsheet is moved out of the shared folder or permissions are revoked, the backend will return unhandled `500` errors.

### **B. Data Integrity**
- **Manual Sheet Edits**: If an admin manually deletes a row or changes a timestamp format in the Google Sheet, the `compute_daily_minutes` or `get_employee_last_punch` functions may crash due to `ValueError` or `IndexError`.
- **Duplicate Employee IDs**: The system currently assumes Employee IDs are unique. If the Master Sheet has duplicates, behavior is undefined (likely picks the first match in `get_active_employees`).
- **Timezone Drift**: The server uses `IST_TZ`. If the server hosting the backend has a drifting system clock, timestamps might go out of sync with the intended IST schedule.

### **C. Behavioral Edge Cases**
- **WFH Request Expiry**: What happens if an employee punches IN via Telegram *before* the admin approves? (Currently rejected, but should there be a "Pending" state?).
- **Reverse Rollover**: If the server is down at midnight, the rollover scheduler will miss the trigger. There is currently no logic to "catch up" on missed rollovers when the server restarts.

---

## 3. Recommended System Improvements

### **Phase 1: Security & Verification**
1. **Geolocation Tracking**: 
   - Require the mobile app to send GPS coordinates for "Office" punches to ensure the employee is physically present.
   - For "Home" punches, verify the radius is within a reasonable distance from their registered home address.
2. **Device Locking**: Link an employee ID to a specific device ID (UUID) to prevent one person from punching in for multiple colleagues on their phone.
3. **Biometric Authentication**: Integrate native Face ID / Fingerprint checks via Capacitor before a punch is accepted.

### **Phase 2: Reliability & Performance**
1. **Request Queueing (Redis/SQL)**: Instead of writing directly to Google Sheets on every request, write to a local fast database or queue. A background worker can then sync to Google Sheets, handling rate limits and retries gracefully.
2. **WebSockets for Live Updates**: Currently, the frontend polls every 60 seconds. Switching to WebSockets or SSE would make the status lights change instantly for all users when anyone punches.
3. **Offline Mode**: Allow the app to store a "Pending Punch" locally if there is no internet, and sync it automatically once connectivity is restored (using the original captured timestamp).

### **Phase 3: User Experience & Reporting**
1. **Admin Dashboard**: A dedicated view for admins to see current attendance percentage, latecomers, and pending WFH requests in a single view.
2. **Automated Reports**: Weekly PDF summaries sent to HR/Admin emails with total hours worked, overtime, and missing punch-outs.
3. **Push Notifications**: Notify employees via Telegram at 10:00 AM if they haven't punched IN, or at 7:00 PM if they are still IN.

### **Phase 4: Logic Refinement**
1. **Break/Lunch Mode**: Add a "LUNCH" state to pause the workday timer without fully punching OUT.
2. **Shift Logic**: Support predefined shifts (e.g., 9-5 vs 2-10) and flag "Late Arrival" or "Early Departure" in the logs.
