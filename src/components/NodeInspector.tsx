import React, { useEffect, useMemo, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import type { BoardNode } from "../boardTypes";
import { FILE_RES_BASE_URL } from "../fileDataSource";

type Area = { x: number; y: number; width: number; height: number };

interface NodeInspectorProps {
  node: BoardNode | null;

  // Сохранение полей узла (локально, после upload)
  onSaveNode: (
    id: number,
    patch: { name: string; description: string; picture_path?: string | null }
  ) => Promise<void>;

  // Upload кропнутой картинки → возвращает {id,url}, нам нужен id
  onUploadImage: (blob: Blob) => Promise<{ id: string; url: string }>;
}

const MAX_NAME_LEN = 64;
const TARGET_SIZE = 512;

function clampName(s: string) {
  return s.length > MAX_NAME_LEN ? s.slice(0, MAX_NAME_LEN) : s;
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function cropToSquare512(imageUrl: string, crop: Area, mime: "image/png" | "image/jpeg") {
  const image = await createImage(imageUrl);

  const canvas = document.createElement("canvas");
  canvas.width = TARGET_SIZE;
  canvas.height = TARGET_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  // crop coords are in pixels of displayed image source
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  const sx = crop.x * scaleX;
  const sy = crop.y * scaleY;
  const sWidth = crop.width * scaleX;
  const sHeight = crop.height * scaleY;

  ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, TARGET_SIZE, TARGET_SIZE);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      mime,
      mime === "image/jpeg" ? 0.9 : undefined
    );
  });

  return blob;
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({
  node,
  onSaveNode,
  onUploadImage,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // image flow
  const [imageChanged, setImageChanged] = useState(false);
  const [pickedFileName, setPickedFileName] = useState<string>("image.png");
  const [imageSrcForCrop, setImageSrcForCrop] = useState<string | null>(null); // objectURL
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // objectURL of cropped blob

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // current node image (server)
  const currentImgUrl = useMemo(() => {
    if (!node?.picture_path) return null;
    return `${FILE_RES_BASE_URL}/res/${node.picture_path}`;
  }, [node?.picture_path]);

  useEffect(() => {
    if (node) {
      setName(node.name ?? "");
      setDescription(node.description ?? "");
    } else {
      setName("");
      setDescription("");
    }

    // reset image draft when switching node
    setImageChanged(false);
    setPickedFileName("image.png");
    setImageSrcForCrop(null);
    setCroppedAreaPixels(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.node_id]);

  const disabled = !node || saving;

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const acceptFile = (file: File) => {
    if (!(file.type === "image/png" || file.type === "image/jpeg")) {
      setError("Разрешены только PNG и JPEG.");
      return;
    }

    setError(null);
    setPickedFileName(file.name || "image.png");

    const url = URL.createObjectURL(file);
    setImageSrcForCrop(url);
    setCroppedAreaPixels(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setImageChanged(true);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (file) acceptFile(file);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) acceptFile(file);
  };

  const onCropComplete = (_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  };

  const applyCrop = async () => {
    if (!imageSrcForCrop || !croppedAreaPixels) return;

    setError(null);
    try {
      // MIME: сохраняем png для предсказуемости (можно менять на jpeg)
      const mime: "image/png" | "image/jpeg" = "image/png";
      const blob = await cropToSquare512(imageSrcForCrop, croppedAreaPixels, mime);

      setCroppedBlob(blob);

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const p = URL.createObjectURL(blob);
      setPreviewUrl(p);
    } catch (e) {
      setError("Не удалось обрезать изображение.");
    }
  };

  const handleSave = async () => {
    if (!node) return;
    setError(null);
    setSaving(true);

    try {
      let picture_id: string | null | undefined = undefined;

      // Если картинка менялась — грузим именно кропнутый blob
      if (imageChanged) {
        if (!croppedBlob) {
          throw new Error("Сначала примените обрезку изображения.");
        }
        const resp = await onUploadImage(croppedBlob);
        picture_id = resp.id; // В НОДУ КЛАДЁМ ТОЛЬКО id
      }

      await onSaveNode(node.node_id, {
        name: clampName(name),
        description,
        ...(imageChanged ? { picture_path: picture_id ?? null } : {}),
      });

      // после успешного сохранения считаем, что изменений картинки нет
      setImageChanged(false);
    } catch (e: any) {
      setError(e?.message ? String(e.message) : "Ошибка сохранения.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        width: 360,
        borderLeft: "1px solid #ddd",
        backgroundColor: "#fafafa",
        padding: "10px 14px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14 }}>Инспектор узла</div>

      {!node && (
        <div style={{ fontSize: 13, opacity: 0.6 }}>
          Нажмите «Редактировать» и выберите узел на доске.
        </div>
      )}

      {error && (
        <div style={{ fontSize: 12, color: "#b00020", whiteSpace: "pre-wrap" }}>
          {error}
        </div>
      )}

      {/* Имя */}
      <label style={{ fontSize: 12, fontWeight: 600, opacity: disabled ? 0.6 : 0.9 }}>
        Имя (до 64 символов)
        <input
          type="text"
          value={name}
          maxLength={MAX_NAME_LEN}
          disabled={disabled}
          onChange={(e) => setName(e.target.value)}
          style={{
            width: "100%",
            marginTop: 4,
            padding: "6px 8px",
            fontSize: 13,
            borderRadius: 6,
            border: "1px solid #ccc",
            boxSizing: "border-box",
          }}
        />
      </label>

      {/* Описание */}
      <label style={{ fontSize: 12, fontWeight: 600, opacity: disabled ? 0.6 : 0.9 }}>
        Описание
        <textarea
          value={description}
          disabled={disabled}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          style={{
            width: "100%",
            marginTop: 4,
            padding: "6px 8px",
            fontSize: 13,
            borderRadius: 6,
            border: "1px solid #ccc",
            boxSizing: "border-box",
            resize: "vertical",
          }}
        />
      </label>

      {/* Картинка */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, opacity: disabled ? 0.6 : 0.9 }}>
          Картинка (PNG/JPEG) — кроп 1:1, 512×512
        </div>

        {/* текущая/превью */}
        <div
          style={{
            width: "100%",
            aspectRatio: "1 / 1",
            borderRadius: 8,
            backgroundColor: "#000",
            overflow: "hidden",
            position: "relative",
            border: "1px solid #ddd",
          }}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt=""
              draggable={false}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : currentImgUrl ? (
            <img
              src={currentImgUrl}
              alt=""
              draggable={false}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : null}
        </div>

        {/* drop zone */}
        <div
          onDragOver={onDragOver}
          onDrop={onDrop}
          style={{
            padding: "10px 10px",
            borderRadius: 8,
            border: "1px dashed #999",
            backgroundColor: "#fff",
            fontSize: 12,
            opacity: disabled ? 0.6 : 1,
          }}
        >
          Перетащите PNG/JPEG сюда или{" "}
          <button
            type="button"
            onClick={openFileDialog}
            disabled={disabled}
            style={{
              border: "none",
              background: "none",
              padding: 0,
              color: "#0b57d0",
              textDecoration: "underline",
              cursor: disabled ? "default" : "pointer",
              fontSize: 12,
            }}
          >
            выберите файл
          </button>
          .
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            style={{ display: "none" }}
            onChange={onPickFile}
          />
        </div>

        {/* crop UI when file selected */}
        {imageSrcForCrop && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                position: "relative",
                width: "100%",
                height: 220,
                background: "#111",
                borderRadius: 8,
                overflow: "hidden",
                border: "1px solid #ddd",
              }}
            >
              <Cropper
                image={imageSrcForCrop}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            <label style={{ fontSize: 12, display: "flex", gap: 10, alignItems: "center" }}>
              Zoom
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                disabled={disabled}
                onChange={(e) => setZoom(Number(e.target.value))}
                style={{ flexGrow: 1 }}
              />
            </label>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={applyCrop}
                disabled={disabled || !croppedAreaPixels}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #555",
                  backgroundColor: "#333",
                  color: "#fff",
                  cursor: disabled ? "default" : "pointer",
                  fontSize: 13,
                }}
              >
                Применить обрезку
              </button>
              <div style={{ fontSize: 12, opacity: 0.6, alignSelf: "center" }}>
                {pickedFileName}
              </div>
            </div>

            {!croppedBlob && (
              <div style={{ fontSize: 12, opacity: 0.6 }}>
                Чтобы сохранить, нажмите «Применить обрезку».
              </div>
            )}
          </div>
        )}
      </div>

      {/* save */}
      <button
        type="button"
        onClick={handleSave}
        disabled={!node || saving}
        style={{
          marginTop: 4,
          alignSelf: "flex-start",
          padding: "6px 12px",
          fontSize: 13,
          borderRadius: 6,
          border: "1px solid #555",
          backgroundColor: !node || saving ? "#ddd" : "#333",
          color: !node || saving ? "#777" : "#f5f5f5",
          cursor: !node || saving ? "default" : "pointer",
        }}
      >
        {saving ? "Сохраняю…" : "Сохранить"}
      </button>
    </div>
  );
};
