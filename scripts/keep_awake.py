"""Visit the live app so Streamlit Community Cloud doesn't put it to sleep.

Free apps hibernate after about 12 hours without visitors. A scheduled GitHub Action
runs this every 6 hours: if the app is awake, the visit resets the timer; if it is
asleep, it clicks the wake-up button and waits for the app to start.
"""
from playwright.sync_api import sync_playwright

URL = "https://boxiao-review-insight.streamlit.app/"
WAKE_TEXT = "get this app back up"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto(URL, timeout=120_000)
    page.wait_for_timeout(10_000)
    button = page.get_by_role("button", name=WAKE_TEXT)
    if button.count():
        button.first.click()
        print("App was asleep: clicked the wake-up button.")
        page.wait_for_timeout(90_000)  # let it boot and open a session
    else:
        page.wait_for_timeout(30_000)  # stay long enough to count as a visit
        print("App is awake: visit recorded.")
    browser.close()
