"""FlowState desktop companion (Phase 9).

A small, always-on-top card that lives in the bottom-right corner. It shows your
last capture and, on demand, the "where you left off" briefing — so you never
have to open the dashboard URL. It also carries the recording on/off switch,
wired to the daemon's kill switch.

Standard library only (tkinter + urllib), so it needs no extra dependencies and
bundles cleanly. Talks only to the local daemon on 127.0.0.1.
"""

from __future__ import annotations

import json
import os
import queue
import threading
import tkinter as tk
import tkinter.font as tkfont
import urllib.request
import webbrowser
from datetime import datetime, timezone

DAEMON = os.environ.get("FLOWSTATE_DAEMON_URL", "http://127.0.0.1:8420")
DASHBOARD = os.environ.get("FLOWSTATE_DASHBOARD_URL", "http://127.0.0.1:3000/dashboard")

# --- palette (FlowState dark) --------------------------------------------
BG = "#0B1215"
CARD = "#101A1F"
PANEL = "#0E181C"
LINE = "#1E2E34"
INK = "#E7EEEC"
MUTED = "#8598A0"
FAINT = "#5C6E73"
TEAL = "#2DD4BF"
TEAL_DIM = "#12494A"
AMBER = "#E0A63C"
GOOD = "#3DBE8B"

MARGIN = 18
WIDTH = 340


def _get(path, timeout=3):
    with urllib.request.urlopen(f"{DAEMON}{path}", timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def _post(path, timeout=60):
    req = urllib.request.Request(f"{DAEMON}{path}", method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def _ago(iso: str) -> str:
    try:
        t = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        secs = (datetime.now(timezone.utc) - t).total_seconds()
    except Exception:
        return ""
    if secs < 60:
        return "just now"
    if secs < 3600:
        return f"{int(secs // 60)}m ago"
    if secs < 86400:
        return f"{int(secs // 3600)}h ago"
    return f"{int(secs // 86400)}d ago"


class Widget:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("FlowState")
        self.root.overrideredirect(True)
        self.root.attributes("-topmost", True)
        self.root.configure(bg=BG)
        try:
            self.root.attributes("-alpha", 0.98)
        except Exception:
            pass

        self.q: "queue.Queue" = queue.Queue()
        self.recording = True
        self.daemon_up = False
        self.collapsed = False
        self._drag = (0, 0)

        base = tkfont.nametofont("TkDefaultFont").actual()["family"]
        self.f_title = tkfont.Font(family=base, size=11, weight="bold")
        self.f_body = tkfont.Font(family=base, size=9)
        self.f_small = tkfont.Font(family=base, size=8)
        self.f_head = tkfont.Font(family=base, size=12, weight="bold")
        self.f_mono = tkfont.Font(family="Consolas", size=8)

        self._build()
        self._place(collapsed=False)
        self._bind_drag(self.header)
        self._bind_drag(self.title_lbl)

        self.root.after(150, self._drain)
        self._refresh()                      # first load
        self.root.after(5000, self._tick)    # periodic light refresh

    # -- layout -----------------------------------------------------------
    def _build(self):
        self.card = tk.Frame(self.root, bg=CARD, highlightthickness=1,
                             highlightbackground=LINE, bd=0)
        self.card.pack(fill="both", expand=True, padx=1, pady=1)

        # Header
        self.header = tk.Frame(self.card, bg=CARD)
        self.header.pack(fill="x", padx=12, pady=(10, 6))
        self.dot = tk.Label(self.header, text="●", bg=CARD, fg=TEAL,
                            font=self.f_body)
        self.dot.pack(side="left")
        self.title_lbl = tk.Label(self.header, text="  FlowState", bg=CARD, fg=INK,
                                  font=self.f_title)
        self.title_lbl.pack(side="left")
        self.collapse_btn = tk.Label(self.header, text="–", bg=CARD, fg=MUTED,
                                     font=self.f_title, cursor="hand2")
        self.collapse_btn.pack(side="right", padx=(6, 0))
        self.collapse_btn.bind("<Button-1>", lambda e: self._toggle_collapse())
        self.menu_btn = tk.Label(self.header, text="⋮", bg=CARD, fg=MUTED,
                                 font=self.f_title, cursor="hand2")
        self.menu_btn.pack(side="right")
        self.menu_btn.bind("<Button-1>", self._show_menu)

        # Recording toggle
        self.toggle = tk.Label(self.card, text="●  Recording", bg=TEAL_DIM,
                               fg=TEAL, font=self.f_small, cursor="hand2",
                               padx=10, pady=5)
        self.toggle.pack(fill="x", padx=12, pady=(0, 8))
        self.toggle.bind("<Button-1>", lambda e: self._toggle_recording())

        # Last-capture line
        self.status = tk.Label(self.card, text="connecting to daemon…", bg=CARD,
                               fg=MUTED, font=self.f_small, anchor="w",
                               justify="left", wraplength=WIDTH - 28)
        self.status.pack(fill="x", padx=12, pady=(0, 8))

        # "Where you left off" button
        self.restore_btn = tk.Label(self.card, text="Where you left off  ▸",
                                    bg=PANEL, fg=INK, font=self.f_body, cursor="hand2",
                                    padx=10, pady=7, highlightthickness=1,
                                    highlightbackground=LINE)
        self.restore_btn.pack(fill="x", padx=12, pady=(0, 8))
        self.restore_btn.bind("<Button-1>", lambda e: self._restore())

        # Briefing area (hidden until used)
        self.brief = tk.Frame(self.card, bg=CARD)
        self.brief_head = tk.Label(self.brief, text="", bg=CARD, fg=INK,
                                   font=self.f_head, anchor="w", justify="left",
                                   wraplength=WIDTH - 28)
        self.brief_head.pack(fill="x", pady=(0, 4))
        self.brief_next = tk.Label(self.brief, text="", bg=CARD, fg=MUTED,
                                   font=self.f_body, anchor="w", justify="left",
                                   wraplength=WIDTH - 28)
        self.brief_next.pack(fill="x", pady=(0, 6))
        self.brief_files = tk.Label(self.brief, text="", bg=CARD, fg=TEAL,
                                    font=self.f_mono, anchor="w", justify="left",
                                    wraplength=WIDTH - 28)
        self.brief_files.pack(fill="x")

        # Footer
        self.footer = tk.Frame(self.card, bg=CARD)
        self.footer.pack(fill="x", padx=12, pady=(4, 10))
        self.dash_btn = tk.Label(self.footer, text="Open dashboard", bg=CARD,
                                 fg=MUTED, font=self.f_small, cursor="hand2")
        self.dash_btn.pack(side="left")
        self.dash_btn.bind("<Button-1>", lambda e: webbrowser.open(DASHBOARD))
        tk.Label(self.footer, text="127.0.0.1:8420", bg=CARD, fg=FAINT,
                 font=self.f_small).pack(side="right")

    def _place(self, collapsed=False):
        self.root.update_idletasks()
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        w = WIDTH
        h = self.root.winfo_reqheight()
        x = sw - w - MARGIN
        y = sh - h - 60
        self.root.geometry(f"{w}x{h}+{x}+{y}")

    # -- interaction ------------------------------------------------------
    def _bind_drag(self, wdg):
        wdg.bind("<Button-1>", self._drag_start)
        wdg.bind("<B1-Motion>", self._drag_move)

    def _drag_start(self, e):
        self._drag = (e.x_root - self.root.winfo_x(), e.y_root - self.root.winfo_y())

    def _drag_move(self, e):
        self.root.geometry(f"+{e.x_root - self._drag[0]}+{e.y_root - self._drag[1]}")

    def _toggle_collapse(self):
        self.collapsed = not self.collapsed
        for w in (self.toggle, self.status, self.restore_btn, self.brief, self.footer):
            if self.collapsed:
                w.pack_forget()
            elif w is not self.brief:
                # re-pack in original order (brief only if it has content)
                pass
        if not self.collapsed:
            self._repack()
        self.collapse_btn.config(text="+" if self.collapsed else "–")
        self.root.after(10, lambda: self._place())

    def _repack(self):
        self.toggle.pack(fill="x", padx=12, pady=(0, 8))
        self.status.pack(fill="x", padx=12, pady=(0, 8))
        self.restore_btn.pack(fill="x", padx=12, pady=(0, 8))
        if self.brief_head.cget("text"):
            self.brief.pack(fill="x", padx=12, pady=(0, 8))
        self.footer.pack(fill="x", padx=12, pady=(4, 10))

    def _show_menu(self, e):
        m = tk.Menu(self.root, tearoff=0, bg=CARD, fg=INK,
                    activebackground=TEAL_DIM, activeforeground=INK, bd=0)
        m.add_command(label="Pause recording" if self.recording else "Resume recording",
                      command=self._toggle_recording)
        m.add_command(label="Where you left off", command=self._restore)
        m.add_command(label="Open dashboard", command=lambda: webbrowser.open(DASHBOARD))
        m.add_separator()
        m.add_command(label="Quit widget", command=self.root.destroy)
        try:
            m.tk_popup(e.x_root, e.y_root)
        finally:
            m.grab_release()

    def _toggle_recording(self):
        target = not self.recording
        self._run(lambda: _post(f"/recording?enabled={'true' if target else 'false'}"),
                  tag="recording")

    def _restore(self):
        self.brief_head.config(text="Reading your snapshot…")
        self.brief_next.config(text="the local model is thinking")
        self.brief_files.config(text="")
        self.brief.pack(fill="x", padx=12, pady=(0, 8))
        self.root.after(10, lambda: self._place())
        self._run(lambda: _get("/restore", timeout=120), tag="restore")

    # -- background fetches ----------------------------------------------
    def _run(self, fn, tag):
        def work():
            try:
                self.q.put((tag, fn()))
            except Exception as err:
                self.q.put((tag, {"__error__": str(err)}))
        threading.Thread(target=work, daemon=True).start()

    def _refresh(self):
        self._run(lambda: _get("/recording"), tag="recording")
        self._run(lambda: _get("/history?limit=1"), tag="history")

    def _tick(self):
        self._refresh()
        self.root.after(6000, self._tick)

    def _drain(self):
        try:
            while True:
                tag, data = self.q.get_nowait()
                self._apply(tag, data)
        except queue.Empty:
            pass
        self.root.after(150, self._drain)

    # -- apply results to UI ---------------------------------------------
    def _apply(self, tag, data):
        if isinstance(data, dict) and "__error__" in data:
            if tag in ("recording", "history"):
                self.daemon_up = False
                self._render_state()
            elif tag == "restore":
                self.brief_head.config(text="Daemon not reachable")
                self.brief_next.config(text="Is FlowState running on 127.0.0.1:8420?")
            return

        self.daemon_up = True
        if tag == "recording":
            self.recording = bool(data.get("enabled", True))
            self._render_state()
        elif tag == "history":
            items = data if isinstance(data, list) else []
            if items:
                it = items[0]
                trg = str(it.get("trigger", "")).replace("_", " ")
                self.status.config(
                    text=f"last: {it.get('workspace_name','?')}  ·  {trg}  ·  {_ago(it.get('timestamp',''))}"
                )
            else:
                self.status.config(text="no captures yet — press Ctrl+Alt+S in VS Code")
        elif tag == "restore":
            s = (data or {}).get("summary") or {}
            self.brief_head.config(text=s.get("headline", "(no briefing)"))
            self.brief_next.config(text=s.get("next_step", ""))
            files = s.get("files_to_reopen", []) or []
            self.brief_files.config(text="\n".join(files[:4]))
            self.root.after(10, lambda: self._place())

    def _render_state(self):
        if not self.daemon_up:
            self.dot.config(fg=AMBER)
            self.toggle.config(text="●  Daemon offline", bg="#33230E", fg=AMBER)
            return
        if self.recording:
            self.dot.config(fg=TEAL)
            self.toggle.config(text="●  Recording", bg=TEAL_DIM, fg=TEAL)
        else:
            self.dot.config(fg=FAINT)
            self.toggle.config(text="⏸  Paused — click to record", bg="#161B1E", fg=MUTED)

    def run(self):
        self.root.mainloop()


if __name__ == "__main__":
    Widget().run()
