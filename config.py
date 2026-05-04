import pyrebase

# ---------------- FIREBASE ----------------
firebase_config = {
    "apiKey": "your_key",
    "authDomain": "your_domain",
    "databaseURL": "your_url",
    "storageBucket": "your_bucket"
}

# ---------------- Firebase init ----------------
firebase = pyrebase.initialize_app(firebase_config)
db = firebase.database()

# ---------------- COLORS ----------------
NAVY = (0.05, 0.15, 0.35, 1)
RED = (1, 0.4, 0.4, 1)
GREEN = (0.3, 0.7, 0.3, 1)
ORANGE = (1, 0.6, 0.2, 1)
BLACK = (0, 0, 0, 1)