# Vendor Transport Management System

## Overview

The Vendor Transport Management System is a desktop application built using Kivy and Firebase Realtime Database. It helps manage vendors, orders, transport dispatch, and financial records in a structured and efficient way.

This system is designed for small-scale business operations where tracking logistics and payments is essential.

---

## Features

* Vendor management (add and delete vendors)
* Order tracking with status (pending / received)
* Transport management with dispatch tracking
* Payment status handling (paid / pending)
* Financial summary (Hissab) with automatic calculations
* Search and filter functionality
* Export reports as images
* Real-time updates using Firebase

---

## Tech Stack

* Python
* Kivy (UI framework)
* Firebase Realtime Database
* Pyrebase
* Pillow (PIL)

---

## Project Structure

```id="struct01"
.
├── main.py
├── config.py (not included)
├── vendor_module.py
├── transport_module.py
├── hissab_module.py
├── ui_utils.py
```

---

## Firebase Setup

Firebase credentials are not included for security reasons.

### Steps:

1. Create a Firebase project
2. Enable Realtime Database
3. Create a file named `config.py` in the project root

```python id="config01"
import pyrebase

firebase_config = {
    "apiKey": "your_api_key",
    "authDomain": "your_project.firebaseapp.com",
    "databaseURL": "https://your_project-default-rtdb.firebaseio.com/",
    "storageBucket": "your_project.appspot.com"
}

firebase = pyrebase.initialize_app(firebase_config)
db = firebase.database()
```

---

## How to Run

Install dependencies:

```bash id="run01"
pip install kivy pyrebase4 pillow
```

Run the application:

```bash id="run02"
python main.py
```

---

## Important Notes

* Do not upload `config.py` to GitHub
* Add the following to `.gitignore`:

```id="ignore01"
config.py
__pycache__/
*.pyc
```

---

## Future Improvements

* User authentication system
* Mobile application version
* Advanced analytics dashboard
* Deployment support

---

## Author

Megh Patel
