from typing import Annotated, Any, TypedDict

from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    aspect_ratio: str
    draft_rois: list[dict[str, Any]]
