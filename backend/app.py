import threading
import time
from datetime import datetime, timedelta

from flask import Flask, request, jsonify
from flask_cors import CORS

from sheets_service import (
    append_attendance,
    get_active_employees,
    get_all_statuses_bulk,
    get_employee_current_status,
    get_current_sheet_name,
    midnight_rollover,
    compute_daily_minutes,
    get_ist_now,
    cancel_wfh_for_date,
    cleanup_expired_wfh,
)
from telegram_bot import handle_webhook

app = Flask(__name__)
CORS(app)


# =========================
# MIDNIGHT SCHEDULER
# Background daemon thread that sleeps until midnight, fires
# midnight_rollover(), then sleeps again until the next midnight.
# =========================
def _midnight_scheduler():
    while True:
        now = get_ist_now()
        # Next midnight = start of tomorrow
        tomorrow_midnight = (now + timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        wait_seconds = (tomorrow_midnight - now).total_seconds()
        print(f"[Scheduler] Next midnight rollover in "
              f"{int(wait_seconds // 3600)}h "
              f"{int((wait_seconds % 3600) // 60)}m "
              f"{int(wait_seconds % 60)}s  "
              f"(at {tomorrow_midnight.strftime('%Y-%m-%d %H:%M:%S')})")
        time.sleep(wait_seconds)
        try:
            midnight_rollover()
        except Exception as e:
            import traceback
            print("[Scheduler] ERROR during midnight rollover:")
            traceback.print_exc()


# =========================
# GET ACTIVE EMPLOYEES + CURRENT STATUS
# =========================
@app.route("/employees", methods=["GET"])
def employees():
    try:
        active_employees = get_active_employees()
        sheet_name = get_current_sheet_name()

        # Fetch all statuses in a SINGLE API call instead of one per employee
        status_map = get_all_statuses_bulk(sheet_name)

        for emp in active_employees:
            info = status_map.get(emp["id"], {"status": "OUT", "since": "", "location": "Office"})
            emp["current_status"] = info["status"]
            emp["since"] = info["since"]
            emp["location"] = info.get("location", "Office")

        return jsonify({"employees": active_employees})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# =========================
# ATTENDANCE — append a log row on every tap
# Expects: { employee_id, employee_name, action ("in" | "out") }
# Writes:  [emp_id, name, timestamp, "IN"/"OUT", "Office"]
# =========================
@app.route("/attendance", methods=["POST"])
def attendance():
    data = request.json
    emp_id   = data.get("employee_id")
    emp_name = data.get("employee_name", "")
    action   = data.get("action", "").lower()

    if not emp_id or action not in ("in", "out"):
        return jsonify({"message": "Missing or invalid employee_id / action"}), 400

    sheet_name = get_current_sheet_name()
    tag        = action.upper()
    location   = data.get("location", "Office")

    try:
        timestamp = append_attendance(emp_id, emp_name, tag, location, sheet_name)
        
        # WFH Cancellation Policy: If IN at Office, cancel any approved WFH for today
        if tag == "IN" and location == "Office":
            today_str = get_ist_now().strftime("%Y-%m-%d")
            cancel_wfh_for_date(emp_id, today_str)
            
    except ValueError as ve:
        return jsonify({"message": str(ve)}), 400
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"message": f"Server Error: {str(e)}"}), 500

    return jsonify({
        "message": f"Checked {tag} at {timestamp}",
        "current_status": tag,
        "timestamp": timestamp,
    })


# =========================
# DAILY MINUTES — total completed minutes worked per employee
# GET /daily-minutes?dates=YYYY-MM-DD,YYYY-MM-DD,...
# Returns {"YYYY-MM-DD": {"emp_id": minutes, ...}, ...}
# Excludes ongoing sessions; frontend adds live minutes for IN employees.
# =========================
@app.route("/daily-minutes", methods=["GET"])
def daily_minutes():
    dates_param = request.args.get("dates", "")
    if not dates_param:
        return jsonify({"error": "dates parameter required"}), 400
    dates = [d.strip() for d in dates_param.split(",") if d.strip()]
    result = {}
    for date_str in dates:
        try:
            result[date_str] = compute_daily_minutes(date_str)
        except Exception:
            import traceback
            traceback.print_exc()
            result[date_str] = {}
    return jsonify(result)


# =========================
# TEST ENDPOINT — trigger midnight rollover manually
# =========================
@app.route("/test-rollover", methods=["GET"])
def test_rollover():
    try:
        midnight_rollover()
        return jsonify({"message": "Midnight rollover executed. Check server logs and Google Sheet."})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/test-cleanup", methods=["GET"])
def test_cleanup():
    try:
        cleanup_expired_wfh()
        return jsonify({"message": "WFH expiration cleanup executed manually. Check server logs."})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# =========================
# TELEGRAM WEBHOOK
# =========================
@app.route("/telegram/webhook", methods=["POST"])
def telegram_webhook():
    try:
        update = request.json
        if update:
            handle_webhook(update)
        return "OK", 200
    except Exception as e:
        print(f"[Telegram Webhook] Error: {e}")
        return "ERROR", 500


if __name__ == "__main__":
    # Start the midnight scheduler in a background daemon thread.
    # use_reloader=False prevents Flask debug mode from spawning a second
    # process (which would create duplicate scheduler threads).
    scheduler = threading.Thread(target=_midnight_scheduler, daemon=True, name="MidnightScheduler")
    scheduler.start()
    print("[App] Midnight scheduler started.")
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)