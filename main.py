from config import db, NAVY, RED, GREEN, ORANGE, BLACK
from kivy.app import App
from kivy.uix.screenmanager import ScreenManager
from kivy.core.window import Window

# ---------------- WINDOW ----------------
Window.clearcolor = (1, 1, 1, 1)

# ---------------- APP ----------------
class MyApp(App):
    def build(self):

        # Import here to avoid circular import
        from vendor_module import VendorScreen, OrdersScreen
        from transport_module import TransportScreen
        from hissab_module import HissabScreen

        sm = ScreenManager()

        sm.add_widget(VendorScreen(name="vendor"))
        sm.add_widget(OrdersScreen(name="orders"))
        sm.add_widget(TransportScreen(name="transport"))
        sm.add_widget(HissabScreen(name="hissab"))

        return sm


MyApp().run()