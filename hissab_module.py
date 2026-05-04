from kivy.uix.screenmanager import Screen
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.uix.spinner import Spinner
from kivy.clock import Clock
from kivy.uix.gridlayout import GridLayout
from kivy.uix.scrollview import ScrollView
from kivy.graphics import Color, Line

from config import db, NAVY, GREEN, BLACK
from ui_utils import navbar

refresh_interval = 5

class HissabScreen(Screen):

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.data_cache = []
        self.selected_vendor = ""
        self.selected_city = ""

        self.layout = BoxLayout(orientation="vertical", padding=10, spacing=10)

        # 🔝 NAVBAR
        self.layout.add_widget(navbar(self))

        # 🔍 FILTER (AUTO DROPDOWN)
        filter_row = BoxLayout(size_hint_y=None, height=40, spacing=5)

        self.vendor_spinner = Spinner(text="Select Vendor", values=[])
        self.city_spinner = Spinner(text="Select City", values=[])

        # 🔥 AUTO FILTER (NO BUTTON)
        self.vendor_spinner.bind(text=lambda *x: self.on_filter_change())
        self.city_spinner.bind(text=lambda *x: self.on_filter_change())

        filter_row.add_widget(self.vendor_spinner)
        filter_row.add_widget(self.city_spinner)

        self.layout.add_widget(filter_row)

        # 📋 TABLE
        scroll = ScrollView()

        self.list_layout = GridLayout(cols=1, spacing=2, size_hint_y=None)
        self.list_layout.bind(minimum_height=self.list_layout.setter('height'))

        scroll.add_widget(self.list_layout)
        self.layout.add_widget(scroll)

        # 💰 TOTAL
        self.total_label = Label(
            text="Total: 0",
            size_hint_y=None,
            height=40,
            color=BLACK
        )
        self.layout.add_widget(self.total_label)

        self.add_widget(self.layout)

    # ---------------- CELL ----------------
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
        self.selected_vendor = ""
        self.selected_city = ""

        self.load_data()
        self.event = Clock.schedule_interval(lambda dt: self.load_data(), refresh_interval)

    def on_leave(self):
        if hasattr(self, "event"):
            self.event.cancel()

    # ---------------- LOAD ----------------
    def load_data(self):
        self.data_cache = []

        try:
            data = db.child("transport").get()

            if data.each():
                for d in data.each():
                    val = d.val()
                    val["key"] = d.key()
                    self.data_cache.append(val)

            # 🔥 LOAD DROPDOWN VALUES
            vendors = set()
            cities = set()

            for d in self.data_cache:
                vendors.add(d.get("vendor", ""))
                cities.add(d.get("city", ""))

            self.vendor_spinner.values = ["Select Vendor"] + sorted(vendors)
            self.city_spinner.values = ["Select City"] + sorted(cities)

            self.display()

        except Exception as e:
            print("Load error:", e)

    # ---------------- AUTO FILTER ----------------
    def on_filter_change(self):
        self.selected_vendor = "" if self.vendor_spinner.text == "Select Vendor" else self.vendor_spinner.text
        self.selected_city = "" if self.city_spinner.text == "Select City" else self.city_spinner.text

        self.display()

    # ---------------- DISPLAY ----------------
    def display(self):
        self.list_layout.clear_widgets()

        columns = []

        if not self.selected_vendor:
            columns.append("Vendor")

        if not self.selected_city:
            columns.append("City")

        columns += ["LR", "Qty", "Amount"]

        col_count = len(columns)

        # HEADER
        header = GridLayout(cols=col_count, size_hint_y=None, height=40)

        for col in columns:
            header.add_widget(self.cell(col, bold=True))

        self.list_layout.add_widget(header)

        total_sum = 0

        for d in self.data_cache:

            try:
                vendor = d.get("vendor", "")
                city = d.get("city", "")

                # FILTER
                if self.selected_vendor and vendor != self.selected_vendor:
                    continue

                if self.selected_city and city != self.selected_city:
                    continue

                disp = d.get("dispatched", 0)
                rate = d.get("rate", 0)

                # 🔥 KEEP YOUR LOGIC (ONLY DISPATCHED)
                if disp <= 0:
                    continue

                amount = disp * rate
                total_sum += amount

                row = GridLayout(cols=col_count, size_hint_y=None, height=40)

                values = []

                if not self.selected_vendor:
                    values.append(vendor)

                if not self.selected_city:
                    values.append(city)

                values += [
                    d.get("lr", ""),
                    disp,
                    amount
                ]

                for val in values:
                    row.add_widget(self.cell(val))

                self.list_layout.add_widget(row)

            except Exception as e:
                print("Row error:", e)

        self.total_label.text = f"Total: ₹{total_sum}"