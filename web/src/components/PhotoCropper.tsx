import { useEffect, useMemo, useRef, useState } from "react";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Kicker } from "@/components/ui/kicker";

const VIEWPORT = 280; // square crop window, CSS px
const OUTPUT = 512; // exported image side, real px
const MAX_ZOOM = 4;
const JPEG_QUALITY = 0.9;

type Props = {
  file: File | null;
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

  useEffect(() => {
    if (!file) {
      setImgSrc(null);
      setImgSize(null);
      return;
    }
    // Belt-and-braces: reset transient state on every fresh file so a
    // hung "saving" / stale error from a previous upload can't leak
    // into the new session.
    setSaving(false);
    setError(null);
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

  const baseScale = useMemo(() => {
    if (!imgSize) return 1;
    return Math.max(VIEWPORT / imgSize.w, VIEWPORT / imgSize.h);
  }, [imgSize]);

  const displayScale = baseScale * zoom;
  const displayW = imgSize ? imgSize.w * displayScale : 0;
  const displayH = imgSize ? imgSize.h * displayScale : 0;

  const clamp = (x: number, y: number) => {
    const maxX = Math.max(0, (displayW - VIEWPORT) / 2);
    const maxY = Math.max(0, (displayH - VIEWPORT) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  };

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
      // Radix <Dialog> doesn't unmount on close, so the component
      // instance survives between uploads. Without this reset, opening
      // the cropper a second time in the same session leaves the button
      // stuck on "Uploading…".
      setSaving(false);
    } catch (err) {
      console.error("[photo upload]", err);
      setError("Upload failed. Check your connection and try again.");
      setSaving(false);
    }
  }

  const halfV = VIEWPORT / 2;
  const maskExpr = `radial-gradient(circle at center, transparent ${halfV - 1}px, #000 ${halfV}px)`;

  return (
    <Dialog open={file !== null} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="bg-paper border border-hair rounded-[14px] max-w-[360px] gap-3.5">
        <DialogHeader>
          <DialogTitle asChild>
            <Kicker>Crop your photo</Kicker>
          </DialogTitle>
        </DialogHeader>

        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ width: VIEWPORT, height: VIEWPORT }}
          className="relative mx-auto overflow-hidden bg-black rounded-xl cursor-grab active:cursor-grabbing touch-none select-none after:content-[''] after:absolute after:inset-0 after:m-auto after:rounded-full after:border after:border-white/35 after:pointer-events-none"
        >
          {imgSrc && imgSize ? (
            <img
              src={imgSrc}
              alt=""
              draggable={false}
              className="absolute top-1/2 left-1/2 max-w-none pointer-events-none origin-center"
              style={{
                width: displayW,
                height: displayH,
                marginTop: -halfV,
                marginLeft: -halfV,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          ) : null}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none rounded-xl [box-shadow:0_0_0_9999px_rgba(4,8,14,0.55)_inset]"
            style={{ WebkitMaskImage: maskExpr, maskImage: maskExpr }}
          />
        </div>

        <div className="flex items-center gap-2.5">
          <span className="font-display text-[0.85rem] text-ink2">−</span>
          <Slider
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={[zoom]}
            onValueChange={(v) => setZoom(v[0])}
            aria-label="Zoom"
            className="flex-1"
          />
          <span className="font-display text-[0.85rem] text-ink2">+</span>
        </div>

        {error ? (
          <div className="text-[13px] text-brand">{error}</div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="atlas" size="atlas" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="atlas-primary"
            size="atlas"
            onClick={handleSave}
            disabled={saving || !imgSize}
          >
            {saving ? "Uploading…" : "Save photo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
