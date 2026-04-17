import requests
import re
from datetime import datetime
from sheets_service import (
    TELEGRAM_TOKEN,
    ADMIN_CHAT_ID,
    get_employee_by_tg_id,
    register_tg_id,
    has_approved_wfh,
    add_wfh_approval,
    append_attendance,
    get_ist_now
)

BASE_URL = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}"

def send_message(chat_id, text):
    """Sends a text message via Telegram API."""
    url = f"{BASE_URL}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text
    }
    try:
        resp = requests.post(url, json=payload)
        resp.raise_for_status()
    except Exception as e:
        print(f"[Telegram] Error sending message to {chat_id}: {e}")

def handle_webhook(update):
    """Main router for incoming Telegram updates."""
    if "message" not in update:
        return

    msg = update["message"]
    chat_id = msg["chat"]["id"]
    user_id = str(msg["from"]["id"])
    text = msg.get("text", "").strip()

    # --- ADMIN LOGIC ---
    if str(chat_id) == str(ADMIN_CHAT_ID):
        if "reply_to_message" in msg:
            handle_admin_reply(msg)
            return
        
        # Guard against accidental approve/reject without reply
        if text.lower() in ["approve", "reject"]:
            send_message(chat_id, "⚠️ Please reply to the WFH request message.")
            return

    # --- USER COMMANDS ---
    if text == "/start":
        send_message(chat_id, 
            "Welcome to AttendTrack Bot!\n\n"
            "Commands:\n"
            "/register <EMP_ID> — Link your account\n"
            "/in — Clock IN (WFH only)\n"
            "/out — Clock OUT (WFH only)\n"
            "/wfh <YYYY-MM-DD> <YYYY-MM-DD> — Request WFH"
        )
        return

    if text.startswith("/register"):
        handle_register(chat_id, user_id, text)
        return

    if text == "/in":
        handle_attendance(chat_id, user_id, "IN")
        return

    if text == "/out":
        handle_attendance(chat_id, user_id, "OUT")
        return

    if text.startswith("/wfh"):
        handle_wfh_request(chat_id, user_id, text)
        return

    # Default
    # send_message(chat_id, "Unknown command. Use /start to see available commands.")

def handle_register(chat_id, user_id, text):
    parts = text.split()
    if len(parts) != 2:
        send_message(chat_id, "Usage: /register <EMP_ID>")
        return

    emp_id = parts[1]
    emp_name = register_tg_id(emp_id, user_id)
    
    if emp_name:
        send_message(chat_id, f"✅ Registered successfully! Welcome, {emp_name}.")
    else:
        send_message(chat_id, "❌ Invalid Employee ID. Please check and try again.")

def handle_attendance(chat_id, user_id, tag):
    emp = get_employee_by_tg_id(user_id)
    if not emp:
        send_message(chat_id, "⚠️ Please register first using /register <EMP_ID>")
        return

    # Check for approved WFH
    now = get_ist_now()
    if not has_approved_wfh(user_id, now.date()):
        send_message(chat_id, "❌ You do not have an approved WFH request for today.")
        return

    emp_id = emp.get("employee_id", emp.get("id"))
    emp_name = emp.get("name")
    
    timestamp = append_attendance(emp_id, emp_name, tag, location="Home")
    send_message(chat_id, f"✅ {tag} marked at {timestamp} (Location: Home).")

def handle_wfh_request(chat_id, user_id, text):
    emp = get_employee_by_tg_id(user_id)
    if not emp:
        send_message(chat_id, "⚠️ Please register first before requesting WFH.")
        return

    parts = text.split()
    if len(parts) != 3:
        send_message(chat_id, "Usage: /wfh <YYYY-MM-DD> <YYYY-MM-DD>")
        return

    start_date = parts[1]
    end_date = parts[2]
    
    # Simple date format validation
    date_regex = r"^\d{4}-\d{2}-\d{2}$"
    if not re.match(date_regex, start_date) or not re.match(date_regex, end_date):
        send_message(chat_id, "❌ Invalid date format. Use YYYY-MM-DD.")
        return

    emp_name = emp.get("name")
    
    # Notify Admin
    admin_text = (
        f"📅 *WFH Request*\n"
        f"Employee: {emp_name}\n"
        f"TelegramID: {user_id}\n"
        f"From: {start_date}\n"
        f"To: {end_date}\n\n"
        f"Reply with 'approve' or 'reject' to this message."
    )
    send_message(ADMIN_CHAT_ID, admin_text)
    send_message(chat_id, "📝 WFH request sent to admin for approval.")

def handle_admin_reply(msg):
    reply = msg.get("text", "").strip().lower()
    original_text = msg["reply_to_message"].get("text", "")

    if "WFH Request" not in original_text:
        return

    # Extract info from original message
    try:
        tg_id = re.search(r"TelegramID:\s*(\d+)", original_text).group(1)
        start_date = re.search(r"From:\s*(\d{4}-\d{2}-\d{2})", original_text).group(1)
        end_date = re.search(r"To:\s*(\d{4}-\d{2}-\d{2})", original_text).group(1)
    except (AttributeError, IndexError):
        send_message(ADMIN_CHAT_ID, "❌ Failed to parse the original request info.")
        return

    if reply == "approve":
        add_wfh_approval(tg_id, start_date, end_date)
        send_message(ADMIN_CHAT_ID, f"✅ Approved WFH for TG_ID {tg_id}.")
        send_message(tg_id, f"🎉 Your WFH request from {start_date} to {end_date} has been APPROVED.")
    elif reply == "reject":
        send_message(ADMIN_CHAT_ID, f"❌ Rejected WFH for TG_ID {tg_id}.")
        send_message(tg_id, f"😔 Your WFH request from {start_date} to {end_date} was rejected.")
    else:
        send_message(ADMIN_CHAT_ID, "ℹ️ Use 'approve' or 'reject' to handle the request.")
