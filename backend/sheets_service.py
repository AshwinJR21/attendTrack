from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from datetime import datetime, timedelta, timezone
import ssl
import time
import threading

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

IST_TZ = timezone(timedelta(hours=5, minutes=30))

def get_ist_now():
    return datetime.now(IST_TZ)


# =========================
# IN-MEMORY TTL CACHE
# =========================
_cache = {}       # key -> (value, expiry_timestamp)
_cache_lock = threading.Lock()

def _cache_get(key):
    """Return cached value if it exists and hasn't expired, else None."""
    with _cache_lock:
        entry = _cache.get(key)
        if entry is None:
            return None
        value, expiry = entry
        if time.time() > expiry:
            del _cache[key]
            return None
        return value

def _cache_set(key, value, ttl_seconds):
    """Store a value in cache with a TTL."""
    with _cache_lock:
        _cache[key] = (value, time.time() + ttl_seconds)

def _cache_invalidate(prefix=""):
    """Invalidate all cache entries whose keys start with prefix."""
    with _cache_lock:
        if not prefix:
            _cache.clear()
        else:
            keys_to_delete = [k for k in _cache if k.startswith(prefix)]
            for k in keys_to_delete:
                del _cache[k]

# Sheet existence cache — once confirmed, a sheet never disappears
_sheet_exists_cache = set()

# =========================
# CONFIG
# =========================
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

SPREADSHEET_ID_CACHE = {} # year -> spreadsheet_id
FOLDER_ID_CACHE = {"attendance": None}
MASTER_ID_CACHE = {"id": None}

EMPLOYEE_MASTER_SHEET = "employee_master"
WFH_REQUESTS_SHEET = "wfh_requests"
SERVICE_ACCOUNT_FILE = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "credentials.json")

TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN", "").strip()
_admin_raw = os.getenv("ADMIN_CHAT_ID", "").strip()
ADMIN_IDS = [x.strip() for x in _admin_raw.split(",") if x.strip()]

creds = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
service = build("sheets", "v4", credentials=creds)
drive_service = build("drive", "v3", credentials=creds)


api_lock = threading.RLock()

def _rebuild_service():
    """Rebuild the Google Sheets and Drive service objects."""
    global service, drive_service, creds
    creds = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    service = build("sheets", "v4", credentials=creds)
    drive_service = build("drive", "v3", credentials=creds)


def retry_api(fn, retries=3, backoff=1.5):
    """
    Call fn() with automatic retry on transient SSL / connection errors.
    Holds a lock because httplib2 (used by google-api-python-client)
    is not thread-safe for shared service objects.
    The in-memory cache layer above means most reads skip this entirely.
    """
    with api_lock:
        for attempt in range(retries):
            try:
                return fn()
            except (ssl.SSLError, ConnectionResetError, OSError) as e:
                if attempt == retries - 1:
                    raise
                print(f"[retry_api] Transient error ({e}), rebuilding service and retrying "
                      f"({attempt + 1}/{retries})...")
                _rebuild_service()
                time.sleep(backoff ** attempt)


# =========================
# DISCOVERY HELPERS: Folders and Spreadsheets
# =========================

def get_attendance_folder_id():
    """Finds or creates the 'Attendance' folder in Drive."""
    if FOLDER_ID_CACHE["attendance"]:
        return FOLDER_ID_CACHE["attendance"]

    query = "name='Attendance' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    results = retry_api(lambda: drive_service.files().list(q=query, fields="files(id)").execute())
    files = results.get("files", [])

    if files:
        folder_id = files[0]["id"]
    else:
        folder_metadata = {
            "name": "Attendance",
            "mimeType": "application/vnd.google-apps.folder"
        }
        folder = retry_api(lambda: drive_service.files().create(body=folder_metadata, fields="id").execute())
        folder_id = folder.get("id")
        FOLDER_ID_CACHE["attendance"] = folder_id
    return folder_id


def get_master_spreadsheet_id():
    """Finds or creates the 'Employee_Master' spreadsheet inside the 'attendance' folder."""
    if MASTER_ID_CACHE["id"]:
        return MASTER_ID_CACHE["id"]

    folder_id = get_attendance_folder_id()
    query = f"name='Employee_Master' and '{folder_id}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
    results = retry_api(lambda: drive_service.files().list(q=query, fields="files(id)").execute())
    files = results.get("files", [])

    if files:
        master_id = files[0]["id"]
    else:
        file_metadata = {
            "name": "Employee_Master",
            "mimeType": "application/vnd.google-apps.spreadsheet",
            "parents": [folder_id]
        }
        file = retry_api(lambda: drive_service.files().create(body=file_metadata, fields="id").execute())
        master_id = file.get("id")
        
    # Always ensure sheets exist with headers
    ensure_master_sheet_exists(master_id)
    ensure_wfh_sheet_exists(master_id)

    MASTER_ID_CACHE["id"] = master_id
    return master_id


def ensure_wfh_sheet_exists(spreadsheet_id):
    """Ensures the 'wfh_requests' sheet exists in the master spreadsheet."""
    spreadsheet = retry_api(lambda: service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute())
    existing_sheets = [s["properties"]["title"] for s in spreadsheet.get("sheets", [])]
    
    if WFH_REQUESTS_SHEET not in existing_sheets:
        requests = [{"addSheet": {"properties": {"title": WFH_REQUESTS_SHEET}}}]
        retry_api(lambda: service.spreadsheets().batchUpdate(spreadsheetId=spreadsheet_id, body={"requests": requests}).execute())
        
        # Add headers: [TG_ID, START, TO, ID, NAME, STATUS]
        headers = [["telegram_id", "from", "to", "employee_id", "name", "status"]]
        retry_api(lambda: service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range=f"'{WFH_REQUESTS_SHEET}'!A1:F1",
            valueInputOption="RAW",
            body={"values": headers}
        ).execute())


def ensure_master_sheet_exists(spreadsheet_id):
    """Ensures the 'employee_master' sheet exists in the master spreadsheet."""
    spreadsheet = retry_api(lambda: service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute())
    existing_sheets = [s["properties"]["title"] for s in spreadsheet.get("sheets", [])]
    
    if EMPLOYEE_MASTER_SHEET not in existing_sheets:
        requests = [{"addSheet": {"properties": {"title": EMPLOYEE_MASTER_SHEET}}}]
        retry_api(lambda: service.spreadsheets().batchUpdate(spreadsheetId=spreadsheet_id, body={"requests": requests}).execute())
        
        # Add headers
        headers = [["employee_id", "name", "status"]]
        retry_api(lambda: service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range=f"'{EMPLOYEE_MASTER_SHEET}'!A1:C1",
            valueInputOption="RAW",
            body={"values": headers}
        ).execute())


def get_yearly_spreadsheet_id(year=None):
    """Finds or creates the 'Attendance_YEAR' spreadsheet inside the 'attendance' folder."""
    if year is None:
        year = get_ist_now().year
    
    if year in SPREADSHEET_ID_CACHE:
        return SPREADSHEET_ID_CACHE[year]

    folder_id = get_attendance_folder_id()
    name = f"Attendance_{year}"
    query = f"name='{name}' and '{folder_id}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
    results = retry_api(lambda: drive_service.files().list(q=query, fields="files(id)").execute())
    files = results.get("files", [])

    if files:
        spreadsheet_id = files[0]["id"]
    else:
        file_metadata = {
            "name": name,
            "mimeType": "application/vnd.google-apps.spreadsheet",
            "parents": [folder_id]
        }
        file = retry_api(lambda: drive_service.files().create(body=file_metadata, fields="id").execute())
        spreadsheet_id = file.get("id")

    SPREADSHEET_ID_CACHE[year] = spreadsheet_id
    return spreadsheet_id


# =========================
# HELPER: Get current month sheet name (e.g., "April_Activity_Log")
# =========================
def get_current_sheet_name():
    return get_ist_now().strftime("%B_Activity_Log")


# =========================
# HELPER: Ensure the monthly sheet exists, create if not
# =========================
def ensure_sheet_exists(sheet_name, spreadsheet_id=None):
    if spreadsheet_id is None:
        spreadsheet_id = get_yearly_spreadsheet_id()

    cache_key = f"{spreadsheet_id}:{sheet_name}"
    if cache_key in _sheet_exists_cache:
        return  # Already confirmed to exist

    spreadsheet = retry_api(
        lambda: service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    )

    existing_sheets = [
        s["properties"]["title"]
        for s in spreadsheet.get("sheets", [])
    ]

    # Cache ALL sheets found in this spreadsheet
    for s_name in existing_sheets:
        _sheet_exists_cache.add(f"{spreadsheet_id}:{s_name}")

    if sheet_name not in existing_sheets:
        requests = [{"addSheet": {"properties": {"title": sheet_name}}}]
        retry_api(
            lambda: service.spreadsheets().batchUpdate(
                spreadsheetId=spreadsheet_id,
                body={"requests": requests}
            ).execute()
        )
        _sheet_exists_cache.add(cache_key)


# =========================
# 1. APPEND ATTENDANCE LOG ROW
#    Row format: [emp_id, name, timestamp, "IN"/"OUT", location]
# =========================
def append_attendance(emp_id, name, tag, location="Office", sheet_name=None, year=None):
    if sheet_name is None:
        sheet_name = get_current_sheet_name()
    
    spreadsheet_id = get_yearly_spreadsheet_id(year)
    ensure_sheet_exists(sheet_name, spreadsheet_id)

    tag_upper = tag.upper()
    
    # --- VALIDATION LAYER ---
    last_punch = get_employee_last_punch(emp_id, sheet_name, year)
    last_tag = last_punch["tag"] if last_punch else "OUT"

    # 1. State transition validation (prevent double IN/OUT)
    if tag_upper == last_tag:
        raise ValueError(f"Action Invalid: You are already {tag_upper}.")

    # 2. Location consistency validation (prevent cross-location OUT)
    if tag_upper == "OUT":
        # (At this point, last_punch MUST be an "IN" because if it were "OUT", 
        # it would have been caught by the check above)
        if last_punch and last_punch["location"] != location:
            raise ValueError(
                f"Location Mismatch: You punched IN from '{last_punch['location']}'. "
                f"You must punch OUT from the same location (you tried '{location}')."
            )
    # -----------------------

    timestamp = get_ist_now().strftime("%Y-%m-%d %H:%M:%S")
    
    row = [emp_id, name, timestamp, tag_upper, location]
    body = {"values": [row]}

    retry_api(
        lambda: service.spreadsheets().values().append(
            spreadsheetId=spreadsheet_id,
            range=f"'{sheet_name}'!A:E",
            valueInputOption="RAW",
            body=body,
        ).execute()
    )

    # Write-through cache: append new row to cached data instead of invalidating.
    # This way the next reader sees the update instantly from memory.
    cache_key = f"rows:{sheet_name}:{year}"
    cached = _cache_get(cache_key)
    if cached is not None:
        _cache_set(cache_key, cached + [row], 10)
    else:
        # No cache entry — seed it so the next read is instant
        _cache_invalidate("rows:")

    return timestamp


# =========================
# 1b. GET LAST PUNCH FOR AN EMPLOYEE
# =========================
def get_employee_last_punch(emp_id, sheet_name=None, year=None):
    """Retrieves the most recent punch data for an employee including location."""
    rows = get_rows(sheet_name, year)
    # Traverse from bottom → most recent entry first
    for row in reversed(rows):
        if len(row) < 4:
            continue
        if str(row[0]) == str(emp_id):
            return {
                "tag": row[3].upper(),
                "location": row[4] if len(row) > 4 else "Office",
                "timestamp": row[2]
            }
    return None


# =========================
# 2. GET ALL ROWS FOR A SHEET
# =========================
def get_rows(sheet_name=None, year=None):
    if sheet_name is None:
        sheet_name = get_current_sheet_name()

    cache_key = f"rows:{sheet_name}:{year}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    spreadsheet_id = get_yearly_spreadsheet_id(year)
    ensure_sheet_exists(sheet_name, spreadsheet_id)

    result = retry_api(
        lambda: service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=f"'{sheet_name}'!A:E"
        ).execute()
    )
    rows = result.get("values", [])
    _cache_set(cache_key, rows, 10)  # 10-second TTL
    return rows


# =========================
# 3. GET CURRENT STATUS FOR AN EMPLOYEE
#    Looks at last row for that employee → reads column D (IN/OUT)
# =========================
def get_employee_current_status(emp_id, sheet_name=None, year=None):
    rows = get_rows(sheet_name, year)

    # Traverse from bottom → most recent entry first
    for row in reversed(rows):
        if len(row) < 4:
            continue
        if row[0] == emp_id:
            return row[3].upper()  # "IN" or "OUT"

    # No entry found → treat as OUT
    return "OUT"


# =========================
# 3b. GET ALL EMPLOYEE STATUSES IN ONE SHOT
#     Fetches the monthly sheet ONCE → returns {emp_id: {"status": str, "since": str}}
#     Use this instead of calling get_employee_current_status in a loop.
# =========================
def get_all_statuses_bulk(sheet_name=None, year=None):
    if sheet_name is None:
        sheet_name = get_current_sheet_name()
    rows = get_rows(sheet_name, year)

    # For each employee id, keep only the last (most recent) IN/OUT entry
    # Row format: [emp_id, name, timestamp, IN/OUT, location]
    status_map = {}  # emp_id -> {"status": "IN"|"OUT", "since": timestamp_str}
    for row in rows:
        if len(row) < 4:
            continue
        emp_id = row[0]
        tag = row[3].upper()
        timestamp = row[2] if len(row) > 2 else ""
        if tag in ("IN", "OUT"):
            status_map[emp_id] = {
                "status": tag,
                "since": timestamp,
                "location": row[4] if len(row) > 4 else "Office"
            }

    return status_map


# =========================
# 4. GET ACTIVE EMPLOYEES FROM MASTER SHEET
# =========================
def get_active_employees():
    cache_key = "active_employees"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    spreadsheet_id = get_master_spreadsheet_id()
    result = retry_api(
        lambda: service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=f"'{EMPLOYEE_MASTER_SHEET}'!A:Z"
        ).execute()
    )

    rows = result.get("values", [])
    if not rows or len(rows) < 2:
        return []

    # First row is header
    headers = [h.strip().lower() for h in rows[0]]

    employees = []
    for row in rows[1:]:
        padded = row + [""] * (len(headers) - len(row))
        record = dict(zip(headers, padded))

        status = record.get("status", "").strip().lower()
        if status == "active":
            employees.append({
                "id": record.get("employee_id", record.get("id", "")),
                "name": record.get("name", record.get("employee_name", "")),
                "status": status,
            })

    _cache_set(cache_key, employees, 60)  # 60-second TTL
    return employees


# =========================
# TELEGRAM HELPERS
# =========================

def get_employee_by_tg_id(tg_id):
    """Finds an employee record by their Telegram user ID."""
    employees = get_active_employees_full_data()
    for emp in employees:
        if str(emp.get("telegram_id")) == str(tg_id):
            return emp
    return None

def get_active_employees_full_data():
    """Fetches all employee records from master sheet including private columns."""
    spreadsheet_id = get_master_spreadsheet_id()
    result = retry_api(
        lambda: service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=f"'{EMPLOYEE_MASTER_SHEET}'!A:Z"
        ).execute()
    )
    rows = result.get("values", [])
    if not rows or len(rows) < 2: return []
    headers = [h.strip().lower() for h in rows[0]]
    employees = []
    for row in rows[1:]:
        padded = row + [""] * (len(headers) - len(row))
        employees.append(dict(zip(headers, padded)))
    return employees

def register_tg_id(emp_id, tg_id):
    """Links a Telegram ID to an employee ID in the master sheet."""
    spreadsheet_id = get_master_spreadsheet_id()
    data = get_active_employees_full_data()
    headers = retry_api(lambda: service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id, range=f"'{EMPLOYEE_MASTER_SHEET}'!1:1"
    ).execute()).get("values", [[]])[0]
    
    tg_col_idx = -1
    for i, h in enumerate(headers):
        if h.strip().upper() == "TELEGRAM_ID":
            tg_col_idx = i
            break
            
    if tg_col_idx == -1:
        # Add column if missing (though user said it exists)
        tg_col_idx = len(headers)
        col_letter = chr(65 + tg_col_idx)
        retry_api(lambda: service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id, range=f"'{EMPLOYEE_MASTER_SHEET}'!{col_letter}1",
            valueInputOption="RAW", body={"values": [["TELEGRAM_ID"]]}
        ).execute())

    for i, emp in enumerate(data):
        if str(emp.get("employee_id", emp.get("id"))) == str(emp_id):
            row_num = i + 2
            col_letter = chr(65 + tg_col_idx)
            retry_api(lambda: service.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id,
                range=f"'{EMPLOYEE_MASTER_SHEET}'!{col_letter}{row_num}",
                valueInputOption="RAW",
                body={"values": [[str(tg_id)]]}
            ).execute())
            return emp.get("name", "Employee")
    return None

def has_approved_wfh(tg_id, target_date):
    """Checks if a Telegram user has an approved WFH entry for a specific date."""
    spreadsheet_id = get_master_spreadsheet_id()
    ensure_wfh_sheet_exists(spreadsheet_id)
    
    result = retry_api(
        lambda: service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=f"'{WFH_REQUESTS_SHEET}'!A:F"
        ).execute()
    )
    rows = result.get("values", [])
    if not rows or len(rows) < 2: return False
    
    # Headers: telegram_id, from_date, to_date
    target_ts = datetime.combine(target_date, datetime.min.time()).timestamp()
    
    for row in rows[1:]:
        if len(row) < 3: continue
        if str(row[0]) == str(tg_id):
            # Check status if column F exists, otherwise assume approved for old entries
            status = row[5].lower() if len(row) > 5 else "approved"
            if status != "approved":
                continue
                
            try:
                start = datetime.strptime(row[1], "%Y-%m-%d").timestamp()
                end = datetime.strptime(row[2], "%Y-%m-%d").timestamp()
                if start <= target_ts <= end:
                    return True
            except ValueError: continue
    return False

def log_wfh_request(tg_id, start_date, end_date, status="pending"):
    """Logs a new WFH request to the master spreadsheet with a status."""
    emp = get_employee_by_tg_id(tg_id)
    emp_id = emp.get("employee_id", emp.get("id", "Unknown")) if emp else "Unknown"
    emp_name = emp.get("name", "Unknown") if emp else "Unknown"
    
    spreadsheet_id = get_master_spreadsheet_id()
    ensure_wfh_sheet_exists(spreadsheet_id)
    
    row = [str(tg_id), start_date, end_date, emp_id, emp_name, status]
    retry_api(
        lambda: service.spreadsheets().values().append(
            spreadsheetId=spreadsheet_id,
            range=f"'{WFH_REQUESTS_SHEET}'!A:F",
            valueInputOption="RAW",
            body={"values": [row]}
        ).execute()
    )

def update_wfh_status(tg_id, start_date, end_date, new_status):
    """Updates the status of an existing WFH request."""
    spreadsheet_id = get_master_spreadsheet_id()
    ensure_wfh_sheet_exists(spreadsheet_id)
    
    result = retry_api(
        lambda: service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=f"'{WFH_REQUESTS_SHEET}'!A:F"
        ).execute()
    )
    rows = result.get("values", [])
    if not rows: return
    
    # Headers: [tg_id, start, end, emp_id, name, status]
    for i, row in enumerate(rows):
        if len(row) < 3: continue
        if (str(row[0]) == str(tg_id) and 
            row[1] == start_date and 
            row[2] == end_date):
            
            row_num = i + 1
            retry_api(lambda: service.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id,
                range=f"'{WFH_REQUESTS_SHEET}'!F{row_num}",
                valueInputOption="RAW",
                body={"values": [[new_status]]}
            ).execute())
            return

def batch_update_wfh_statuses(requests_list, new_status):
    """Updates multiple WFH requests' status in a single batch API call.
    requests_list: list of dicts with keys 'tg_id', 'from', 'to'
    new_status: 'approved' or 'rejected'
    """
    if not requests_list:
        return
    
    spreadsheet_id = get_master_spreadsheet_id()
    ensure_wfh_sheet_exists(spreadsheet_id)
    
    result = retry_api(
        lambda: service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=f"'{WFH_REQUESTS_SHEET}'!A:F"
        ).execute()
    )
    rows = result.get("values", [])
    if not rows:
        return
    
    # Build a lookup set of target keys
    target_keys = set()
    for req in requests_list:
        target_keys.add(f"{req['tg_id']}|{req['from']}|{req['to']}")
    
    # Collect all matching row ranges for batch update
    update_data = []
    for i, row in enumerate(rows):
        if len(row) < 3:
            continue
        key = f"{row[0]}|{row[1]}|{row[2]}"
        if key in target_keys:
            row_num = i + 1
            update_data.append({
                "range": f"'{WFH_REQUESTS_SHEET}'!F{row_num}",
                "values": [[new_status]]
            })
    
    if update_data:
        retry_api(lambda: service.spreadsheets().values().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={
                "valueInputOption": "RAW",
                "data": update_data
            }
        ).execute())

def cancel_wfh_for_date(emp_id, date_str):
    """Cancels any approved WFH request for a specific employee and date."""
    spreadsheet_id = get_master_spreadsheet_id()
    ensure_wfh_sheet_exists(spreadsheet_id)
    
    result = retry_api(
        lambda: service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=f"'{WFH_REQUESTS_SHEET}'!A:F"
        ).execute()
    )
    rows = result.get("values", [])
    if not rows: return
    
    try:
        target_ts = datetime.strptime(date_str, "%Y-%m-%d").timestamp()
    except ValueError:
        return

    # Headers: [tg_id, start, end, emp_id, name, status]
    for i, row in enumerate(rows):
        if len(row) < 4: continue
        if str(row[3]) == str(emp_id):
            status = row[5].lower() if len(row) > 5 else "approved"
            if status != "approved":
                continue
                
            try:
                start = datetime.strptime(row[1], "%Y-%m-%d").timestamp()
                end = datetime.strptime(row[2], "%Y-%m-%d").timestamp()
                if start <= target_ts <= end:
                    row_num = i + 1
                    retry_api(lambda: service.spreadsheets().values().update(
                        spreadsheetId=spreadsheet_id,
                        range=f"'{WFH_REQUESTS_SHEET}'!F{row_num}",
                        valueInputOption="RAW",
                        body={"values": [["invalid"]]}
                    ).execute())
                    print(f"[WFH] Invalidated approved WFH for {emp_id} on {date_str}")
            except ValueError: continue

def check_duplicate_wfh(tg_id, start_date):
    """Returns (True, status) if a WFH request already exists for this user and start date."""
    spreadsheet_id = get_master_spreadsheet_id()
    ensure_wfh_sheet_exists(spreadsheet_id)
    
    result = retry_api(
        lambda: service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=f"'{WFH_REQUESTS_SHEET}'!A:F"
        ).execute()
    )
    rows = result.get("values", [])
    if not rows or len(rows) < 2: return False, None
    
    # Skip header
    for row in rows[1:]:
        if len(row) < 6: continue
        # [tg_id, from, to, emp_id, name, status]
        existing_tg_id = str(row[0])
        existing_start = str(row[1])
        status = str(row[5]).lower()
        
        if existing_tg_id == str(tg_id) and existing_start == start_date:
            if status not in ["invalid", "expired"]:
                return True, status
    return False, None

def get_pending_wfh_requests():
    """Fetches all WFH requests with 'pending' status."""
    spreadsheet_id = get_master_spreadsheet_id()
    ensure_wfh_sheet_exists(spreadsheet_id)
    
    result = retry_api(
        lambda: service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=f"'{WFH_REQUESTS_SHEET}'!A:F"
        ).execute()
    )
    rows = result.get("values", [])
    if not rows or len(rows) < 2: return []
    
    pending = []
    # Headers: [tg_id, from, to, emp_id, name, status]
    for row in rows[1:]:
        if len(row) < 6: continue
        if row[5].lower() == "pending":
            pending.append({
                "tg_id": row[0],
                "from": row[1],
                "to": row[2],
                "emp_id": row[3],
                "name": row[4],
                "status": row[5]
            })
    return pending

def get_pending_wfh_count():
    """Returns the number of pending WFH requests."""
    return len(get_pending_wfh_requests())

def add_wfh_approval(tg_id, start_date, end_date):
    """Adds a new approved WFH entry to the master spreadsheet."""
    emp = get_employee_by_tg_id(tg_id)
    emp_id = emp.get("employee_id", emp.get("id", "Unknown")) if emp else "Unknown"
    emp_name = emp.get("name", "Unknown") if emp else "Unknown"
    
    spreadsheet_id = get_master_spreadsheet_id()
    ensure_wfh_sheet_exists(spreadsheet_id)
    
    row = [str(tg_id), start_date, end_date, emp_id, emp_name, "approved"]
    retry_api(
        lambda: service.spreadsheets().values().append(
            spreadsheetId=spreadsheet_id,
            range=f"'{WFH_REQUESTS_SHEET}'!A:F",
            valueInputOption="RAW",
            body={"values": [row]}
        ).execute()
    )

def cleanup_expired_wfh():
    """Marks any WFH request as 'expired' if its end date has passed."""
    spreadsheet_id = get_master_spreadsheet_id()
    ensure_wfh_sheet_exists(spreadsheet_id)
    
    result = retry_api(lambda: service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=f"'{WFH_REQUESTS_SHEET}'!A:F"
    ).execute())
    rows = result.get("values", [])
    if not rows or len(rows) < 2: return
    
    # Get IST today at midnight for comparison
    today_dt = get_ist_now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    updates = 0
    # Headers: [tg_id, from, to, emp_id, name, status]
    # Rows indices start from 1 in Sheets, row 1 is header
    for i, row in enumerate(rows[1:], start=2):
        if len(row) < 6: continue
        end_date_str = row[2]
        status = row[5].lower()
        
        if status in ["approved", "pending"]:
            try:
                # strptime returns naive datetime, we compare with today_dt (IST)
                end_dt = datetime.strptime(end_date_str, "%Y-%m-%d").replace(tzinfo=IST_TZ)
                if end_dt < today_dt:
                    row_num = i
                    retry_api(lambda: service.spreadsheets().values().update(
                        spreadsheetId=spreadsheet_id,
                        range=f"'{WFH_REQUESTS_SHEET}'!F{row_num}",
                        valueInputOption="RAW",
                        body={"values": [["expired"]]}
                    ).execute())
                    updates += 1
            except ValueError:
                continue
    
    if updates > 0:
        print(f"[WFH Cleanup] Marked {updates} requests as expired.")


# =========================
# 5. MIDNIGHT ROLLOVER
#    Called at 00:00 each day.
#    - For every active employee still checked IN, logs OUT at 23:59:59
#      on the OLD sheet (yesterday's month).
#    - Creates the new month sheet if the month has changed.
#    - Logs IN at 00:00:00 on the NEW sheet for those same employees.
#    - If status was already OUT, does nothing for that employee.
# =========================
def midnight_rollover():
    now = get_ist_now()           # called at midnight — this is the new day
    yesterday = now - timedelta(seconds=1)  # 23:59:59 of the previous day

    # e.g. "April_Activity_Log"
    old_sheet = yesterday.strftime("%B_Activity_Log")   
    new_sheet = now.strftime("%B_Activity_Log")         

    old_year = yesterday.year
    new_year = now.year

    old_spreadsheet_id = get_yearly_spreadsheet_id(old_year)
    new_spreadsheet_id = get_yearly_spreadsheet_id(new_year)

    out_ts = yesterday.strftime("%Y-%m-%d 23:59:59")
    in_ts  = now.strftime("%Y-%m-%d 00:00:00")

    # Cleanup expired WFH requests first
    try:
        cleanup_expired_wfh()
    except Exception as e:
        print(f"[Midnight Rollover] ERROR during WFH cleanup: {e}")

    try:
        active_employees = get_active_employees()
    except Exception as e:
        print(f"[Midnight Rollover] ERROR fetching employees: {e}")
        return

    if not active_employees:
        print("[Midnight Rollover] No active employees — nothing to do.")
        return

    # Check who is currently IN on the old sheet
    old_statuses = get_all_statuses_bulk(old_sheet, old_year)
    employees_in = [
        emp for emp in active_employees
        if old_statuses.get(emp["id"], {}).get("status", "OUT") == "IN"
    ]

    # Always ensure the new sheet exists (even if nobody is IN)
    ensure_sheet_exists(new_sheet, new_spreadsheet_id)

    if not employees_in:
        print("[Midnight Rollover] No employees checked IN — nothing to roll over.")
        return

    names = [e["name"] for e in employees_in]
    print(f"[Midnight Rollover] Rolling over {len(employees_in)} employees: {names}")

    # Prepare batches
    out_rows = []
    in_rows = []
    for emp in employees_in:
        info = old_statuses.get(emp["id"], {})
        loc = info.get("location", "Office")
        
        out_rows.append([emp["id"], emp["name"], out_ts, "OUT", loc])
        in_rows.append([emp["id"], emp["name"], in_ts, "IN", loc])

    # 1. Batch-append OUT rows to OLD spreadsheet
    retry_api(
        lambda: service.spreadsheets().values().append(
            spreadsheetId=old_spreadsheet_id,
            range=f"'{old_sheet}'!A:E",
            valueInputOption="RAW",
            body={"values": out_rows},
        ).execute()
    )

    # 2. Batch-append IN rows to NEW spreadsheet
    retry_api(
        lambda: service.spreadsheets().values().append(
            spreadsheetId=new_spreadsheet_id,
            range=f"'{new_sheet}'!A:E",
            valueInputOption="RAW",
            body={"values": in_rows},
        ).execute()
    )
    print(f"[Midnight Rollover] Successfully rolled over {len(employees_in)} entries.")


# =========================
# 6. COMPUTE DAILY MINUTES PER EMPLOYEE
#    Returns {emp_id: total_minutes_worked} for a given "YYYY-MM-DD".
#    Only counts completed IN->OUT pairs (ongoing session NOT included —
#    the frontend adds live minutes for currently-IN employees).
# =========================
def compute_daily_minutes(date_str):
    try:
        target = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return {}

    month_sheet = target.strftime("%B_Activity_Log")
    year = target.year
    spreadsheet_id = get_yearly_spreadsheet_id(year)

    try:
        result = retry_api(
            lambda: service.spreadsheets().values().get(
                spreadsheetId=spreadsheet_id,
                range=f"'{month_sheet}'!A:E"
            ).execute()
        )
        rows = result.get("values", [])
    except Exception:
        return {}

    day_rows = [r for r in rows if len(r) >= 4 and r[2].startswith(date_str)]

    emp_rows: dict = {}
    for r in day_rows:
        emp_rows.setdefault(r[0], []).append(r)

    result_map: dict = {}
    for emp_id, rlist in emp_rows.items():
        total_secs = 0.0
        last_in = None
        for row in rlist:
            tag = row[3].upper()
            try:
                ts = datetime.strptime(row[2], "%Y-%m-%d %H:%M:%S")
            except ValueError:
                continue
            if tag == "IN":
                last_in = ts
            elif tag == "OUT" and last_in is not None:
                total_secs += (ts - last_in).total_seconds()
                last_in = None
        result_map[emp_id] = int(total_secs / 60)

    return result_map


# =========================
# 7. GET EARLIEST RECORD DATE
#    Finds the earliest date available across all Attendance_* spreadsheets.
# =========================
earliest_date_cache = None

def get_earliest_record_date():
    global earliest_date_cache
    if earliest_date_cache:
        return earliest_date_cache

    folder_id = get_attendance_folder_id()
    # Find all Attendance_* files
    query = f"name contains 'Attendance_' and '{folder_id}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
    results = retry_api(lambda: drive_service.files().list(q=query, fields="files(id, name)").execute())
    files = results.get("files", [])

    earliest_year = None
    earliest_spreadsheet_id = None

    for f in files:
        name = f["name"]
        try:
            year = int(name.split("_")[1])
            if earliest_year is None or year < earliest_year:
                earliest_year = year
                earliest_spreadsheet_id = f["id"]
        except (IndexError, ValueError):
            pass

    if not earliest_spreadsheet_id:
        return get_ist_now().strftime("%Y-%m-%d")

    spreadsheet = retry_api(lambda: service.spreadsheets().get(spreadsheetId=earliest_spreadsheet_id).execute())
    sheets = spreadsheet.get("sheets", [])
    if not sheets:
        return f"{earliest_year}-01-01"

    months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

    earliest_month_idx = 12
    earliest_sheet_title = None

    for s in sheets:
        title = s["properties"]["title"]
        if title.endswith("_Activity_Log"):
            month_str = title.split("_")[0]
            if month_str in months:
                idx = months.index(month_str)
                if idx < earliest_month_idx:
                    earliest_month_idx = idx
                    earliest_sheet_title = title

    if not earliest_sheet_title:
        return f"{earliest_year}-01-01"

    # Get first row of data
    result = retry_api(lambda: service.spreadsheets().values().get(
        spreadsheetId=earliest_spreadsheet_id,
        range=f"'{earliest_sheet_title}'!A2:E2"
    ).execute())

    rows = result.get("values", [])
    if rows and len(rows[0]) >= 3:
        ts = rows[0][2]
        try:
            date_str = ts.split(" ")[0]
            earliest_date_cache = date_str
            return date_str
        except Exception:
            pass

    return f"{earliest_year}-01-01"