# -*- mode: python ; coding: utf-8 -*-
# Build on Windows (from apps/api):
#   pip install pyinstaller
#   pyinstaller packaging/sc-roi-api.spec
#
# Output: dist/sc-roi-api.exe
# Copy/rename for Tauri externalBin as:
#   apps/desktop/src-tauri/binaries/sc-roi-api-x86_64-pc-windows-msvc.exe

block_cipher = None

a = Analysis(
    ["run_server.py"],
    pathex=["../src"],
    binaries=[],
    datas=[],
    hiddenimports=[
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        "sc_roi_api",
        "sc_roi_api.main",
        "sc_roi_api.geometry",
        "sc_roi_api.models",
        "sc_roi_api.agent",
        "sc_roi_api.agent.runner",
        "sc_roi_api.agent.graph",
        "sc_roi_api.agent.tools",
        "sc_roi_api.agent.state",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="sc-roi-api",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
