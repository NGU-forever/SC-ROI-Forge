# AI Chat + Canvas Layout Design Spec

**Date:** 2026-11-13  
**Status:** Approved (product design; pending implementation plan)  
**Parent:** [`2026-11-13-sc-roi-forge-design.md`](./2026-11-13-sc-roi-forge-design.md)  
**Related:** [`2026-11-13-roi-canvas-ux-design.md`](./2026-11-13-roi-canvas-ux-design.md)  
**Repo:** https://github.com/NGU-forever/SC-ROI-Forge

## 1. Purpose

Replace the top-bar single-shot “Suggest with AI” prompt with a **multi-turn AI chat panel** on the left, keep the **Konva canvas** as the center work surface, and move ROI property editing to a **floating inspector** on the canvas. The agent returns structured ROI operations that apply **immediately** to the same store / undo stack as manual edits.

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| Chat style | Multi-turn bubbles (not single prompt field) |
| AI canvas power | Read + write current ROIs: add / update / delete; explain in reply |
| Workbench layout | Two columns: left chat, center canvas (no right Selection panel) |
| Selection inspector | Floating bar at bottom of canvas when an ROI is selected |
| Apply semantics | Ops apply immediately; one AI turn = one undo entry |
| Implementation approach | Chat UI + structured `ops[]` patch (no tool-calling loop this round) |
| Chat persistence | Session-only in the page; not written into export JSON pack |
| New image | Clear chat `messages` when the screenshot changes |

## 3. UI shell

### 3.1 Top bar

- Keep: product title, Import, Undo, Redo, Export JSON
- Keep (relocated from chat chrome): LLM API key, aspect preset / custom / detected badge
- Remove: standalone “AI prompt” input and “Suggest with AI” button (chat replaces them)

### 3.2 Left — `ChatPanel`

- Header: e.g. “AI Assistant”
- Scrollable message list: user (right) / assistant (left) bubbles
- Assistant bubble shows natural-language `message` plus a light ops summary (e.g. `+3 · update×1 · delete×1`)
- Composer: text input + Send
- Disabled when: no image, empty API key, or request in flight
- Busy state: disable Send; optional “Thinking…” placeholder in the list

### 3.3 Center — canvas + `RoiInspectorBar`

- Existing `RoiStage` (draw, select, move/resize, zoom/pan) unchanged in behavior
- When `selectedId` is set, show a floating bar anchored to the **bottom** of the canvas region (not overlaying as a badge on a box):
  - Label, Category, Color (`<input type="color">`), Delete
- Same meta patch rules as today: label/category/color via `patchRoiMeta` (no undo push); Delete removes ROI and clears selection

### 3.4 Removed

- Right-hand Selection aside
- Top-bar one-shot Suggest UX

## 4. Data flow and API

### 4.1 Client session state

```ts
type ChatRole = "user" | "assistant";
type ChatMessage = {
  role: ChatRole;
  content: string;
  opsSummary?: string; // assistant only, optional
};
```

- Held in React state (or a small chat slice); **not** part of export pack
- On Send: append the user message immediately; on success append the assistant message; on failure append an assistant error bubble (canvas unchanged)

### 4.2 Request

Prefer a dedicated endpoint (keeps old single-shot route available if needed):

`POST /v1/agent/chat-rois`

- Multipart or JSON+file equivalent of today’s suggest call
- Fields:
  - `file` — current screenshot
  - `aspect_ratio` — locked aspect string
  - `messages` — JSON array of prior + new user turns (`role` + `content`)
  - `rois` — JSON array of current canvas ROIs (`id`, `label`, `category`, `norm`; `color` optional for model context)
- Header: `X-API-Key` (same as today)

### 4.3 Response

```json
{
  "message": "Updated radar → sensors and shifted it left.",
  "ops": [
    { "op": "update", "id": "…", "label": "sensors", "norm": { "x": 0.12, "y": 0.2, "w": 0.1, "h": 0.08 } },
    { "op": "add", "id": "…", "label": "chat", "category": "social", "norm": { "x": 0.7, "y": 0.75, "w": 0.25, "h": 0.2 } },
    { "op": "delete", "id": "…" }
  ]
}
```

Op rules:

| `op` | Required | Notes |
|------|----------|--------|
| `add` | `label`, `norm`; `id` + `category` recommended | Client assigns `color: randomRoiColor()` if missing |
| `update` | `id`; any of `label`, `category`, `norm` | Unknown `id` → drop op; mention in `message` or server note |
| `delete` | `id` | Unknown `id` → drop op |

Server validates / clamps `norm` to `0..1` and positive `w`/`h` before returning.

### 4.4 Apply on client

1. Start from current `rois`
2. Apply ops in order
3. Commit the resulting list with **one** store history push (same undo semantics as a bulk AI suggest today via `pushRois`, or an equivalent “replace set” that records one undo step)
4. Render assistant bubble from `message` + derived `opsSummary`
5. On HTTP / parse failure: show error in chat or toast; **do not** mutate ROIs

### 4.5 Backend shape

- Extend the existing LangGraph / LangChain path: build prompt with image + history + current ROI JSON → model returns structured JSON (`message` + `ops`) → validate → respond
- **Out of scope this round:** tool-calling loops, token streaming / typewriter UI

## 5. Components (web)

| Unit | Responsibility |
|------|----------------|
| `ChatPanel` | Messages, composer, busy/disabled/error |
| `RoiInspectorBar` | Floating selection editor |
| `App` | Two-column layout; top bar; wire chat → API → apply ops |
| `lib/api.ts` | `chatRois(...)` client helper |
| `useRoiStore` | Existing ROI CRUD / undo; may add a bulk apply helper if `pushRois` is insufficient for mixed update/delete |

## 6. Error handling and edge cases

| Case | Behavior |
|------|----------|
| No image | Composer disabled; short hint |
| No API key | Composer disabled; short hint |
| Request fails | Error visible; canvas unchanged; user message may remain or be marked failed (prefer: keep user message, show assistant error bubble) |
| Partial invalid ops | Apply valid ops; surface skipped ids in assistant text |
| Empty `ops` | Still show `message` (e.g. clarifying question); canvas unchanged |
| Image replaced | `clear` messages; clear selection as today |

## 7. Out of scope

- Persisting chat into export JSON or localStorage beyond API key
- True tool-calling agent loop
- Streaming assistant tokens
- Right Selection panel
- Changing export pack schema for chat

## 8. Acceptance criteria

1. Layout is left chat + center canvas; no right Selection column; selected ROI shows bottom floating inspector.
2. Multi-turn chat can add, update, and delete ROIs; changes appear on the canvas immediately.
3. One successful AI turn is one Undo step.
4. Without API key or image, Send is disabled; failures do not mutate the canvas.
5. Changing the screenshot clears the chat transcript.
6. Manual draw / edit / export paths remain available without using chat.

## 9. Relationship to prior specs

- Parent product flow (§3.3 AI path) remains: optional cloud AI, vision-only, fully editable drafts — this spec only changes **UX and multi-turn apply**.
- ROI `color` and zoom/pan from `2026-11-13-roi-canvas-ux-design.md` stay in force; AI `add` still gets client-side random colors.
