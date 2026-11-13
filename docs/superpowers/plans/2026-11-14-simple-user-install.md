# Simple User Install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or subagent-driven-development.

**Goal:** Ship Windows end-user bat + pack scripts, PyInstaller API entry, unix `start.sh`, and Tauri sidecar exit cleanup so non-devs can run without Node/Python/Rust.

**Architecture:** Templates under `deploy/windows` and `deploy/unix`; PyInstaller builds `sc-roi-api`; pack script assembles ZIP; Tauri already spawns sidecar — track Child and kill on exit.

**Tech Stack:** cmd bat, bash, PyInstaller, Tauri 2 shell plugin, PowerShell packer.

## Global Constraints

- Users must not need Node/Python/Rust
- Windows primary; macOS/Linux = `chmod +x && ./start.sh`
- Real Windows EXE build requires Windows/CI — land scripts here; document that

---

### Task 1: Deploy scripts (Windows + unix)

**Files:** Create `deploy/windows/*`, `deploy/unix/start.sh`

### Task 2: PyInstaller + pack script

**Files:** `apps/api/packaging/run_server.py`, `apps/api/packaging/sc-roi-api.spec`, `scripts/pack-windows-user-zip.ps1`

### Task 3: Tauri lifecycle + README

**Files:** `apps/desktop/src-tauri/src/lib.rs`, READMEs, binaries README
