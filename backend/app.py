import threading
import time
from datetime import datetime, timedelta

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import queue
from event_bus import clients, notify_clients

from sheets_service import (
    append_attendance,
    get_active_employees,
    get_all_statuses_bulk,
    get_employee_current_status,
    get_current_sheet_name,
    midnight_rollover,
    compute_daily_minutes,
    get_ist_now,
    has_approved_wfh,
    cancel_wfh_for_date,
    cleanup_expired_wfh,
    get_earliest_record_date,
    get_sessions_bulk,
    get_range_stats_bulk,
    get_heatmap_data_bulk,
    validate_credentials,
    generate_auth_otp,
    reset_user_password,
    get_pending_wfh_requests,
    update_wfh_status,
    batch_update_wfh_statuses,
    get_active_employees,
)
from telegram_bot import handle_webhook

app = Flask(__name__)
CORS(app)


def verify_role_authorized(requester_id, allowed_roles=["admin", "manager"]):
    """Helper to verify if a requester has administrative clearance."""
    if not requester_id:
        return False, "Requester ID is required for authentication"
        
    from sheets_service import get_user_by_identifier
    user = get_user_by_identifier(requester_id)
    if not user:
        return False, f"Requester '{requester_id}' not found in employee records"
        
    if user.get("role") not in allowed_roles:
        return False, f"Access denied: Role '{user.get('role')}' is unauthorized"
        
    return True, user





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
        # Filter out invisible employees from the visible tracking lists
        visible_employees = [emp for emp in active_employees if emp.get("status") == "active"]
        
        sheet_name = get_current_sheet_name()

        # Fetch all statuses in a SINGLE API call instead of one per employee
        status_map = get_all_statuses_bulk(sheet_name)
        today = get_ist_now().date()

        for emp in visible_employees:
            info = status_map.get(emp["id"], {"status": "OUT", "since": "", "location": "Office"})
            emp["current_status"] = info["status"]
            emp["since"] = info["since"]
            emp["location"] = info.get("location", "Office")
            # Check for approved WFH today
            emp["has_wfh"] = has_approved_wfh(today, emp_id=emp["id"])

        return jsonify({"employees": visible_employees})
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
        notify_clients()

            
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
    # Handle kiosk dates query parameter backward compatibility
    dates_str = request.args.get("dates")
    if dates_str:
        try:
            from sheets_service import compute_daily_minutes
            dates = [d.strip() for d in dates_str.split(",") if d.strip()]
            result = {}
            for d in dates:
                result[d] = compute_daily_minutes(d)
            return jsonify(result)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({"error": str(e)}), 500

    # Handle dashboard bulk heatmap data
    end_date = get_ist_now().strftime("%Y-%m-%d")
    start_date = (get_ist_now() - timedelta(days=365)).strftime("%Y-%m-%d")
    
    # Check for overrides
    start_override = request.args.get("start")
    end_override = request.args.get("end")
    if start_override: start_date = start_override
    if end_override: end_date = end_override
    
    try:
        result = get_heatmap_data_bulk(start_date, end_date)
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# =========================
# SESSIONS — timeline data for dashboard
# GET /sessions?date=YYYY-MM-DD
# Returns {emp_id: [session, ...]}
# =========================
@app.route("/sessions", methods=["GET"])
def sessions():
    date_str = request.args.get("date", "")
    if not date_str:
        date_str = get_ist_now().strftime("%Y-%m-%d")
    try:
        result = get_sessions_bulk(date_str)
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# =========================
# RANGE STATS — aggregated data for dashboard (week, month, etc.)
# GET /range-stats?start=YYYY-MM-DD&end=YYYY-MM-DD
# Returns {emp_id: {work_mins, break_mins, in_sessions, out_sessions, office_days, wfh_days}}
# =========================
@app.route("/range-stats", methods=["GET"])
def range_stats():
    start_date = request.args.get("start", "")
    end_date = request.args.get("end", "")
    if not start_date or not end_date:
        return jsonify({"error": "start and end parameters required"}), 400
    try:
        result = get_range_stats_bulk(start_date, end_date)
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# =========================
# EARLIEST DATE — returns the first ever recorded date
# =========================
@app.route("/earliest-date", methods=["GET"])
def earliest_date():
    try:
        date_str = get_earliest_record_date()
        return jsonify({"earliest_date": date_str})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


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
# SSE STREAM
# =========================
@app.route("/stream")
def stream():
    def event_stream():
        q = queue.Queue(maxsize=10)
        clients.append(q)
        try:
            while True:
                msg = q.get()
                yield f"data: {msg}\n\n"
        except GeneratorExit:
            pass
        finally:
            if q in clients:
                clients.remove(q)
                
    return Response(event_stream(), mimetype="text/event-stream")


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


# =========================
# AUTH ROUTES
# =========================

@app.route("/api/auth/check-role", methods=["GET"])
def check_role():
    identifier = request.args.get("identifier", "").strip()
    if not identifier:
        return jsonify({"error": "Identifier required"}), 400
        
    employees = get_active_employees()
    identifier_low = identifier.lower()
    
    user = None
    print(f"[Auth] Checking identifier: '{identifier}'")
    for emp in employees:
        if emp['id'] == identifier or emp['name'].lower() == identifier_low:
            user = emp
            break
            
    if not user:
        print(f"[Auth] User not found: '{identifier}'")
        return jsonify({"error": "User not found"}), 404
        
    print(f"[Auth] Found user: {user['name']} ({user['role']})")
        
    return jsonify({
        "id": user['id'],
        "name": user['name'],
        "role": user['role'],
        "login_allowed": user['role'] in ['admin', 'manager', 'employee']
    })

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json()
    identifier = data.get("identifier")
    password = data.get("password")
    
    if not identifier or not password:
        return jsonify({"error": "Identifier and password required"}), 400
        
    success, result = validate_credentials(identifier, password)
    if success:
        return jsonify({"success": True, "user": result})
    else:
        return jsonify({"error": result}), 401

@app.route("/api/auth/request-otp", methods=["POST"])
def request_otp():
    data = request.get_json()
    identifier = data.get("identifier")
    
    if not identifier:
        return jsonify({"error": "Identifier required"}), 400
        
    success, result = generate_auth_otp(identifier)
    if success:
        return jsonify({"success": True, "data": result})
    else:
        return jsonify({"error": result}), 403

@app.route("/api/auth/verify-otp", methods=["POST"])
def verify_otp_route():
    data = request.get_json()
    user_id = data.get("user_id")
    otp = data.get("otp")
    
    if not user_id or not otp:
        return jsonify({"error": "User ID and OTP required"}), 400
        
    from sheets_service import _cache_get
    cached_otp = _cache_get(f"otp:{user_id}")
    if cached_otp and cached_otp == otp:
        return jsonify({"success": True})
    else:
        return jsonify({"error": "Invalid or expired OTP"}), 401

@app.route("/api/auth/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json()
    user_id = data.get("user_id")
    otp = data.get("otp")
    new_password = data.get("new_password")
    
    if not user_id or not otp or not new_password:
        return jsonify({"error": "Missing fields"}), 400
        
    success, result = reset_user_password(user_id, otp, new_password)
    if success:
        return jsonify({"success": True, "message": result})
    else:
        return jsonify({"error": result}), 400

# =========================
# WFH REQUEST MANAGEMENT
# =========================

@app.route("/api/requests", methods=["GET"])
def get_requests():
    status = request.args.get("status", "pending")
    requester_id = request.args.get("requester_id", "").strip()
    
    is_authorized, auth_msg = verify_role_authorized(requester_id, allowed_roles=["admin", "manager"])
    if not is_authorized:
        return jsonify({"error": auth_msg}), 403
        
    try:
        requests = get_pending_wfh_requests(status_filter=status)
        return jsonify({"requests": requests})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/requests/action", methods=["POST"])
def handle_request_action():
    data = request.get_json() or {}
    action = data.get("action") # "approve", "reject", "approve_all", "reject_all"
    request_data = data.get("request") # The specific request object for single actions
    requester_id = data.get("requester_id", "").strip()
    
    is_authorized, auth_msg = verify_role_authorized(requester_id, allowed_roles=["admin"])
    if not is_authorized:
        return jsonify({"error": auth_msg}), 403
        
    try:
        if action in ["approve", "reject", "pending"]:
            if not request_data:
                return jsonify({"error": "Request data missing"}), 400
                
            status = action if action == "pending" else ("approved" if action == "approve" else "rejected")
            update_wfh_status(
                request_data['tg_id'], 
                request_data['from'], 
                request_data['to'], 
                status
            )
            
            # Notify user via Telegram (only for final decisions)
            if action != "pending":
                from telegram_bot import send_message
                emoji = "🎉" if status == "approved" else "😔"
                msg = f"{emoji} Your WFH request from {request_data['from']} to {request_data['to']} has been {status.upper()}."
                send_message(request_data['tg_id'], msg)
            
            return jsonify({"success": True, "message": f"Request status set to {status}"})
            
        elif action in ["approve_all", "reject_all"]:
            pending = get_pending_wfh_requests()
            if not pending:
                return jsonify({"message": "No pending requests"}), 200
                
            status = "approved" if action == "approve_all" else "rejected"
            batch_update_wfh_statuses(pending, status)
            
            # Notify users in background
            from telegram_bot import send_message
            for req in pending:
                emoji = "🎉" if status == "approved" else "😔"
                msg = f"{emoji} Your WFH request from {req['from']} to {req['to']} has been {status.upper()}."
                send_message(req['tg_id'], msg)
                
            return jsonify({"success": True, "message": f"All requests {status}"})
            
        else:
            return jsonify({"error": "Invalid action"}), 400
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # Start the midnight scheduler in a background daemon thread.
    # use_reloader=False prevents Flask debug mode from spawning a second
    # process (which would create duplicate scheduler threads).
    scheduler = threading.Thread(target=_midnight_scheduler, daemon=True, name="MidnightScheduler")
    scheduler.start()
    print("[App] Midnight scheduler started.")
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)