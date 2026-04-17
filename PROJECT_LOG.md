# Attendance Tracker: Evolution & Historical Log

This document serves as a comprehensive record of the development, experimentation, and stabilization of the Attendance Tracker project. It tracks every major architectural decision, breaking point, and eventual solution.

---

## 📅 Project Timeline & Milestones

### Phase 1: Porting to Mobile (Capacitor Migration)
*   **Goal**: Transform a React/Flask web application into a standalone Android APK.
*   **Action**: Integrated **Capacitor** into the frontend. Configured Android Studio to build and deploy the application to physical devices.
*   **Breaking Point**: UI scaling. The initial web design did not account for fixed tablet viewports, leading to the creation of the `applyZoom` logic in `index.html` to ensure a consistent 1250x900 view.

### Phase 2: The Timezone Resolution (IST Enforcement)
*   **Goal**: Sync the Google Sheets logging with local India Standard Time (IST).
*   **Action**: Identified a consistent 5.5-hour UTC offset in the logs.
*   **Breaking Point**: Server-side vs. Client-side time. We refactored `sheets_service.py` and the midnight rollover task to strictly enforce `Asia/Kolkata` time, ensuring the "minutes worked" calculations were historically accurate.

### Phase 3: The Offline-First Experiment
*   **Goal**: Support attendance logging in areas with unstable Wi-Fi.
*   **Action**: Implemented a complex `localStorage` queue in `App.tsx` and a background sync worker. Modified the Telegram bot and Flask backend to accept historical (manual) timestamps.
*   **Breaking Point**: Synchronization Conflict. The complexity of managing "pending" states and ensuring historical time didn't conflict with current sheet logic created significant overhead and potential data duplication risks.

### Phase 4: The Great Rollback
*   **Goal**: Simplify the codebase for immediate deployment by returning to a pure online-only state.
*   **Action**: Systematically removed all offline queuing logic, background workers, and historical timestamp parameters from both frontend and backend. 
*   **Breaking Point**: Code Integrity. Reverting multiple non-contiguous files while maintaining functionality required a full reconciliation of the `sheets_service.py` and `app.py` logic to ensure standard `datetime.now()` calls were restored.

### Phase 5: The Connectivity Crisis (Network Debugging)
*   **Goal**: Connect the office tablet to the laptop's backend via Mobile Hotspot.
*   **Action**: Attempted direct IP connection over `http`.
*   **Breaking Point 1 (Firewall)**: Discovered that Fedora's `firewalld` (and previously presumed `ufw`) was blocking incoming connections on port 5000 from the `10.x.x.x` and `192.x.x.x` subnets.
*   **Breaking Point 2 (Mixed Content)**: Discovered that modern Android WebViews block insecure HTTP requests if the UI is served via an HTTPS frame. This led to the discovery of the "Mixed Content" error via Remote Debugging.

### Phase 6: Final Stabilization (Tailscale & WebView Overrides)
*   **Goal**: Establish a permanent, secure connection that survives IP changes and security blocks.
*   **Action 1 (Tailscale)**: Deployed a private overlay network (Tailnet) to give the laptop a static IP (`100.83.250.58`).
*   **Action 2 (WebView Security)**: Modified `MainActivity.java` to explicitly allow `MIXED_CONTENT_ALWAYS_ALLOW` and created a `network_security_config.xml` to permit cleartext traffic.
*   **Outcome**: The APK now connects instantly to the laptop regardless of the physical Wi-Fi network, provided Tailscale is active on both devices.

---

## 🛠️ Core Technology Stack

*   **Frontend**: React, Vite, TypeScript, Capacitor.
*   **Backend**: Flask (Python), Google Sheets API V4.
*   **Networking**: Tailscale (WireGuard), Android WebView Security Overrides.
*   **Automation**: Custom Python-based midnight scheduler for daily log maintenance.

---

## 📝 Lessons for Future Maintenance

1.  **IP Persistence**: Always prioritize a static IP (Tailscale or Static DHCP) to avoid breaking the APK build.
2.  **WebView Restrictions**: Android 14+ is extremely strict with non-HTTPS traffic. The `MainActivity.java` override is a required component for local development.
3.  **IST Synchronization**: Any future logic updates must use the `get_ist_now()` helper in `sheets_service.py` to maintain log consistency.

---
*Last Updated: 2026-04-17*
