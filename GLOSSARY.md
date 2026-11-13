# SC-ROI-Forge

Vision-only ROI calibration workbench for Star Citizen HUD screenshots.

## Language

**Chrome**:
The app shell around the drawing surface: page background, header, toolbar, and Selection aside.
_Avoid_: Frame, layout chrome (ambiguous), UI skin

**Pasteboard**:
The warm yellowish graph-paper area that surrounds and sits under the calibration stage (canvas editor pasteboard).
_Avoid_: Background, whiteboard, canvas (reserved for the stage content)

**Stage**:
The aspect-locked Konva drawing surface where the screenshot and ROI boxes live.
_Avoid_: Canvas (overloaded with HTML canvas / pasteboard)

**Accent**:
The primary interactive color for Import and focus (sky blue). Export stays green; destructive actions stay red.
_Avoid_: Brand color, theme color (too vague)
