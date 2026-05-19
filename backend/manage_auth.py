import sys
import os
import bcrypt
from dotenv import load_dotenv, set_key
import base64
import hashlib
from cryptography.fernet import Fernet

# Load existing .env
load_dotenv()

from sheets_service import (
    validate_credentials, 
    set_allowed_telegram_ids, 
    get_allowed_telegram_ids,
    get_user_by_identifier,
    generate_auth_otp,
    verify_otp_only
)

def get_fernet():
    key = os.getenv("AUTH_MASTER_KEY")
    if not key:
        print("CRITICAL: AUTH_MASTER_KEY not found in .env!")
        print("Please set AUTH_MASTER_KEY in your .env file to a strong secret string first.")
        sys.exit(1)
    
    key_hashed = hashlib.sha256(key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key_hashed))

def update_env_file(encrypted_data):
    env_path = ".env"
    set_key(env_path, "ALLOWED_TELEGRAM_IDS", encrypted_data)
    print(f"✅ .env file updated with encrypted list.")

def main():
    if len(sys.argv) < 4:
        print("Usage: python3 manage_auth.py <admin_id_or_name> <action> <target_tg_id> [<new_tg_id>]")
        print("Actions: add, del, update")
        sys.exit(1)

    admin_identifier = sys.argv[1]
    action = sys.argv[2].lower()
    target_id = sys.argv[3]
    new_id = sys.argv[4] if len(sys.argv) > 4 else None

    # 1. Get current allowed IDs
    current_ids = get_allowed_telegram_ids()
    
    # 2. Authenticate Admin (unless bootstrapping)
    is_bootstrap = not current_ids and action == "add"
    
    if is_bootstrap:
        print(f"⚠️  Authorized list is empty. Entering BOOTSTRAP mode.")
        print(f"Adding first ID '{target_id}' without admin check.")
        admin_user = {'name': 'Initial Setup', 'role': 'admin'}
    else:
        print(f"🔍 Looking up admin: {admin_identifier}...")
        admin_user = get_user_by_identifier(admin_identifier)
        
        if not admin_user:
            print(f"❌ User '{admin_identifier}' not found in employee master.")
            sys.exit(1)
            
        if admin_user['role'] != 'admin':
            print(f"❌ Unauthorized: Only users with 'admin' role can manage auth settings.")
            sys.exit(1)
            
        if not admin_user['telegram_id']:
            print(f"❌ Error: Admin '{admin_user['name']}' does not have a Telegram ID linked.")
            sys.exit(1)

        # Send OTP
        print(f"📲 Sending OTP to {admin_user['name']} via Telegram...")
        success, result = generate_auth_otp(admin_identifier)
        if not success:
            print(f"❌ Failed to send OTP: {result}")
            sys.exit(1)
            
        # Prompt for OTP
        otp_input = input(f"🔐 Enter the 6-digit OTP sent to Telegram (ID: {admin_user['telegram_id']}): ").strip()
        
        # Verify OTP
        success, msg = verify_otp_only(admin_user['id'], otp_input)
        if not success:
            print(f"❌ {msg}")
            sys.exit(1)
            
        print(f"✅ Welcome {admin_user['name']}!")
    
    print(f"📋 Current allowed IDs: {current_ids}")

    # 3. Perform action
    if action == "add":
        if target_id in current_ids:
            print(f"⚠️ ID {target_id} is already in the list.")
        else:
            current_ids.append(target_id)
            print(f"➕ Added {target_id}")
    
    elif action == "del":
        if target_id not in current_ids:
            print(f"⚠️ ID {target_id} not found in the list.")
        else:
            current_ids.remove(target_id)
            print(f"➖ Deleted {target_id}")
            
    elif action == "update":
        if not new_id:
            print("❌ Error: update action requires a <new_tg_id>")
            sys.exit(1)
        if target_id not in current_ids:
            print(f"⚠️ ID {target_id} not found in the list.")
        else:
            idx = current_ids.index(target_id)
            current_ids[idx] = new_id
            print(f"🔄 Updated {target_id} -> {new_id}")
    else:
        print(f"❌ Unknown action: {action}")
        sys.exit(1)

    # 4. Encrypt and save
    encrypted = set_allowed_telegram_ids(current_ids)
    update_env_file(encrypted)
    print("✨ Done.")

if __name__ == "__main__":
    main()
