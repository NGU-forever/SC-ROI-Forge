# AI Chat + Canvas Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two-column workbench (left multi-turn AI chat, center canvas) with floating ROI inspector; chat returns structured `ops[]` that apply immediately as one undo step.

**Architecture:** Pure `applyRoiOps` in `@sc-roi/schema` for client apply + Vitest. FastAPI `POST /v1/agent/chat-rois` with structured LLM JSON (`message` + `ops`), validated server-side (no new tool-loop). Web: `ChatPanel`, `RoiInspectorBar`, rewire `App` layout; `chatRois` API helper; `pushRois` remains the single undo entry for a turn.

**Tech Stack:** React + Zustand + Tailwind (`apps/web`), FastAPI + LangChain structured output (`apps/api`), Vitest (`packages/schema`).

## Global Constraints

- Vision-only; no process/memory tooling
- Chat session-only; not in export JSON pack
- One AI turn → one `pushRois` undo entry; meta edits still no undo
- `add` colors assigned client-side via `randomRoiColor()`
- Changing image clears chat messages
- Keep `POST /v1/agent/suggest-rois` working; chat is additive
- Light chrome theme (existing CSS variables)

## File map

| File | Role |
|------|------|
| `packages/schema/src/applyRoiOps.ts` | Pure apply + ops summary |
| `packages/schema/src/index.ts` | Re-export |
| `packages/schema/tests/applyRoiOps.test.ts` | Unit tests |
| `apps/api/src/sc_roi_api/agent/runner.py` | `validate_chat_ops`, `run_chat_rois` |
| `apps/api/src/sc_roi_api/main.py` | `POST /v1/agent/chat-rois` |
| `apps/api/tests/test_chat_ops.py` | Validate ops tests |
| `apps/web/src/lib/api.ts` | `chatRois` |
| `apps/web/src/chat/ChatPanel.tsx` | Chat UI |
| `apps/web/src/chat/RoiInspectorBar.tsx` | Floating inspector |
| `apps/web/src/App.tsx` | Two-column layout + wiring |

---

### Task 1: `applyRoiOps` (schema)

**Files:**
- Create: `packages/schema/src/applyRoiOps.ts`
- Create: `packages/schema/tests/applyRoiOps.test.ts`
- Modify: `packages/schema/src/index.ts`

**Interfaces:**
- Produces:
  - `RoiOp = { op: "add"|"update"|"delete"; id?: string; label?: string; category?: string; norm?: Rect; color?: string }`
  - `applyRoiOps(rois, ops) => { rois, skippedIds: string[], summary: string }`
  - `summary` format: parts joined by ` · ` e.g. `+2 · update×1 · delete×1` (omit zero counts); empty ops → `""`

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from "vitest";
import { applyRoiOps } from "../src/applyRoiOps";

const base = [
  { id: "a", label: "speed", category: "ui", color: "#22c55e", norm: { x: 0.1, y: 0.1, w: 0.2, h: 0.1 } },
];

describe("applyRoiOps", () => {
  it("adds, updates, deletes and skips unknown ids", () => {
    const { rois, skippedIds, summary } = applyRoiOps(base, [
      { op: "update", id: "a", label: "velocity" },
      { op: "add", id: "b", label: "radar", category: "sensors", norm: { x: 0.5, y: 0.5, w: 0.1, h: 0.1 } },
      { op: "delete", id: "missing" },
      { op: "delete", id: "a" },
    ]);
    expect(rois.map((r) => r.id)).toEqual(["b"]);
    expect(rois[0].label).toBe("radar");
    expect(skippedIds).toEqual(["missing"]);
    expect(summary).toBe("+1 · update×1 · delete×1");
  });

  it("empty ops leaves list unchanged", () => {
    const { rois, summary } = applyRoiOps(base, []);
    expect(rois).toEqual(base);
    expect(summary).toBe("");
  });
});
```

- [ ] **Step 2:** `npm test --workspace @sc-roi/schema` → FAIL (module missing)

- [ ] **Step 3: Implement**

```ts
import type { Rect } from "./types";

export type RoiLike = {
  id: string;
  label: string;
  category: string;
  color?: string;
  norm: Rect;
};

export type RoiOp = {
  op: "add" | "update" | "delete";
  id?: string;
  label?: string;
  category?: string;
  norm?: Rect;
  color?: string;
};

export function applyRoiOps(
  rois: RoiLike[],
  ops: RoiOp[],
): { rois: RoiLike[]; skippedIds: string[]; summary: string } {
  let next = rois.map((r) => ({ ...r, norm: { ...r.norm } }));
  const skippedIds: string[] = [];
  let add = 0, update = 0, del = 0;
  for (const op of ops) {
    if (op.op === "add") {
      if (!op.label || !op.norm) continue;
      const id = op.id || `roi_${crypto.randomUUID?.() ?? String(Date.now())}_${add}`;
      next.push({
        id,
        label: op.label,
        category: op.category || "ui",
        color: op.color,
        norm: { ...op.norm },
      });
      add++;
    } else if (op.op === "update") {
      if (!op.id) continue;
      const i = next.findIndex((r) => r.id === op.id);
      if (i < 0) { skippedIds.push(op.id); continue; }
      const cur = next[i]!;
      next[i] = {
        ...cur,
        label: op.label ?? cur.label,
        category: op.category ?? cur.category,
        norm: op.norm ? { ...op.norm } : cur.norm,
        color: op.color ?? cur.color,
      };
      update++;
    } else if (op.op === "delete") {
      if (!op.id) continue;
      const before = next.length;
      next = next.filter((r) => r.id !== op.id);
      if (next.length === before) skippedIds.push(op.id);
      else del++;
    }
  }
  const parts: string[] = [];
  if (add) parts.push(`+${add}`);
  if (update) parts.push(`update×${update}`);
  if (del) parts.push(`delete×${del}`);
  return { rois: next, skippedIds, summary: parts.join(" · ") };
}
```

Note: schema may run in Node without `crypto.randomUUID` in older envs — use `globalThis.crypto?.randomUUID?.() ?? \`roi_${Date.now()}_${add}\``.

- [ ] **Step 4:** Export from `packages/schema/src/index.ts`
- [ ] **Step 5:** `npm test --workspace @sc-roi/schema` → PASS
- [ ] **Step 6:** Commit `feat(schema): add applyRoiOps for chat canvas patches`

---

### Task 2: API `validate_chat_ops` + `POST /v1/agent/chat-rois`

**Files:**
- Modify: `apps/api/src/sc_roi_api/agent/runner.py`
- Modify: `apps/api/src/sc_roi_api/main.py`
- Create: `apps/api/tests/test_chat_ops.py`

**Interfaces:**
- Produces: `validate_chat_ops(ops, known_ids) -> { ops, skipped_ids }`
- Produces: `run_chat_rois(image_bytes, messages, rois, aspect_ratio, api_key) -> { message, ops }`
- Endpoint: `POST /v1/agent/chat-rois` Form fields `file`, `aspect_ratio`, `messages` (JSON str), `rois` (JSON str); header `X-API-Key`

- [ ] **Step 1: Failing tests**

```python
from sc_roi_api.agent.runner import validate_chat_ops

def test_validate_chat_ops_clamps_and_skips():
    known = {"a"}
    raw = [
        {"op": "update", "id": "a", "label": "x", "norm": {"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.2}},
        {"op": "delete", "id": "missing"},
        {"op": "add", "id": "b", "label": "radar", "category": "ui", "norm": {"x": 1.5, "y": 0, "w": 0.1, "h": 0.1}},
        {"op": "add", "label": "ok", "norm": {"x": 0.2, "y": 0.2, "w": 0.1, "h": 0.1}},
    ]
    got = validate_chat_ops(raw, known)
    ids = [o.get("id") for o in got["ops"] if o["op"] == "add"]
    assert "missing" in got["skipped_ids"]
    assert any(o["op"] == "update" and o["id"] == "a" for o in got["ops"])
    # oob add dropped; valid add kept
    assert got["ops"][-1]["op"] == "add"
    assert got["ops"][-1]["label"] == "ok"
```

- [ ] **Step 2:** `cd apps/api && python -m pytest tests/test_chat_ops.py -v` → FAIL

- [ ] **Step 3: Implement `validate_chat_ops`** in `runner.py`:
  - `add`: require `label` + `norm` with all keys; each of x,y,w,h in `[0,1]`; w,h > 0; default category `ui`; default id `roi_{n}`
  - `update`: require `id` in `known_ids` else skip; optional label/category/norm (norm same rules)
  - `delete`: require `id` in `known_ids` else skip
  - Return `{ "ops": [...], "skipped_ids": [...] }`

- [ ] **Step 4: Implement `run_chat_rois`**
  - Use `ChatOpenAI` with `with_structured_output` (Pydantic model `ChatRoiResult` with `message: str`, `ops: list[dict]`) **or** ask for JSON in prompt and `json.loads` from content — prefer structured output if available
  - System prompt: vision-only HUD ROI editor; given current rois JSON + chat history; reply with message + ops only; never memory/injection
  - Human content: text with aspect + messages JSON + current rois JSON + image_url data URL
  - After model: `validate_chat_ops(result.ops, {r["id"] for r in rois})`; if skipped, append brief note to `message`
  - Respect `agent_enabled()` / api_key same as suggest

- [ ] **Step 5: Wire route** in `main.py` mirroring `suggest_rois` guards; parse `messages`/`rois` JSON; return `{ message, ops }`

- [ ] **Step 6:** pytest PASS for validate; smoke import of route OK

- [ ] **Step 7:** Commit `feat(api): chat-rois endpoint with validated ops`

---

### Task 3: Web `chatRois` client + ChatPanel + RoiInspectorBar

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/chat/ChatPanel.tsx`
- Create: `apps/web/src/chat/RoiInspectorBar.tsx`

**Interfaces:**
- Produces: `chatRois({ file, aspectRatio, messages, rois, apiKey }) => Promise<{ message: string; ops: RoiOp[] }>`
- `ChatPanel` props: `messages`, `busy`, `disabled`, `disabledReason?`, `onSend(text: string)`
- `RoiInspectorBar` props: `roi`, `onPatchMeta`, `onDelete`

- [ ] **Step 1: `chatRois` in `api.ts`** — FormData with `file`, `aspect_ratio`, `messages` JSON.stringify, `rois` JSON.stringify; header `X-API-Key`; throw on !ok like `suggestRois`

- [ ] **Step 2: `ChatPanel.tsx`** — light chrome styles; user/assistant bubbles; opsSummary under assistant text; textarea/input + Send; show disabledReason when disabled

- [ ] **Step 3: `RoiInspectorBar.tsx`** — absolute/fixed within canvas wrapper; Label, Category, color input, Delete; use existing accent borders

- [ ] **Step 4:** `npm run build --workspace @sc-roi/web` typechecks new files (may fail until App wires — acceptable if only unused; prefer export and use in Task 4 same session)

- [ ] **Step 5:** Commit `feat(web): ChatPanel, RoiInspectorBar, chatRois client`

---

### Task 4: Wire App two-column layout + apply ops

**Files:**
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `applyRoiOps`, `chatRois`, `ChatPanel`, `RoiInspectorBar`, `pushRois`, `randomRoiColor`

- [ ] **Step 1:** State: `messages: ChatMessage[]`, clear on `loadImage`
- [ ] **Step 2:** Remove Suggest button + AI prompt field; keep API key in top bar with aspect controls
- [ ] **Step 3:** Layout: `flex`/`grid` → left `ChatPanel` (~320px), right relative canvas column with `RoiStage` + conditional `RoiInspectorBar`; remove right Selection aside
- [ ] **Step 4:** `onSend`:
  1. append user message
  2. `setAiBusy(true)`
  3. `chatRois(...)` with history including new user turn, current rois (id/label/category/norm)
  4. `applyRoiOps` → map adds missing color via `randomRoiColor()` → `pushRois` if ops length > 0 (or always push only when rois changed)
  5. append assistant `{ content: message, opsSummary: summary }`
  6. on error: append assistant error content; no `pushRois`
- [ ] **Step 5:** `npm run build --workspace @sc-roi/web` → PASS
- [ ] **Step 6:** Commit `feat(web): two-column AI chat workbench with live ROI ops`

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Multi-turn chat UI | 3, 4 |
| AI add/update/delete via ops | 1, 2, 4 |
| Two-column layout, no right panel | 4 |
| Floating inspector | 3, 4 |
| Immediate apply + one undo | 1, 4 (`pushRois`) |
| Session-only chat; clear on new image | 4 |
| Keep suggest route; no export chat | 2 (additive endpoint) |
| Client random color on add | 4 |
| Disabled without image/key; errors no mutate | 3, 4 |

## Self-review notes

- No TBD placeholders
- `applyRoiOps` summary / skippedIds names consistent across tasks
- Endpoint path `/v1/agent/chat-rois` matches spec
