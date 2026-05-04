from datetime import datetime

from kivy.uix.screenmanager import Screen
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.uix.textinput import TextInput
from kivy.uix.spinner import Spinner
from kivy.clock import Clock
from kivy.uix.gridlayout import GridLayout
from kivy.uix.scrollview import ScrollView
from kivy.graphics import Color, Line

from config import db, NAVY, RED, GREEN, ORANGE, BLACK
from ui_utils import navbar

refresh_interval = 5

# ================= Transport Screen =================
class TransportScreen(Screen):

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.data_cache = []
        self.filter_status = "all"

        self.layout = BoxLayout(orientation="vertical", padding=10, spacing=10)

        # 🔝 NAVBAR
        self.layout.add_widget(navbar(self))

        # 🔍 SEARCH
        self.search_input = TextInput(
            hint_text="Search (LR / Vendor / City / Item)...",
            size_hint_y=None,
            height=40
        )
        self.search_input.bind(text=lambda *x: self.display())
        self.layout.add_widget(self.search_input)

        # ➕ ENTRY
        row = BoxLayout(size_hint_y=None, height=40, spacing=5)

        self.lr_input = TextInput(hint_text="LR No")
        self.vendor_spinner = Spinner(text="Select Vendor", values=[])
        self.transport_input = TextInput(hint_text="Transport")
        self.city_input = TextInput(hint_text="City")
        self.item_input = TextInput(hint_text="Item")
        self.qty_input = TextInput(hint_text="Total Qty")
        self.rate_input = TextInput(hint_text="Rate")

        add = Button(text="Add", background_color=NAVY)
        add.bind(on_press=self.add_entry)

        for w in [
            self.lr_input,
            self.vendor_spinner,
            self.transport_input,
            self.city_input,
            self.item_input,
            self.qty_input,
            self.rate_input,
            add
        ]:
            row.add_widget(w)

        self.layout.add_widget(row)

        # 🔁 DISPATCH
        dispatch_row = BoxLayout(size_hint_y=None, height=40, spacing=5)

        self.dispatch_lr = TextInput(hint_text="LR No")
        self.dispatch_qty = TextInput(hint_text="Dispatch Qty")

        dispatch_btn = Button(text="Dispatch", background_color=GREEN)
        dispatch_btn.bind(on_press=self.handle_dispatch)

        dispatch_row.add_widget(self.dispatch_lr)
        dispatch_row.add_widget(self.dispatch_qty)
        dispatch_row.add_widget(dispatch_btn)

        self.layout.add_widget(dispatch_row)

        # FILTER
        filter_row = BoxLayout(size_hint_y=None, height=40)
        for f in ["all", "pending", "paid"]:
            b = Button(text=f.capitalize(), background_color=NAVY)
            b.bind(on_press=lambda inst, f=f: self.set_filter(f))
            filter_row.add_widget(b)
        self.layout.add_widget(filter_row)

        # EXPORT
        save_btn = Button(
            text="Save as Image",
            size_hint_y=None,
            height=40,
            background_color=GREEN
        )
        save_btn.bind(on_press=self.save_image)

        self.layout.add_widget(save_btn)

        # 📋 TABLE
        scroll = ScrollView()

        self.list_layout = GridLayout(cols=1, spacing=2, size_hint_y=None)
        self.list_layout.bind(minimum_height=self.list_layout.setter('height'))

        scroll.add_widget(self.list_layout)
        self.layout.add_widget(scroll)

        self.add_widget(self.layout)

    # ---------------- TABLE CELL ----------------
    def cell(self, text, bold=False):
        lbl = Label(
            text=str(text),
            color=BLACK,
            halign="center",
            valign="middle",
            bold=bold
        )

        lbl.bind(size=lambda inst, val: setattr(inst, 'text_size', val))

        with lbl.canvas.before:
            Color(0, 0, 0, 0.2)
            lbl.rect = Line(rectangle=(0, 0, 0, 0), width=1)

        def update_rect(inst, val):
            inst.rect.rectangle = (inst.x, inst.y, inst.width, inst.height)

        lbl.bind(pos=update_rect, size=update_rect)

        return lbl

    # ---------------- NAV ----------------
    def on_enter(self):
        self.load_data()
        self.load_vendors()
        self.event = Clock.schedule_interval(lambda dt: self.load_data(), refresh_interval)

    def on_leave(self):
        if hasattr(self, "event"):
            self.event.cancel()

    # ---------------- LOAD VENDORS ----------------
    def load_vendors(self):
        try:
            vendors = db.child("vendors").get()
            names = [v.val()["name"] for v in vendors.each()] if vendors.each() else []
            self.vendor_spinner.values = names
        except:
            pass

    # ---------------- ADD ----------------
    def add_entry(self, instance):
        try:
            qty = int(self.qty_input.text)
            rate = int(self.rate_input.text)
        except:
            return

        vendor = self.vendor_spinner.text
        if vendor == "Select Vendor":
            return

        db.child("transport").push({
            "lr": self.lr_input.text.strip(),
            "vendor": vendor,
            "transport": self.transport_input.text.strip(),
            "city": self.city_input.text.strip(),
            "item": self.item_input.text.strip(),
            "total_qty": qty,
            "rate": rate,
            "total": qty * rate,
            "dispatched": 0,
            "status": "pending",
            "date": datetime.now().strftime("%d-%m-%Y")
        })

        # clear inputs
        self.lr_input.text = ""
        self.transport_input.text = ""
        self.city_input.text = ""
        self.item_input.text = ""
        self.qty_input.text = ""
        self.rate_input.text = ""
        self.vendor_spinner.text = "Select Vendor"

    # ---------------- LOAD ----------------
    def load_data(self):
        self.data_cache = []

        data = db.child("transport").get()

        if data.each():
            for d in data.each():
                val = d.val()
                val["key"] = d.key()
                self.data_cache.append(val)

        self.display()

    # ---------------- FILTER ----------------
    def set_filter(self, f):
        self.filter_status = f
        self.display()

    # ---------------- DISPLAY ----------------
    def display(self):
        self.list_layout.clear_widgets()

        self.data_cache.sort(key=lambda x: x.get("date",""), reverse=True)

        # HEADER
        header = GridLayout(cols=12, size_hint_y=None, height=40)

        headers = ["LR","Vendor","City","Item","Quantity","Dispatch","Left","Rate","Amount","Status","",""]

        for h in headers:
            header.add_widget(self.cell(h, bold=True))

        self.list_layout.add_widget(header)

        search = self.search_input.text.lower()
        total_sum = 0

        for d in self.data_cache:

            if search:
                if not (
                    search in d.get("lr","").lower()
                    or search in d.get("vendor","").lower()
                    or search in d.get("city","").lower()
                    or search in d.get("item","").lower()
                ):
                    continue

            if self.filter_status != "all" and d.get("status") != self.filter_status:
                continue

            disp = d.get("dispatched", 0)
            total = d.get("total_qty", 0)
            pend = total - disp

            total_sum += d.get("total", 0)

            row = GridLayout(cols=12, size_hint_y=None, height=50)

            values = [
                d.get("lr",""),
                d.get("vendor",""),
                d.get("city",""),
                d.get("item",""),
                total,
                disp,
                pend,
                d.get("rate",""),
                f"₹{d.get("total","")}"
            ]

            for val in values:
                row.add_widget(self.cell(val))

            # STATUS
            status = d.get("status","")
            color = GREEN if status == "paid" else RED
            row.add_widget(Label(text=status, color=color, halign="center"))

            # BUTTONS
            pay_btn = Button(
                text="Mark Paid" if status == "pending" else "Undo",
                background_color=ORANGE
            )
            pay_btn.bind(on_press=lambda inst, data=d: self.toggle_payment(data))

            del_btn = Button(text="Delete", background_color=RED)
            del_btn.bind(on_press=lambda inst, data=d: self.delete(data))

            row.add_widget(pay_btn)
            row.add_widget(del_btn)

            self.list_layout.add_widget(row)

        # TOTAL ROW
        total_row = GridLayout(cols=12, size_hint_y=None, height=50)

        total_row.add_widget(self.cell("TOTAL", bold=True))

        for _ in range(7):
            total_row.add_widget(self.cell(""))

        total_row.add_widget(self.cell(f"₹{total_sum}", bold=True))

        total_row.add_widget(self.cell(""))
        total_row.add_widget(self.cell(""))
        total_row.add_widget(self.cell(""))

        self.list_layout.add_widget(total_row)

    # ---------------- DISPATCH ----------------
    def handle_dispatch(self, instance):
        lr = self.dispatch_lr.text.strip()

        try:
            qty = int(self.dispatch_qty.text)
        except:
            return

        found = next((d for d in self.data_cache if d.get("lr") == lr), None)
        if not found:
            return

        current = found.get("dispatched", 0)
        total = found.get("total_qty", 0)

        qty = min(qty, total - current)

        db.child("transport").child(found["key"]).update({
            "dispatched": current + qty
        })

    # ---------------- PAYMENT ----------------
    def toggle_payment(self, data):
        new_status = "paid" if data.get("status") == "pending" else "pending"
        db.child("transport").child(data["key"]).update({"status": new_status})

    # ---------------- DELETE ----------------
    def delete(self, data):
        db.child("transport").child(data["key"]).remove()
    
    # ---------------- SAVE IMAGE ----------------
    def save_image(self, instance):
        try:
            from PIL import Image, ImageDraw, ImageFont
            from datetime import datetime

            width = 1600
            line_height = 50
            padding = 30

            # Fonts
            try:
                font = ImageFont.truetype("arial.ttf", 24)
                bold = ImageFont.truetype("arial.ttf", 28)
            except:
                font = ImageFont.load_default()
                bold = font

            # 🔥 FILTERED DATA (same as UI)
            data = []
            for d in self.data_cache:

                search = self.search_input.text.lower()

                if search:
                    if not (
                        search in d.get("lr","").lower()
                        or search in d.get("vendor","").lower()
                        or search in d.get("city","").lower()
                        or search in d.get("item","").lower()
                    ):
                        continue

                if self.filter_status != "all" and d.get("status") != self.filter_status:
                    continue

                data.append(d)

            height = (len(data) + 8) * line_height
            img = Image.new("RGB", (width, height), "white")
            draw = ImageDraw.Draw(img)

            y = padding

            # TITLE
            draw.text((20, y), "Transport Report", fill="black", font=bold)
            y += line_height

            # FILTER INFO
            filter_text = "Filters: "

            if self.filter_status != "all":
                filter_text += f"Status = {self.filter_status} | "

            if self.search_input.text:
                filter_text += f"Search = {self.search_input.text} | "

            if filter_text == "Filters: ":
                filter_text += "None"
            else:
                filter_text = filter_text.rstrip(" | ")

            draw.text((20, y), filter_text, fill="black", font=font)
            y += line_height

            # COLUMN POSITIONS
            x = [20, 120, 320, 520, 720, 880, 1040, 1180, 1350]

            headers = ["LR", "Vendor", "City", "Item", "Qty", "Dispatch", "Left", "Rate", "Amount"]

            for i, h in enumerate(headers):
                draw.text((x[i], y), h, fill="black", font=bold)

            y += line_height

            draw.line((20, y, width-20, y), fill="black", width=2)
            y += line_height // 2

            total_amount = 0

            # DATA ROWS
            for d in data:
                total = d.get("total_qty", 0)
                disp = d.get("dispatched", 0)
                left = total - disp

                amount = d.get("total", 0)
                total_amount += amount

                row = [
                    d.get("lr",""),
                    d.get("vendor",""),
                    d.get("city",""),
                    d.get("item",""),
                    str(total),
                    str(disp),
                    str(left),
                    str(d.get("rate","")),
                    f"₹{amount}"
                ]

                for i, val in enumerate(row):
                    draw.text((x[i], y), val, fill="black", font=font)

                y += line_height

            # TOTAL
            y += 20
            draw.text((20, y), f"Total Amount: ₹{total_amount}", fill="black", font=bold)

            # SAVE
            filename = f"transport_export_{datetime.now().strftime('%H%M%S_%d%m%Y')}.png"
            img.save(filename, dpi=(300, 300))

            print("Saved:", filename)

        except Exception as e:
            print("Image error:", e)