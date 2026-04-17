import requests
import sys
from sheets_service import TELEGRAM_TOKEN

def set_webhook(url):
    webhook_url = f"{url.rstrip('/')}/telegram/webhook"
    api_url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/setWebhook"
    
    print(f"Setting webhook to: {webhook_url}...")
    resp = requests.post(api_url, data={"url": webhook_url})
    
    if resp.status_code == 200:
        print("✅ Webhook set successfully!")
        print("Response:", resp.json())
    else:
        print(f"❌ Failed to set webhook. Status: {resp.status_code}")
        print("Response:", resp.text)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python setup_webhook.py <YOUR_DOMAIN_OR_NGROK_URL>")
        print("Example: python setup_webhook.py https://abc-123.ngrok-free.app")
        sys.exit(1)
        
    url = sys.argv[1]
    if not url.startswith("https://"):
        print("Error: Webhook URL must be HTTPS.")
        sys.exit(1)
        
    set_webhook(url)
