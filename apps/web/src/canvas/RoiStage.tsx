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
import { useI18n } from "@/i18n";
import { normFromStage, stageFromNorm, stageSize } from "@/lib/stageSize";

const MIN_BOX = 8;

type Props = {
  imageUrl: string | null;
  aspectRatio: string;
  rois: Roi[];
  selectedId: string | null;
  defaultLabel: (index: number) => string;
  defaultCategory: string;
  onSelect: (id: string | null) => void;
  onImageLoaded: (width: number, height: number) => void;
  onAddRoi: (roi: Roi) => void;
  onUpdateRoi: (id: string, patch: Partial<Roi>) => void;
  onImportClick?: () => void;
};

function useHtmlImage(url: string | null) {
  const [image, setImage] = useState<HTMLImageElement | undefined>();
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!url) {
      setImage(undefined);
      setLoadedUrl(null);
      return;
    }
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (cancelled) return;
      setImage(img);
      setLoadedUrl(url);
    };
    img.onerror = () => {
      if (cancelled) return;
      setImage(undefined);
      setLoadedUrl(url);
    };
    img.src = url;
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [url]);
  const loading = Boolean(url) && loadedUrl !== url;
  return { image, loading };
}

export function RoiStage({
  imageUrl,
  aspectRatio,
  rois,
  selectedId,
  defaultLabel,
  defaultCategory,
  onSelect,
  onImageLoaded,
  onAddRoi,
  onUpdateRoi,
  onImportClick,
}: Props) {
  const { t } = useI18n();
  const { width: stageW, height: stageH } = stageSize(aspectRatio);
  const { image, loading } = useHtmlImage(imageUrl);
  const transformerRef = useRef<Konva.Transformer>(null);
  const stageRef = useRef<Konva.Stage>(null);
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
    if (image) {
      onImageLoaded(image.naturalWidth, image.naturalHeight);
    }
  }, [image, onImageLoaded]);

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
  }, [selectedId, rois, stageW, stageH]);

  const pointerPos = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    return stage.getPointerPosition();
  }, []);

  const clampStage = (x: number, y: number) => ({
    x: Math.max(0, Math.min(stageW, x)),
    y: Math.max(0, Math.min(stageH, y)),
  });

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!imageUrl) return;
    const cls = e.target.getClassName();
    if (cls !== "Stage" && cls !== "Layer") return;
    const pos = pointerPos();
    if (!pos) return;
    const p = clampStage(pos.x, pos.y);
    setDrawStart(p);
    setDrawPreview({ x: p.x, y: p.y, w: 0, h: 0 });
    onSelect(null);
  };

  const handleMouseMove = () => {
    if (!drawStart) return;
    const pos = pointerPos();
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
      label: defaultLabel(rois.length + 1),
      category: defaultCategory,
      norm,
    });
    onSelect(id);
    setDrawStart(null);
    setDrawPreview(null);
  };

  const handleMouseUp = () => {
    if (drawStart) finishDraw();
  };

  if (!imageUrl) {
    return (
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 rounded border border-dashed border-slate-600 bg-slate-950/80 p-8 text-center">
        <p className="text-base text-slate-300">{t("emptyCanvas")}</p>
        <p className="text-xs text-slate-500">{t("emptyCanvasHint")}</p>
        {onImportClick && (
          <button
            type="button"
            className="mt-1 rounded bg-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            onClick={onImportClick}
          >
            {t("importImage")}
          </button>
        )}
      </div>
    );
  }

  if (loading || !image) {
    return (
      <div
        className="flex h-full min-h-[240px] items-center justify-center rounded border border-slate-700 bg-slate-950 text-sm text-slate-400"
        role="status"
        aria-live="polite"
      >
        {t("imageLoading")}
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-auto rounded border border-slate-700 bg-slate-950">
      <Stage
        ref={stageRef}
        width={stageW}
        height={stageH}
        onMouseDown={handleMouseDown}
        onMousemove={handleMouseMove}
        onMouseup={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="cursor-crosshair"
      >
        <Layer>
          <KonvaImage
            image={image}
            x={0}
            y={0}
            width={stageW}
            height={stageH}
            listening={false}
          />
          {rois.map((roi) => {
            const rect = stageFromNorm(roi.norm, stageW, stageH);
            const isSelected = roi.id === selectedId;
            return (
              <KonvaRect
                key={roi.id}
                id={`roi-${roi.id}`}
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                stroke={isSelected ? "#38bdf8" : "#22c55e"}
                strokeWidth={isSelected ? 2 : 1.5}
                fill="rgba(34, 197, 94, 0.12)"
                draggable
                onClick={() => onSelect(roi.id)}
                onTap={() => onSelect(roi.id)}
                onDragEnd={(e) => {
                  const node = e.target;
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
                onTransformEnd={(e) => {
                  const node = e.target;
                  const w = node.width() * node.scaleX();
                  const h = node.height() * node.scaleY();
                  const norm = normFromStage(node.x(), node.y(), w, h, stageW, stageH);
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
