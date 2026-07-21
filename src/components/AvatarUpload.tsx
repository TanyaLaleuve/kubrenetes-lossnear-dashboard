"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Cropper, { type Area } from "react-easy-crop";

const MAX_SOURCE_BYTES = 5 * 1024 * 1024; // 5 Mo avant recadrage

async function cropToWebp(imageSrc: string, area: Area): Promise<Blob> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");
  ctx.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    512,
    512,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export impossible"))),
      "image/webp",
      0.9,
    );
  });
}

export function AvatarUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels);
  }, []);

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_SOURCE_BYTES) {
      setError("Image trop lourde (5 Mo maximum).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setSource(String(reader.result));
    reader.readAsDataURL(file);
  }

  function cancel() {
    setSource(null);
    setZoom(1);
    setCrop({ x: 0, y: 0 });
    if (inputRef.current) inputRef.current.value = "";
  }

  async function save() {
    if (!source || !croppedArea) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await cropToWebp(source, croppedArea);
      const formData = new FormData();
      formData.append("avatar", blob, "avatar.webp");
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? `Erreur ${response.status}`);
      }
      cancel();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'envoi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {!source && (
        <label className="inline-flex cursor-pointer items-center rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground">
          Changer la photo…
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={onFileChange}
            className="sr-only"
          />
        </label>
      )}

      {source && (
        <div className="space-y-3">
          <div className="relative h-64 w-full overflow-hidden rounded-xl border border-border bg-background">
            <Cropper
              image={source}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <label className="flex items-center gap-3 text-sm text-muted-foreground">
            Zoom
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="flex-1 accent-(--accent)"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Envoi…" : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-card-hover"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
