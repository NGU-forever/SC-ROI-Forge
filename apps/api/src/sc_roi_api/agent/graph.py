from __future__ import annotations

from typing import Callable, Literal

from langchain_core.messages import SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode

from sc_roi_api.agent.state import AgentState
from sc_roi_api.agent.tools import build_tools

SYSTEM = """You calibrate HUD ROIs from a screenshot only (vision).
Use tools: ocr_region for crops; propose_rois to submit final boxes.
norm x,y,w,h must be 0..1. Never discuss memory, injection, or game processes."""


def build_suggest_graph(
    *,
    api_key: str,
    base_url: str,
    model: str,
    get_image_bytes: Callable[[], bytes],
    draft_box: dict[str, list],
):
    tools = build_tools(get_image_bytes, draft_box)
    llm = ChatOpenAI(
        api_key=api_key,
        base_url=base_url,
        model=model,
        temperature=0,
    ).bind_tools(tools)
    tool_node = ToolNode(tools)

    def reason(state: AgentState):
        msgs = state["messages"]
        if not msgs or not isinstance(msgs[0], SystemMessage):
            msgs = [SystemMessage(content=SYSTEM), *msgs]
        return {"messages": [llm.invoke(msgs)]}

    def route(state: AgentState) -> Literal["tools", "end"]:
        last = state["messages"][-1]
        if getattr(last, "tool_calls", None):
            return "tools"
        return "end"

    g = StateGraph(AgentState)
    g.add_node("reason", reason)
    g.add_node("tools", tool_node)
    g.add_edge(START, "reason")
    g.add_conditional_edges("reason", route, {"tools": "tools", "end": END})
    g.add_edge("tools", "reason")
    return g.compile()
