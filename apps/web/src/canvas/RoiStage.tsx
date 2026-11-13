import { useCallback, useEffect, useRef, useState } from "react";
import {
  Image as KonvaImage,
  Layer,
  Rect as KonvaRect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import type Konva from "konva";
import type { Roi } from "./useRoiStore";
import { hexWithAlpha, randomRoiColor } from "@/lib/roiColor";
import { normFromStage, stageFromNorm, stageSize } from "@/lib/stageSize";

const MIN_BOX = 8;
const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const ZOOM_FACTOR = 1.1;

type View = { scale: number; x: number; y: number };

type Props = {
  imageUrl: string | null;
  aspectRatio: string;
  rois: Roi[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onImageLoaded: (width: number, height: number) => void;
  onAddRoi: (roi: Roi) => void;
  onUpdateRoi: (id: string, patch: Partial<Roi>) => void;
};

function useHtmlImage(url: string | null) {
  const [image, setImage] = useState<HTMLImageElement | undefined>();
  useEffect(() => {
    if (!url) {
      setImage(undefined);
      return;
    }
    const img = new window.Image();
    img.onload = () => setImage(img);
    img.src = url;
    return () => {
      img.onload = null;
    };
  }, [url]);
  return image;
}

function clampScale(s: number) {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
}

export function RoiStage({
  imageUrl,
  aspectRatio,
  rois,
  selectedId,
  onSelect,
  onImageLoaded,
  onAddRoi,
  onUpdateRoi,
}: Props) {
  const { width: stageW, height: stageH } = stageSize(aspectRatio);
  const image = useHtmlImage(imageUrl);
  const transformerRef = useRef<Konva.Transformer>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);
  const panLast = useRef<{ x: number; y: number } | null>(null);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [drawPreview, setDrawPreview] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  useEffect(() => {
    setView({ scale: 1, x: 0, y: 0 });
  }, [imageUrl, aspectRatio]);

  useEffect(() => {
    if (image) {
      onImageLoaded(image.naturalWidth, image.naturalHeight);
    }
  }, [image, onImageLoaded]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpaceDown(false);
        setPanning(false);
        panLast.current = null;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const tr = transformerRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const node = selectedId
      ? stage.findOne(`#roi-${selectedId}`)
      : null;
    if (node) {
      tr.nodes([node as Konva.Node]);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selectedId, rois, stageW, stageH, view]);

  const stagePointer = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    return transform.point(pos);
  }, []);

  const clampStage = (x: number, y: number) => ({
    x: Math.max(0, Math.min(stageW, x)),
    y: Math.max(0, Math.min(stageH, y)),
  });

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const oldScale = view.scale;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = clampScale(
      direction > 0 ? oldScale * ZOOM_FACTOR : oldScale / ZOOM_FACTOR,
    );
    if (newScale === oldScale) return;

    const mousePointTo = {
      x: (pointer.x - view.x) / oldScale,
      y: (pointer.y - view.y) / oldScale,
    };
    setView({
      scale: newScale,
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!imageUrl) return;
    const isMiddle = e.evt.button === 1;
    if (isMiddle || spaceDown) {
      e.evt.preventDefault();
      setPanning(true);
      panLast.current = { x: e.evt.clientX, y: e.evt.clientY };
      setDrawStart(null);
      setDrawPreview(null);
      return;
    }
    if (e.evt.button !== 0) return;
    if (spaceDown) return;

    const cls = e.target.getClassName();
    if (cls !== "Stage" && cls !== "Layer") return;
    const pos = stagePointer();
    if (!pos) return;
    const p = clampStage(pos.x, pos.y);
    setDrawStart(p);
    setDrawPreview({ x: p.x, y: p.y, w: 0, h: 0 });
    onSelect(null);
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (panning && panLast.current) {
      const dx = e.evt.clientX - panLast.current.x;
      const dy = e.evt.clientY - panLast.current.y;
      panLast.current = { x: e.evt.clientX, y: e.evt.clientY };
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
      return;
    }
    if (!drawStart) return;
    const pos = stagePointer();
    if (!pos) return;
    const p = clampStage(pos.x, pos.y);
    const x = Math.min(drawStart.x, p.x);
    const y = Math.min(drawStart.y, p.y);
    const w = Math.abs(p.x - drawStart.x);
    const h = Math.abs(p.y - drawStart.y);
    setDrawPreview({ x, y, w, h });
  };

  const finishDraw = () => {
    if (!drawPreview || drawPreview.w < MIN_BOX || drawPreview.h < MIN_BOX) {
      setDrawStart(null);
      setDrawPreview(null);
      return;
    }
    const norm = normFromStage(
      drawPreview.x,
      drawPreview.y,
      drawPreview.w,
      drawPreview.h,
      stageW,
      stageH,
    );
    const id = crypto.randomUUID();
    onAddRoi({
      id,
      label: `roi_${rois.length + 1}`,
      category: "general",
      color: randomRoiColor(),
      norm,
    });
    onSelect(id);
    setDrawStart(null);
    setDrawPreview(null);
  };

  const handleMouseUp = () => {
    if (panning) {
      setPanning(false);
      panLast.current = null;
      return;
    }
    if (drawStart) finishDraw();
  };

  if (!imageUrl) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded border border-dashed border-slate-700 bg-slate-950 p-8 text-slate-500">
        Import or paste a screenshot to begin.
      </div>
    );
  }

  const cursor = panning
    ? "grabbing"
    : spaceDown
      ? "grab"
      : "crosshair";

  return (
    <div
      className="overflow-hidden rounded border border-slate-700 bg-slate-950"
      style={{ maxHeight: "calc(100vh - 12rem)" }}
    >
      <Stage
        ref={stageRef}
        width={stageW}
        height={stageH}
        scaleX={view.scale}
        scaleY={view.scale}
        x={view.x}
        y={view.y}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMousemove={handleMouseMove}
        onMouseup={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={(e) => e.evt.preventDefault()}
        className="cursor-crosshair"
        style={{ cursor }}
      >
        <Layer>
          {image && (
            <KonvaImage
              image={image}
              x={0}
              y={0}
              width={stageW}
              height={stageH}
              listening={false}
            />
          )}
          {rois.map((roi) => {
            const rect = stageFromNorm(roi.norm, stageW, stageH);
            const isSelected = roi.id === selectedId;
            const stroke = roi.color || "#22c55e";
            return (
              <KonvaRect
                key={roi.id}
                id={`roi-${roi.id}`}
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                stroke={stroke}
                strokeWidth={isSelected ? 2.5 : 1.5}
                fill={hexWithAlpha(stroke, 0.12)}
                draggable={!spaceDown && !panning}
                onClick={() => onSelect(roi.id)}
                onTap={() => onSelect(roi.id)}
                onDragEnd={(ev) => {
                  const node = ev.target;
                  const norm = normFromStage(
                    node.x(),
                    node.y(),
                    node.width() * node.scaleX(),
                    node.height() * node.scaleY(),
                    stageW,
                    stageH,
                  );
                  node.scaleX(1);
                  node.scaleY(1);
                  onUpdateRoi(roi.id, { norm });
                }}
                onTransformEnd={(ev) => {
                  const node = ev.target;
                  const w = node.width() * node.scaleX();
                  const h = node.height() * node.scaleY();
                  const norm = normFromStage(
                    node.x(),
                    node.y(),
                    w,
                    h,
                    stageW,
                    stageH,
                  );
                  node.scaleX(1);
                  node.scaleY(1);
                  node.width(w);
                  node.height(h);
                  onUpdateRoi(roi.id, { norm });
                }}
              />
            );
          })}
          {rois.map((roi) => {
            const rect = stageFromNorm(roi.norm, stageW, stageH);
            return (
              <Text
                key={`${roi.id}-label`}
                x={rect.x + 2}
                y={Math.max(0, rect.y - 16)}
                text={roi.label}
                fontSize={12}
                fill="#e2e8f0"
                listening={false}
              />
            );
          })}
          {drawPreview && drawPreview.w > 0 && drawPreview.h > 0 && (
            <KonvaRect
              x={drawPreview.x}
              y={drawPreview.y}
              width={drawPreview.w}
              height={drawPreview.h}
              stroke="#fbbf24"
              dash={[4, 4]}
              listening={false}
            />
          )}
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < MIN_BOX || newBox.height < MIN_BOX) {
                return oldBox;
              }
              return newBox;
            }}
            rotateEnabled={false}
          />
        </Layer>
      </Stage>
    </div>
  );
}
