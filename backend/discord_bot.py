import os
import asyncio
import threading
import discord
from discord.ext import commands
from discord import app_commands
from sheets_service import (
    register_discord_id,
    get_employee_by_discord_id,
    get_active_employees,
    append_attendance,
    WFH_REQUESTS_SHEET,
    get_master_spreadsheet_id,
    retry_api,
    service,
    update_wfh_status,
    has_approved_wfh
)
import datetime

DISCORD_TOKEN = os.getenv("DISCORD_TOKEN", "").strip()
REQUEST_CHANNEL_ID = os.getenv("REQUEST_CHANNEL_ID", "").strip()
ADMIN_CHANNEL_ID = os.getenv("ADMIN_CHANNEL_ID", "").strip()
_admin_raw = os.getenv("ADMIN_CHAT_ID", "").strip()
ADMIN_IDS = [x.strip() for x in _admin_raw.split(",") if x.strip()]

intents = discord.Intents.default()

bot = commands.Bot(command_prefix="/", intents=intents)

# This will hold the bot's asyncio event loop so Flask can schedule tasks on it
bot_loop = None

class WFHApprovalView(discord.ui.View):
    def __init__(self, discord_id, start_date, end_date, emp_name):
        super().__init__(timeout=None)
        self.discord_id = discord_id
        self.start_date = start_date
        self.end_date = end_date
        self.emp_name = emp_name

    @discord.ui.button(label="Approve", style=discord.ButtonStyle.green, custom_id="approve_wfh")
    async def approve_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.defer()
        if str(interaction.user.id) not in ADMIN_IDS:
            await interaction.followup.send("Only admins can approve requests.", ephemeral=True)
            return

        update_wfh_status(self.discord_id, self.start_date, self.end_date, "approved")
        
        # Disable buttons
        for child in self.children:
            child.disabled = True
        await interaction.message.edit(content=f"✅ Approved WFH for {self.emp_name} ({self.start_date} to {self.end_date}) by <@{interaction.user.id}>", view=self)
        
        # Notify User
        await send_discord_message_async(self.discord_id, f"🎉 Your WFH request from {self.start_date} to {self.end_date} has been APPROVED.")

    @discord.ui.button(label="Reject", style=discord.ButtonStyle.red, custom_id="reject_wfh")
    async def reject_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.defer()
        if str(interaction.user.id) not in ADMIN_IDS:
            await interaction.followup.send("Only admins can reject requests.", ephemeral=True)
            return

        update_wfh_status(self.discord_id, self.start_date, self.end_date, "rejected")
        
        # Disable buttons
        for child in self.children:
            child.disabled = True
        await interaction.message.edit(content=f"❌ Rejected WFH for {self.emp_name} ({self.start_date} to {self.end_date}) by <@{interaction.user.id}>", view=self)
        
        # Notify User
        await send_discord_message_async(self.discord_id, f"😔 Your WFH request from {self.start_date} to {self.end_date} has been REJECTED.")

@bot.event
async def on_ready():
    global bot_loop
    bot_loop = asyncio.get_running_loop()
    print(f"[Discord] Logged in as {bot.user.name}")
    try:
        synced = await bot.tree.sync()
        print(f"[Discord] Synced {len(synced)} command(s)")
    except Exception as e:
        print(f"[Discord] Sync error: {e}")

@bot.tree.command(name="start", description="Link your Discord account to the Attendance System")
async def start(interaction: discord.Interaction, employee_id: str):
    await interaction.response.defer(ephemeral=True)
    if interaction.guild_id is not None:
        await interaction.followup.send("Please use this command in a DM.", ephemeral=True)
        return

    emp_name = register_discord_id(employee_id, interaction.user.id)
    if emp_name:
        await interaction.followup.send(f"✅ Success! Welcome {emp_name}. Your account is linked.")
    else:
        await interaction.followup.send("❌ Error: Invalid Employee ID.", ephemeral=True)

@bot.tree.command(name="in", description="Clock IN for the day")
async def clock_in(interaction: discord.Interaction):
    await interaction.response.defer()
    if interaction.guild_id is not None:
        await interaction.followup.send("Please use this command in a DM.", ephemeral=True)
        return

    emp = get_employee_by_discord_id(interaction.user.id)
    if not emp:
        await interaction.followup.send("❌ You are not linked. Use `/start <employee_id>` first.")
        return

    location = "Home" if has_approved_wfh(datetime.date.today(), discord_id=interaction.user.id) else "Office"
    try:
        timestamp = append_attendance(emp["id"], emp["name"], "IN", location)
        await interaction.followup.send(f"✅ Clocked **IN** at {timestamp} from **{location}**.")
    except Exception as e:
        await interaction.followup.send(f"❌ Error: {str(e)}")

@bot.tree.command(name="out", description="Clock OUT for the day")
async def clock_out(interaction: discord.Interaction):
    await interaction.response.defer()
    if interaction.guild_id is not None:
        await interaction.followup.send("Please use this command in a DM.", ephemeral=True)
        return

    emp = get_employee_by_discord_id(interaction.user.id)
    if not emp:
        await interaction.followup.send("❌ You are not linked. Use `/start <employee_id>` first.")
        return

    location = "Home" if has_approved_wfh(datetime.date.today(), discord_id=interaction.user.id) else "Office"
    try:
        timestamp = append_attendance(emp["id"], emp["name"], "OUT", location)
        await interaction.followup.send(f"✅ Clocked **OUT** at {timestamp} from **{location}**.")
    except Exception as e:
        await interaction.followup.send(f"❌ Error: {str(e)}")

@bot.tree.command(name="wfh", description="Request Work From Home")
async def request_wfh(interaction: discord.Interaction, start_date: str, end_date: str):
    await interaction.response.defer()
    is_valid_channel = (interaction.guild_id is None) or (str(interaction.channel_id) == REQUEST_CHANNEL_ID)
    if not is_valid_channel:
        await interaction.followup.send(f"Please use this command in a DM or the designated WFH request channel.", ephemeral=True)
        return

    emp = get_employee_by_discord_id(interaction.user.id)
    if not emp:
        await interaction.followup.send("❌ You are not linked. Use `/start <employee_id>` first.", ephemeral=True)
        return

    try:
        # Validate dates
        datetime.datetime.strptime(start_date, "%Y-%m-%d")
        datetime.datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        await interaction.followup.send("❌ Invalid date format. Use YYYY-MM-DD.", ephemeral=True)
        return

    # Add to WFH requests sheet
    spreadsheet_id = get_master_spreadsheet_id()
    row = [str(interaction.user.id), start_date, end_date, emp["id"], emp["name"], "pending"]
    retry_api(lambda: service.spreadsheets().values().append(
        spreadsheetId=spreadsheet_id,
        range=f"'{WFH_REQUESTS_SHEET}'!A:F",
        valueInputOption="RAW",
        body={"values": [row]}
    ).execute())

    await interaction.followup.send(f"✅ WFH Request submitted from {start_date} to {end_date}. Waiting for admin approval.")

    # Notify Admins
    admin_msg = f"🔔 **WFH Request**\n**Employee:** {emp['name']}\n**From:** {start_date}\n**To:** {end_date}"
    view = WFHApprovalView(str(interaction.user.id), start_date, end_date, emp["name"])
    
    # Send to admin DMs
    for admin_id in ADMIN_IDS:
        try:
            admin_user = await bot.fetch_user(int(admin_id))
            await admin_user.send(admin_msg, view=view)
        except Exception as e:
            print(f"[Discord] Failed to DM admin {admin_id}: {e}")

    # Send to Admin Channel if configured
    if ADMIN_CHANNEL_ID:
        try:
            admin_channel = await bot.fetch_channel(int(ADMIN_CHANNEL_ID))
            await admin_channel.send(admin_msg, view=view)
        except Exception as e:
            print(f"[Discord] Failed to send to admin channel {ADMIN_CHANNEL_ID}: {e}")

async def send_discord_message_async(target_id: str, message: str):
    """Internal async helper to send a message to a user or channel."""
    try:
        target = await bot.fetch_user(int(target_id))
        await target.send(message)
    except discord.NotFound:
        try:
            target = await bot.fetch_channel(int(target_id))
            await target.send(message)
        except Exception as e:
            print(f"[Discord] Failed to send to channel {target_id}: {e}")
    except Exception as e:
        print(f"[Discord] Failed to send to user {target_id}: {e}")

def send_discord_message_sync(target_id: str, message: str):
    """Thread-safe function for Flask to call to send a message."""
    if bot_loop is not None and not bot_loop.is_closed():
        asyncio.run_coroutine_threadsafe(send_discord_message_async(target_id, message), bot_loop)
    else:
        print(f"[Discord] Cannot send message to {target_id}, bot_loop not ready.")

def run_discord_bot():
    if not DISCORD_TOKEN:
        print("[Discord] No DISCORD_TOKEN found. Bot will not start.")
        return
    bot.run(DISCORD_TOKEN)
