import sys
import os

# Add parent directory to path so we can import sheets_service
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sheets_service import service, get_master_spreadsheet_id, EMPLOYEE_MASTER_SHEET, WFH_REQUESTS_SHEET, retry_api

def migrate():
    spreadsheet_id = get_master_spreadsheet_id()
    print(f"Migrating Spreadsheet ID: {spreadsheet_id}")
    
    # 1. Update Employee_Master sheet
    result = retry_api(
        lambda: service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=f"'{EMPLOYEE_MASTER_SHEET}'!A:Z"
        ).execute()
    )
    rows = result.get("values", [])
    if not rows:
        print("Employee Master sheet is empty.")
        return

    headers = [h.strip().upper() for h in rows[0]]
    tg_col_idx = -1
    for i, h in enumerate(headers):
        if h == "TELEGRAM_ID" or h == "DISCORD_ID":
            tg_col_idx = i
            break
            
    if tg_col_idx != -1:
        col_letter = chr(65 + tg_col_idx)
        print(f"Found target column at index {tg_col_idx} (Column {col_letter})")
        
        # Rename header to DISCORD_ID
        retry_api(
            lambda: service.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id,
                range=f"'{EMPLOYEE_MASTER_SHEET}'!{col_letter}1",
                valueInputOption="RAW",
                body={"values": [["DISCORD_ID"]]}
            ).execute()
        )
        print("Renamed header to DISCORD_ID.")
        
        # Clear values in the column for all existing employees (leave header)
        num_rows = len(rows)
        if num_rows > 1:
            clear_range = f"'{EMPLOYEE_MASTER_SHEET}'!{col_letter}2:{col_letter}{num_rows}"
            retry_api(
                lambda: service.spreadsheets().values().clear(
                    spreadsheetId=spreadsheet_id,
                    range=clear_range
                ).execute()
            )
            print(f"Cleared existing IDs in range {clear_range}.")
    else:
        print("TELEGRAM_ID column not found in Employee_Master.")

    # 2. Update wfh_requests sheet header
    result_wfh = retry_api(
        lambda: service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=f"'{WFH_REQUESTS_SHEET}'!1:1"
        ).execute()
    )
    wfh_headers = result_wfh.get("values", [[]])[0]
    wfh_headers = [h.strip().upper() for h in wfh_headers]
    
    tg_wfh_col_idx = -1
    for i, h in enumerate(wfh_headers):
        if h == "TELEGRAM_ID" or h == "DISCORD_ID":
            tg_wfh_col_idx = i
            break
            
    if tg_wfh_col_idx != -1:
        col_letter = chr(65 + tg_wfh_col_idx)
        retry_api(
            lambda: service.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id,
                range=f"'{WFH_REQUESTS_SHEET}'!{col_letter}1",
                valueInputOption="RAW",
                body={"values": [["discord_id"]]}  # Lowercase to match existing style
            ).execute()
        )
        print(f"Renamed header in wfh_requests to discord_id at column {col_letter}.")
    else:
        print("TELEGRAM_ID column not found in wfh_requests.")

    print("Migration complete!")

if __name__ == "__main__":
    migrate()
