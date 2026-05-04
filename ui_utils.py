from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.screenmanager import SlideTransition

from config import NAVY, GREEN

screen_order = ["vendor", "transport", "hissab"]

def navbar(screen_instance):
    nav = BoxLayout(size_hint_y=None, height=50, spacing=5)

    def switch(screen_name):
        current = screen_instance.manager.current

        if current == screen_name:
            return

        if screen_order.index(screen_name) > screen_order.index(current):
            direction = "left"
        else:
            direction = "right"

        screen_instance.manager.transition = SlideTransition(
            direction=direction,
            duration=0.3
        )
        screen_instance.manager.current = screen_name

    def btn(name, screen):
        return Button(
            text=name,
            background_color=GREEN if screen_instance.name == screen else NAVY,
            on_press=lambda x: switch(screen)
        )

    nav.add_widget(btn("Vendors", "vendor"))
    nav.add_widget(btn("Transport", "transport"))
    nav.add_widget(btn("Hissab", "hissab"))

    return nav