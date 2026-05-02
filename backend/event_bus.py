import queue

clients = []

def notify_clients(message='{"type": "attendance_update"}'):
    """Broadcasts a message to all connected SSE clients."""
    # Iterate over a copy of the list to avoid issues if clients disconnect during iteration
    for q in list(clients):
        try:
            q.put_nowait(message)
        except queue.Full:
            pass
