// Trigger manager — detects interruptions and fires automatic snapshots.
//
// Detection lives here (not in the daemon) because VS Code exposes the reliable
// signals: window focus via onDidChangeWindowState, and user activity via the
// editor event stream. This keeps monitoring event-driven — no polling, near
// zero idle CPU. The policy (thresholds) comes from the daemon's /config so
// there is one authoritative place to tune it.
//
// - focus_loss: window unfocused for >= focus_debounce_seconds (a quick
//   alt-tab, refocusing before the timer, does NOT fire).
// - idle: no editor activity for idle_seconds while the window stays focused.
// - a min-interval cooldown prevents automatic snapshots from piling up.

import * as vscode from "vscode";
import { getPolicy, TriggerPolicy } from "./daemonClient";
import { Trigger } from "./types";

const DEFAULT_POLICY: TriggerPolicy = {
  focus_debounce_seconds: 12,
  idle_seconds: 300,
  min_capture_interval_seconds: 60,
};

type CaptureFn = (trigger: Trigger) => Promise<void> | void;

export class TriggerManager implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private policy: TriggerPolicy = DEFAULT_POLICY;
  private focused = true;
  private lastAutoCaptureAt = 0;

  private focusLossTimer?: ReturnType<typeof setTimeout>;
  private idleTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly capture: CaptureFn) {}

  async start(): Promise<void> {
    const p = await getPolicy();
    if (p) {
      this.policy = p;
    }
    this.focused = vscode.window.state.focused;

    // Focus changes drive focus_loss (and re-arm idle on refocus).
    this.disposables.push(
      vscode.window.onDidChangeWindowState((s) => this.onFocusChange(s.focused))
    );

    // Any of these count as "activity" and re-arm the idle timer.
    const activity = () => this.resetIdle();
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection(activity),
      vscode.window.onDidChangeActiveTextEditor(activity),
      vscode.window.onDidChangeTextEditorVisibleRanges(activity),
      vscode.workspace.onDidChangeTextDocument(activity)
    );

    this.resetIdle();
  }

  private onFocusChange(focused: boolean): void {
    if (focused === this.focused) {
      return;
    }
    this.focused = focused;

    if (!focused) {
      // Left the editor — start the debounce; a fast return cancels it.
      this.clearIdle();
      this.focusLossTimer = setTimeout(
        () => this.fire("focus_loss"),
        this.policy.focus_debounce_seconds * 1000
      );
    } else {
      // Came back before the debounce elapsed: no capture. Re-arm idle.
      if (this.focusLossTimer) {
        clearTimeout(this.focusLossTimer);
        this.focusLossTimer = undefined;
      }
      this.resetIdle();
    }
  }

  private resetIdle(): void {
    this.clearIdle();
    if (!this.focused) {
      return; // idle only tracks the "present but inactive" case
    }
    this.idleTimer = setTimeout(
      () => this.fire("idle"),
      this.policy.idle_seconds * 1000
    );
  }

  private clearIdle(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = undefined;
    }
  }

  private async fire(trigger: Trigger): Promise<void> {
    const now = Date.now();
    const gapMs = this.policy.min_capture_interval_seconds * 1000;
    if (now - this.lastAutoCaptureAt < gapMs) {
      return; // cooldown — avoid snapshot spam
    }
    if (!vscode.workspace.workspaceFolders?.length) {
      return; // nothing meaningful to capture
    }
    this.lastAutoCaptureAt = now;
    try {
      await this.capture(trigger);
    } catch (err) {
      console.error("[FlowState] auto-capture failed:", err);
    }
  }

  dispose(): void {
    if (this.focusLossTimer) {
      clearTimeout(this.focusLossTimer);
    }
    this.clearIdle();
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
