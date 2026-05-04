from datetime import datetime
from PIL import Image, ImageDraw, ImageFont

from kivy.uix.screenmanager import Screen
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.uix.textinput import TextInput
from kivy.clock import Clock
from kivy.uix.gridlayout import GridLayout
from kivy.uix.scrollview import ScrollView
from kivy.uix.screenmanager import SlideTransition

from config import db, NAVY, RED, GREEN, ORANGE, BLACK
from ui_utils import navbar

refresh_interval = 5

# ================= VENDOR SCREEN =================
class VendorScreen(Screen):

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.layout = BoxLayout(orientation="vertical", padding=10, spacing=10)

        # NAVBAR
        self.layout.add_widget(navbar(self))

        # SEARCH
        self.search_input = TextInput(
            hint_text="Search by item...",
            size_hint_y=None,
            height=40
        )
        self.search_input.bind(text=lambda *x: self.load_vendors())
        self.layout.add_widget(self.search_input)

        # ADD
        top = BoxLayout(size_hint_y=None, height=40, spacing=5)

        self.vendor_input = TextInput(hint_text="Vendor Name")
        btn = Button(text="Add", background_color=NAVY)
        btn.bind(on_press=self.add_vendor)

        top.add_widget(self.vendor_input)
        top.add_widget(btn)
        self.layout.add_widget(top)

        # SAVE IMAGE
        save_btn = Button(text="Save as Image", size_hint_y=None, height=40, background_color=GREEN)
        save_btn.bind(on_press=self.save_image)
        self.layout.add_widget(save_btn)

        # LIST
        scroll = ScrollView()
        self.list_layout = GridLayout(cols=1, spacing=5, size_hint_y=None)
        self.list_layout.bind(minimum_height=self.list_layout.setter('height'))

        scroll.add_widget(self.list_layout)
        self.layout.add_widget(scroll)

        self.add_widget(self.layout)

    def on_enter(self):
        self.load_vendors()
        self.event = Clock.schedule_interval(lambda dt: self.load_vendors(), refresh_interval)

    def on_leave(self):
        if hasattr(self, "event"):
            self.event.cancel()

    def load_vendors(self):
        self.list_layout.clear_widgets()

        search = self.search_input.text.lower().strip()

        vendors = db.child("vendors").get()
        orders = db.child("orders").get()

        # SEARCH MODE
        if search:

            header = GridLayout(cols=7, size_hint_y=None, height=40)
            headers = ["Vendor", "Item", "Qty", "Rate", "Amount", "Date", "Status"]

            for h in headers:
                header.add_widget(Label(text=h, color=BLACK))

            self.list_layout.add_widget(header)

            if orders.each():
                for o in orders.each():
                    val = o.val()

                    item = val.get("item", "").lower()

                    if search not in item:
                        continue

                    vendor = val.get("vendor", "")
                    qty = int(val.get("qty", 0))
                    rate = int(val.get("rate", 0))
                    amount = qty * rate
                    status = val.get("status", "")
                    date = val.get("date", "")

                    row = GridLayout(cols=7, size_hint_y=None, height=50)

                    # CLICKABLE VENDOR
                    vendor_btn = Button(text=vendor, background_color=NAVY)
                    vendor_btn.bind(on_press=self.open_vendor)
                    row.add_widget(vendor_btn)

                    values = [val.get("item",""), qty, rate, amount, date]

                    for v in values:
                        row.add_widget(Label(text=str(v), color=BLACK))

                    color = GREEN if status == "received" else ORANGE
                    row.add_widget(Label(text=status, color=color))

                    self.list_layout.add_widget(row)

            return

        # 🔥 NORMAL MODE
        if vendors.each():
            for v in vendors.each():
                name = v.val()["name"]
                key = v.key()

                row = BoxLayout(size_hint_y=None, height=40, spacing=5)

                btn = Button(text=name, background_color=NAVY)
                btn.bind(on_press=self.open_vendor)

                del_btn = Button(text="Delete", background_color=RED)
                del_btn.bind(on_press=lambda inst, k=key: self.delete_vendor(k))

                row.add_widget(btn)
                row.add_widget(del_btn)

                self.list_layout.add_widget(row)

    def add_vendor(self, instance):
        name = self.vendor_input.text.strip()
        if not name:
            return

        db.child("vendors").push({"name": name})
        self.vendor_input.text = ""

    def delete_vendor(self, key):
        db.child("vendors").child(key).remove()

    def open_vendor(self, instance):
        self.manager.get_screen("orders").vendor_name = instance.text
        self.manager.transition = SlideTransition(direction="left", duration=0.2)
        self.manager.current = "orders"

    # EXPORT
    def save_image(self, instance):
        try:
            width = 1400
            line_height = 40
            padding = 30

            from PIL import Image, ImageDraw, ImageFont

            try:
                font = ImageFont.truetype("arial.ttf", 26)
                bold = ImageFont.truetype("arial.ttf", 30)
            except:
                font = ImageFont.load_default()
                bold = font

            vendors = db.child("vendors").get()
            orders = db.child("orders").get()

            vendor_dict = {}

            if vendors.each():
                for v in vendors.each():
                    vendor_dict[v.val()["name"]] = []

            if orders.each():
                for o in orders.each():
                    data = o.val()
                    vendor = data.get("vendor")
                    if vendor in vendor_dict:
                        vendor_dict[vendor].append(data)

            height = 1000
            img = Image.new("RGB", (width, height), "white")
            draw = ImageDraw.Draw(img)

            y = padding

            # TITLE
            draw.text((20, y), "Vendor Export", fill="black", font=bold)
            y += line_height

            draw.line((20, y, width-20, y), fill="black", width=2)
            y += line_height // 2

            for vendor, items in vendor_dict.items():
                draw.text((20, y), vendor, fill="black", font=bold)
                y += line_height

                for o in items:
                    line = (
                        f"- {o.get('item')} | Qty: {o.get('qty')} | "
                        f"Rate: {o.get('rate')} | Total: {o.get('total')} | "
                        f"{o.get('status')} | {o.get('date')}"
                    )

                    draw.text((40, y), line, fill="black", font=font)
                    y += line_height

                y += 10  # spacing between vendors

            filename = f"vendor_export_{datetime.now().strftime('%H%M%S_%d%m%Y')}.png"
            img.save(filename, dpi=(300, 300))

            print("Saved:", filename)

        except Exception as e:
            print("Image error:", e)

# ================= ORDERS SCREEN =================
class OrdersScreen(Screen):

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.orders_cache = []
        self.filter_status = "all"

        self.layout = BoxLayout(orientation="vertical", padding=10, spacing=10)

        # BACK BAR
        top = BoxLayout(size_hint_y=None, height=40, spacing=5)

        back_btn = Button(text="< Back", size_hint_x=0.3, background_color=NAVY)
        back_btn.bind(on_press=lambda x: self.go_back())

        self.title = Label(text="Orders", color=BLACK)

        top.add_widget(back_btn)
        top.add_widget(self.title)
        self.layout.add_widget(top)

        # SEARCH
        self.search_input = TextInput(hint_text="Search...", size_hint_y=None, height=40)
        self.search_input.bind(text=lambda *x: self.display_orders())
        self.layout.add_widget(self.search_input)

        # FILTER
        filter_row = BoxLayout(size_hint_y=None, height=40)
        for f in ["all", "pending", "received"]:
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

        # ADD
        row = BoxLayout(size_hint_y=None, height=40, spacing=5)

        self.item_input = TextInput(hint_text="Item")
        self.qty_input = TextInput(hint_text="Qty")
        self.rate_input = TextInput(hint_text="Rate")
        self.date_input = TextInput(hint_text="Date")

        add = Button(text="Add", background_color=NAVY)
        add.bind(on_press=self.add_item)

        for w in [self.item_input, self.qty_input, self.rate_input, self.date_input, add]:
            row.add_widget(w)

        self.layout.add_widget(row)

        # LIST
        scroll = ScrollView()
        self.list_layout = GridLayout(cols=1, spacing=5, size_hint_y=None)
        self.list_layout.bind(minimum_height=self.list_layout.setter('height'))

        scroll.add_widget(self.list_layout)
        self.layout.add_widget(scroll)

        self.add_widget(self.layout)

    def go_back(self):
        self.manager.transition = SlideTransition(direction="right", duration=0.2)
        self.manager.current = "vendor"

    def set_filter(self, f):
        self.filter_status = f
        self.display_orders()

    def on_enter(self):
        self.title.text = f"Orders - {self.vendor_name}"
        self.load_data()

    def load_data(self):
        self.orders_cache = []
        orders = db.child("orders").get()

        if orders.each():
            for o in orders.each():
                val = o.val()
                val["key"] = o.key()
                self.orders_cache.append(val)

        self.display_orders()

    def add_item(self, instance):
        try:
            qty = int(self.qty_input.text)
            rate = int(self.rate_input.text)
        except:
            return

        db.child("orders").push({
            "vendor": self.vendor_name,
            "item": self.item_input.text.strip(),
            "qty": qty,
            "rate": rate,
            "total": qty * rate,
            "status": "pending",
            "date": self.date_input.text or datetime.now().strftime("%d-%m-%Y")
        })

        self.load_data()

    def display_orders(self):
        self.list_layout.clear_widgets()

        header = GridLayout(cols=7, size_hint_y=None, height=40)
        for h in ["Item","Qty","Rate","Total","Status","",""]:
            header.add_widget(Label(text=h, color=BLACK))

        self.list_layout.add_widget(header)

        for o in self.orders_cache:

            if o["vendor"] != self.vendor_name:
                continue

            if self.filter_status != "all" and o["status"] != self.filter_status:
                continue

            if self.search_input.text and self.search_input.text.lower() not in o["item"].lower():
                continue

            row = GridLayout(cols=7, size_hint_y=None, height=50)

            for val in [o["item"], o["qty"], o["rate"], o["total"]]:
                row.add_widget(Label(text=str(val), color=BLACK))

            status = o["status"]
            row.add_widget(Label(text=status, color=GREEN if status=="received" else RED))

            # MARK BUTTON
            if status == "pending":
                text, color = "Mark Received", GREEN
            else:
                text, color = "Undo", ORANGE

            mark_btn = Button(text=text, background_color=color)
            mark_btn.bind(on_press=lambda inst, data=o.copy(): self.toggle(data))
            row.add_widget(mark_btn)

            # DELETE
            del_btn = Button(text="Delete", background_color=RED)
            del_btn.bind(on_press=lambda inst, data=o.copy(): self.delete_order(data))
            row.add_widget(del_btn)

            self.list_layout.add_widget(row)

    def toggle(self, order):
        new_status = "received" if order["status"] == "pending" else "pending"
        db.child("orders").child(order["key"]).update({"status": new_status})
        self.load_data()

    def delete_order(self, data):
        db.child("orders").child(data["key"]).remove()
        self.load_data()

    # EXPORT
    def save_image(self, instance):
        try:
            from PIL import Image, ImageDraw, ImageFont
            from datetime import datetime

            width = 1400
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
            for o in self.orders_cache:
                if o.get("vendor") != self.vendor_name:
                    continue
                if self.filter_status != "all" and o.get("status") != self.filter_status:
                    continue
                if self.search_input.text and self.search_input.text.lower() not in o.get("item","").lower():
                    continue
                data.append(o)

            height = (len(data) + 6) * line_height
            img = Image.new("RGB", (width, height), "white")
            draw = ImageDraw.Draw(img)

            y = padding

            # TITLE
            draw.text((20, y), f"Orders - {self.vendor_name}", fill="black", font=bold)
            y += line_height

            # 🔥 FILTER INFO
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

            # COLUMN POSITIONS (aligned)
            x = [20, 300, 450, 600, 800, 1100]

            headers = ["Item", "Qty", "Rate", "Total", "Date", "Status"]

            # HEADER
            for i, h in enumerate(headers):
                draw.text((x[i], y), h, fill="black", font=bold)

            y += line_height

            # LINE
            draw.line((20, y, width-20, y), fill="black", width=2)
            y += line_height // 2

            total_qty = 0
            total_amount = 0

            # DATA ROWS
            for o in data:
                qty = int(o.get("qty", 0))
                rate = int(o.get("rate", 0))
                total = qty * rate
                total_qty += qty
                total_amount += total

                row = [
                    o.get("item",""),
                    str(qty),
                    str(rate),
                    str(total),
                    o.get("date",""),
                    o.get("status","")
                ]

                for i, val in enumerate(row):
                    draw.text((x[i], y), val, fill="black", font=font)

                y += line_height

            # TOTAL
            y += 20
            draw.text((20, y), f"Total Quantity: {total_qty} | Total Amount: ₹{total_amount}", fill="black", font=bold)

            # SAVE
            filename = f"orders_export_{self.vendor_name}_{datetime.now().strftime('%H%M%S_%d%m%Y')}.png"
            img.save(filename, dpi=(300, 300))

            print("Saved:", filename)

        except Exception as e:
            print("Image error:", e)