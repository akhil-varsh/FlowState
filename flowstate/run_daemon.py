"""Frozen-app entry point for the FlowState daemon.

PyInstaller needs a real script (not ``python -m daemon.main``). Running
``daemon/main.py`` directly would break its package-relative imports, so this
top-level shim imports the package properly and starts the server.
"""

from daemon.main import run

if __name__ == "__main__":
    run()
