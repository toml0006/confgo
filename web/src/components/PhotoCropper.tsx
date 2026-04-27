import { useEffect, useMemo, useRef, useState } from "react";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";
import { useAuth } from "../auth/AuthContext";

const VIEWPORT = 280; // square crop window, CSS px
const OUTPUT = 512; // exported image side, real px
const MAX_ZOOM = 4;
const JPEG_QUALITY = 0.9;

type Props = {
  file: File;
  onCancel: () => void;
  onSave: (photoURL: string) => void;
};

export function PhotoCropper({ file, onCancel, onSave }: Props) {
  const { user } = useAuth();
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  // Read file → object URL → load natural dimensions
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    const img = new Image();
    img.onload = () => {
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    img.onerror = () => setError("Couldn't read that image. Try another file.");
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Scale that makes the image cover the viewport at zoom=1
  const baseScale = useMemo(() => {
    if (!imgSize) return 1;
    return Math.max(VIEWPORT / imgSize.w, VIEWPORT / imgSize.h);
  }, [imgSize]);

  const displayScale = baseScale * zoom;
  const displayW = imgSize ? imgSize.w * displayScale : 0;
  const displayH = imgSize ? imgSize.h * displayScale : 0;

  // Clamp offset so image always covers the viewport
  const clamp = (x: number, y: number) => {
    const maxX = Math.max(0, (displayW - VIEWPORT) / 2);
    const maxY = Math.max(0, (displayH - VIEWPORT) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  };

  // Re-clamp whenever zoom changes (a zoom-out can push old offsets out of bounds)
  useEffect(() => {
    setOffset((o) => clamp(o.x, o.y));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, baseScale]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y };
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(clamp(dragRef.current.baseX + dx, dragRef.current.baseY + dy));
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  async function handleSave() {
    if (!user || !imgSrc || !imgSize) return;
    setSaving(true);
    setError(null);
    try {
      const blob = await renderCrop(imgSrc, imgSize, displayScale, offset);
      const path = `profile-images/${user.uid}/avatar-${Date.now()}.jpg`;
      const ref = storageRef(storage, path);
      await uploadBytes(ref, blob, { contentType: "image/jpeg" });
      const url = await getDownloadURL(ref);
      onSave(url);
    } catch (err) {
      console.error("[photo upload]", err);
      setError("Upload failed. Check your connection and try again.");
      setSaving(false);
    }
  }

  return (
    <div className="cropper-backdrop" onClick={onCancel}>
      <div
        className="cropper-card glass-panel sheet-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cropper-head">
          <div className="section-label">Crop your photo</div>
          <button className="close-x" onClick={onCancel} aria-label="Close">
            ×
          </button>
        </div>

        <div
          className="cropper-viewport"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ width: VIEWPORT, height: VIEWPORT }}
        >
          {imgSrc && imgSize ? (
            <img
              src={imgSrc}
              alt=""
              draggable={false}
              style={{
                width: displayW,
                height: displayH,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          ) : null}
          <div className="cropper-mask" aria-hidden="true" />
        </div>

        <div className="cropper-zoom">
          <span className="caption">−</span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom"
          />
          <span className="caption">+</span>
        </div>

        {error ? <div className="auth-error">{error}</div> : null}

        <div className="cropper-actions">
          <button className="soft-button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            className="soft-button soft-button--primary"
            onClick={handleSave}
            disabled={saving || !imgSize}
          >
            {saving ? "Uploading…" : "Save photo"}
          </button>
        </div>

        <style>{`
          .cropper-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(4, 8, 14, 0.6);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100;
            padding: 16px;
          }
          .cropper-card {
            width: min(360px, calc(100vw - 32px));
            padding: 18px;
            display: flex;
            flex-direction: column;
            gap: 14px;
          }
          .cropper-head {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .cropper-viewport {
            position: relative;
            margin: 0 auto;
            overflow: hidden;
            background: #000;
            border-radius: 12px;
            cursor: grab;
            touch-action: none;
            user-select: none;
          }
          .cropper-viewport:active {
            cursor: grabbing;
          }
          .cropper-viewport img {
            position: absolute;
            top: 50%;
            left: 50%;
            margin-top: ${-VIEWPORT / 2}px;
            margin-left: ${-VIEWPORT / 2}px;
            transform-origin: center center;
            pointer-events: none;
            max-width: none;
          }
          .cropper-mask {
            position: absolute;
            inset: 0;
            pointer-events: none;
            box-shadow: 0 0 0 9999px rgba(4, 8, 14, 0.55) inset;
            -webkit-mask: radial-gradient(circle at center, transparent ${VIEWPORT / 2 - 1}px, #000 ${VIEWPORT / 2}px);
                    mask: radial-gradient(circle at center, transparent ${VIEWPORT / 2 - 1}px, #000 ${VIEWPORT / 2}px);
            border-radius: 12px;
          }
          .cropper-viewport::after {
            content: "";
            position: absolute;
            inset: 0;
            margin: auto;
            width: ${VIEWPORT}px;
            height: ${VIEWPORT}px;
            border-radius: 999px;
            border: 1px solid rgba(255, 255, 255, 0.25);
            pointer-events: none;
          }
          .cropper-zoom {
            display: flex;
            align-items: center;
            gap: 0.6rem;
          }
          .cropper-zoom input {
            flex: 1;
          }
          .cropper-actions {
            display: flex;
            justify-content: flex-end;
            gap: 0.5rem;
          }
        `}</style>
      </div>
    </div>
  );
}

// Compose the cropped circle at OUTPUTxOUTPUT and return a JPEG blob.
// We export a *square* JPEG (the circle clip is rendered by CSS at display
// time via .avatar-photo's border-radius), which keeps the file simple and
// printable elsewhere if needed.
async function renderCrop(
  src: string,
  imgSize: { w: number; h: number },
  displayScale: number,
  offset: { x: number; y: number },
): Promise<Blob> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT;
  canvas.height = OUTPUT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");

  // The viewport in image-space:
  //   - viewport center maps to (imgSize/2 - offset/displayScale)
  //   - viewport side in image-space = VIEWPORT / displayScale
  const srcSide = VIEWPORT / displayScale;
  const srcX = imgSize.w / 2 - offset.x / displayScale - srcSide / 2;
  const srcY = imgSize.h / 2 - offset.y / displayScale - srcSide / 2;

  ctx.drawImage(img, srcX, srcY, srcSide, srcSide, 0, 0, OUTPUT, OUTPUT);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image failed to load"));
    img.src = src;
  });
}
