import requests
import re
import json
import html
from datetime import datetime
from sheets_service import (
    TELEGRAM_TOKEN,
    ADMIN_IDS,
    get_employee_by_tg_id,
    register_tg_id,
    has_approved_wfh,
    log_wfh_request,
    update_wfh_status,
    check_duplicate_wfh,
    get_pending_wfh_requests,
    get_pending_wfh_count,
    append_attendance,
    get_ist_now
)

BASE_URL = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}"

def send_message(chat_id, text, reply_markup=None):
    """Sends a text message via Telegram API."""
    url = f"{BASE_URL}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML"
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup
        
    try:
        resp = requests.post(url, json=payload)
        if resp.status_code != 200:
            print(f"[Telegram] Error: {resp.status_code} - {resp.text}")
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"[Telegram] Exception sending message to {chat_id}: {e}")
        return None

def edit_message_text(chat_id, message_id, text, reply_markup=None):
    """Edits an existing text message via Telegram API."""
    url = f"{BASE_URL}/editMessageText"
    payload = {
        "chat_id": chat_id,
        "message_id": message_id,
        "text": text,
        "parse_mode": "HTML"
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup
        
    try:
        resp = requests.post(url, json=payload)
        if resp.status_code != 200:
            print(f"[Telegram] Error: {resp.status_code} - {resp.text}")
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"[Telegram] Exception editing message {message_id}: {e}")
        return None

def handle_webhook(update):
    """Main router for incoming Telegram updates."""
    # --- CALLBACK QUERY (Buttons) ---
    if "callback_query" in update:
        handle_callback_query(update["callback_query"])
        return

    if "message" not in update:
        return

    msg = update["message"]
    chat_id = msg["chat"]["id"]
    user_id = str(msg["from"]["id"])
    text = msg.get("text", "").strip()

    # --- ADMIN LOGIC ---
    if str(chat_id) in ADMIN_IDS:
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
            "/register &lt;EMP_ID&gt; — Link your account\n"
            "/in — Clock IN (WFH only)\n"
            "/out — Clock OUT (WFH only)\n"
            "/wfh &lt;YYYY-MM-DD&gt; &lt;YYYY-MM-DD&gt; — Request WFH"
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

    # Only admins can use these buttons
    if user_id in ADMIN_IDS:
        if text == "/requests":
            render_wfh_list(chat_id)
            return

    # Default
    # send_message(chat_id, "Unknown command. Use /start to see available commands.")

def handle_register(chat_id, user_id, text):
    parts = text.split()
    if len(parts) != 2:
        send_message(chat_id, "Usage: /register &lt;EMP_ID&gt;")
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
        send_message(chat_id, "⚠️ Please register first using /register &lt;EMP_ID&gt;")
        return

    # Check for approved WFH
    now = get_ist_now()
    if not has_approved_wfh(user_id, now.date()):
        send_message(chat_id, "❌ You do not have an approved WFH request for today.")
        return

    emp_id = emp.get("employee_id", emp.get("id"))
    emp_name = emp.get("name")
    
    try:
        timestamp = append_attendance(emp_id, emp_name, tag, location="Home")
        send_message(chat_id, f"✅ {tag} marked at {timestamp} (Location: Home).")
    except ValueError as ve:
        send_message(chat_id, f"❌ {html.escape(str(ve))}")
    except Exception as e:
        send_message(chat_id, f"⚠️ An error occurred: {html.escape(str(e))}")

def handle_wfh_request(chat_id, user_id, text):
    emp = get_employee_by_tg_id(user_id)
    if not emp:
        send_message(chat_id, "⚠️ Please register first before requesting WFH.")
        return

    parts = text.split()
    if len(parts) != 3:
        send_message(chat_id, "Usage: /wfh &lt;YYYY-MM-DD&gt; &lt;YYYY-MM-DD&gt;")
        return

    start_date = parts[1]
    end_date = parts[2]
    
    # Simple date format validation
    date_regex = r"^\d{4}-\d{2}-\d{2}$"
    if not re.match(date_regex, start_date) or not re.match(date_regex, end_date):
        send_message(chat_id, "❌ Invalid date format. Use YYYY-MM-DD.")
        return

    # Check for duplicate request for the same start date
    has_dup, dup_status = check_duplicate_wfh(user_id, start_date)
    if has_dup:
        send_message(chat_id, f"⚠️ You already have a WFH request starting on {start_date} which is <b>{dup_status.upper()}</b>.\n\n"
                              f"Multiple requests for the same start date are not allowed unless the previous one was invalid or expired.")
        return

    emp_name = emp.get("name")
    
    # Log request in sheet
    log_wfh_request(user_id, start_date, end_date, "pending")

    # Notify all Admins
    count = get_pending_wfh_count()
    emp_name_esc = html.escape(emp_name if emp_name else "Unknown")
    admin_text = (
        f"📅 <b>New WFH Request</b>\n"
        f"Employee: {emp_name_esc} ({user_id})\n"
        f"Total pending requests: <b>{count}</b>\n\n"
        "To check the list and approve/reject, hit the button below."
    )
    
    keyboard = {
        "inline_keyboard": [[
            {"text": "📋 Check List", "callback_data": "list"}
        ]]
    }

    for admin_id in ADMIN_IDS:
        send_message(admin_id, admin_text, reply_markup=keyboard)
    send_message(chat_id, "📝 Your WFH request has been sent for approval.")

def handle_callback_query(query):
    """Handles clicks on inline keyboard buttons."""
    query_id = query["id"]
    from_id = str(query["from"]["id"])
    message = query.get("message", {})
    if not message:
        return # Cannot handle callbacks from inline bot results for now

    chat_id = message.get("chat", {}).get("id")
    message_id = message.get("message_id")
    data = query.get("data", "")

    if not chat_id:
        print(f"[Telegram] Warning: Received callback query without chat_id: {query}")
        return

    # Answer immediately to stop the loading spinner instantly
    requests.post(f"{BASE_URL}/answerCallbackQuery", json={"callback_query_id": query_id})

    if data == "list":
        render_wfh_list(chat_id, message_id)
    elif data.startswith("toggle|"):
        handle_toggle(chat_id, message_id, data, message)
    elif data.startswith("action|"):
        handle_bulk_action(chat_id, message_id, data, message, query_id)

def render_wfh_list(chat_id, message_id=None, overrides=None):
    """Renders the multi-select WFH list. message_id provided if editing."""
    pending = get_pending_wfh_requests()
    if not pending:
        text = "✅ <b>All caught up!</b> No pending WFH requests."
        if message_id:
            edit_message_text(chat_id, message_id, text)
        else:
            send_message(chat_id, text)
        return

    text = f"📋 <b>Pending WFH Requests ({len(pending)})</b>"
    
    # Selection state is kept in the button text (⬜ vs ✅)
    # If this is an edit (toggle), we might have previous state in 'overrides'
    keyboard = []
    
    for i, req in enumerate(pending):
        # Create a unique key for this request
        key = f"{req['tg_id']}|{req['from']}|{req['to']}"
        icon = "⬜"
        if overrides and overrides.get(key):
            icon = "✅"
            
        btn_text = f"{icon} {req['name']} ({req['from']})"
        keyboard.append([{"text": btn_text, "callback_data": f"toggle|{key}"}])

    # Count selections for dynamic labels
    selected_count = 0
    if overrides:
        selected_count = sum(1 for v in overrides.values() if v)

    # Add Action Buttons
    sel_suffix = f" ({selected_count})" if selected_count > 0 else ""
    keyboard.append([
        {"text": f"🟢 Approve Selected{sel_suffix}", "callback_data": "action|approve_sel"},
        {"text": f"🔴 Reject Selected{sel_suffix}", "callback_data": "action|reject_sel"}
    ])
    keyboard.append([
        {"text": "✅ Approve ALL", "callback_data": "action|approve_all"},
        {"text": "❌ Reject ALL", "callback_data": "action|reject_all"}
    ])
    
    reply_markup = {"inline_keyboard": keyboard}
    
    if message_id:
        edit_message_text(chat_id, message_id, text, reply_markup=reply_markup)
    else:
        send_message(chat_id, text, reply_markup=reply_markup)

def handle_toggle(chat_id, message_id, data, current_message):
    """Toggles the checkmark on a specific request button without re-fetching from Sheets."""
    parts = data.split("|")
    toggled_key = f"{parts[1]}|{parts[2]}|{parts[3]}"
    
    current_keyboard = current_message.get("reply_markup", {}).get("inline_keyboard", [])
    
    for row in current_keyboard:
        btn = row[0]
        btn_data = btn.get("callback_data", "")
        if btn_data == data:
            # Found the toggled button
            is_checked = "✅" in btn.get("text", "")
            new_icon = "⬜" if is_checked else "✅"
            # Get everything after the first space (the original text excluding the icon)
            label = btn.get("text", "").split(" ", 1)[1]
            btn["text"] = f"{new_icon} {label}"
            break
            
    # Keep the same text as before
    current_text = current_message.get("text", "📋 Pending WFH Requests")

    # Update the labels of the "Selected" buttons
    selected_count = 0
    for row in current_keyboard:
        btn = row[0]
        if "✅" in btn.get("text", "") and btn.get("callback_data", "").startswith("toggle|"):
            selected_count += 1
            
    sel_suffix = f" ({selected_count})" if selected_count > 0 else ""
    # Usually the action buttons are the last two rows (rows -2 and -1)
    # Row -2 is "Approve/Reject Selected"
    current_keyboard[-2][0]["text"] = f"🟢 Approve Selected{sel_suffix}"
    current_keyboard[-2][1]["text"] = f"🔴 Reject Selected{sel_suffix}"

    edit_message_text(chat_id, message_id, current_text, reply_markup={"inline_keyboard": current_keyboard})

def handle_bulk_action(chat_id, message_id, data, current_message, query_id):
    """Processes bulk approval or rejection."""
    action = data.split("|")[1]
    pending = get_pending_wfh_requests()
    
    selected_keys = set()
    if action in ["approve_sel", "reject_sel"]:
        current_keyboard = current_message.get("reply_markup", {}).get("inline_keyboard", [])
        for row in current_keyboard:
            btn = row[0]
            if btn.get("callback_data", "").startswith("toggle|") and "✅" in btn.get("text", ""):
                selected_keys.add(btn.get("callback_data").split("|", 1)[1])
                
        if not selected_keys:
            requests.post(f"{BASE_URL}/answerCallbackQuery", json={
                "callback_query_id": query_id, 
                "text": "⚠️ No employees selected. Tap names to check them.",
                "show_alert": True
            })
            return

    results = []
    for req in pending:
        key = f"{req['tg_id']}|{req['from']}|{req['to']}"
        should_process = False
        
        if action == "approve_all": 
            should_process = True
            status = "approved"
        elif action == "reject_all": 
            should_process = True
            status = "rejected"
        elif action == "approve_sel" and key in selected_keys: 
            should_process = True
            status = "approved"
        elif action == "reject_sel" and key in selected_keys: 
            should_process = True
            status = "rejected"
        
        if should_process:
            update_wfh_status(req['tg_id'], req['from'], req['to'], status)
            # Notify user
            emoji = "🎉" if status == "approved" else "😔"
            msg = f"{emoji} Your WFH request from {req['from']} to {req['to']} has been {status.upper()}."
            send_message(req['tg_id'], msg)
            results.append(f"• {html.escape(req['name'])} ({status})")
            
    summary = "✅ <b>Bulk Action Completed</b>\n\n" + "\n".join(results)
    edit_message_text(chat_id, message_id, summary)

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
        send_message(chat_id, "❌ Failed to parse the original request info.")
        return

    if reply == "approve":
        update_wfh_status(tg_id, start_date, end_date, "approved")
        for aid in ADMIN_IDS:
            send_message(aid, f"✅ Approved WFH for TG_ID {tg_id}.")
        send_message(tg_id, f"🎉 Your WFH request from {start_date} to {end_date} has been APPROVED.")
    elif reply == "reject":
        update_wfh_status(tg_id, start_date, end_date, "rejected")
        for aid in ADMIN_IDS:
            send_message(aid, f"❌ Rejected WFH for TG_ID {tg_id}.")
        send_message(tg_id, f"😔 Your WFH request from {start_date} to {end_date} was rejected.")
    else:
        send_message(chat_id, "ℹ️ Use 'approve' or 'reject' to handle the request.")
