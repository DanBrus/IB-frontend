import React, { useEffect, useMemo, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import {
  formatCanonicalEntityId,
  getCanonicalEntityMergeTarget,
  getCanonicalEntityPicturePath,
  isCanonicalEntityMerged,
  sortCanonicalEntities,
} from "../canonicalEntities";
import { BOARD_NODE_TYPES, type BoardNodeType, type CanonicalEntity } from "../boardTypes";
import type {
  CanonicalEntitiesSyncResult,
  CanonicalEntityDeleteResult,
} from "../boardDataSource";
import { FILE_RES_BASE_URL, type PictureMeta } from "../fileDataSource";

type Area = { x: number; y: number; width: number; height: number };
type EntityEditorState = {
  entity: CanonicalEntity;
  isNew: boolean;
} | null;

interface CanonicalEntityManagerProps {
  entities: CanonicalEntity[];
  createRequestToken: number;
  editEntityId?: number | null;
  editRequestToken?: number;
  onCreateEntityDraft: () => CanonicalEntity | null;
  onClose: (options?: { shouldRefreshNodes: boolean }) => void;
  onChange: (entities: CanonicalEntity[]) => Promise<CanonicalEntitiesSyncResult>;
  onDelete: (entityId: number) => Promise<CanonicalEntityDeleteResult>;
  onConfirmUnsavedBoardLoss: () => Promise<boolean>;
  pictureMetaById: Record<string, PictureMeta | null>;
  onLoadImageMetadata: (
    pictureIds: string[]
  ) => Promise<Record<string, PictureMeta | null>>;
  onUpdateImageMetadata: (
    pictureId: string,
    metadata: PictureMeta | null
  ) => Promise<PictureMeta | null>;
  onUploadImage: (blob: Blob) => Promise<{ id: string; url: string }>;
}

interface CanonicalEntityEditorDialogProps {
  entity: CanonicalEntity;
  isNew: boolean;
  existingEntities: CanonicalEntity[];
  onClose: () => void;
  onSave: (nextEntity: CanonicalEntity, previousEntityId: number | null) => Promise<void>;
  onDelete?: (() => Promise<CanonicalEntityDeleteResult>) | null;
  onConfirmUnsavedBoardLoss: () => Promise<boolean>;
  currentPictureMetadata?: PictureMeta | null;
  onLoadImageMetadata: (
    pictureIds: string[]
  ) => Promise<Record<string, PictureMeta | null>>;
  onUpdateImageMetadata: (
    pictureId: string,
    metadata: PictureMeta | null
  ) => Promise<PictureMeta | null>;
  onUploadImage: (blob: Blob) => Promise<{ id: string; url: string }>;
}

const TARGET_SIZE = 512;
type StatusTone = "info" | "success";

function normalizeSearchValue(value: string): string {
  return value.trim().toLocaleLowerCase();
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

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  const sx = crop.x * scaleX;
  const sy = crop.y * scaleY;
  const sWidth = crop.width * scaleX;
  const sHeight = crop.height * scaleY;

  ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, TARGET_SIZE, TARGET_SIZE);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (nextBlob) => (nextBlob ? resolve(nextBlob) : reject(new Error("toBlob returned null"))),
      mime,
      mime === "image/jpeg" ? 0.9 : undefined
    );
  });

  return blob;
}

function buildGroupedEntities(entities: CanonicalEntity[], searchTerm: string) {
  const normalizedSearchTerm = normalizeSearchValue(searchTerm);
  const filteredEntities = sortCanonicalEntities(entities).filter((entity) => {
    if (!normalizedSearchTerm) return true;

    const haystack = [
      entity.name,
      String(entity.en_id),
      formatCanonicalEntityId(entity.en_id),
      entity.entity_type,
      String(getCanonicalEntityMergeTarget(entity) ?? ""),
      formatCanonicalEntityId(getCanonicalEntityMergeTarget(entity)),
    ]
      .map((value) => normalizeSearchValue(value))
      .join(" ");

    return haystack.includes(normalizedSearchTerm);
  });

  const groups = new Map<BoardNodeType, CanonicalEntity[]>();

  filteredEntities.forEach((entity) => {
    const group = groups.get(entity.entity_type) ?? [];
    group.push(entity);
    groups.set(entity.entity_type, group);
  });

  return [...groups.entries()].sort(([leftType], [rightType]) =>
    leftType.localeCompare(rightType, "ru")
  );
}

function getCanonicalEntityDisplayName(entity: CanonicalEntity): string {
  const normalizedName = entity.name.trim();
  return normalizedName || formatCanonicalEntityId(entity.en_id);
}

function sortMergeTargetEntities(entities: CanonicalEntity[]): CanonicalEntity[] {
  return [...entities].sort(
    (left, right) =>
      getCanonicalEntityDisplayName(left).localeCompare(
        getCanonicalEntityDisplayName(right),
        "ru"
      ) ||
      left.entity_type.localeCompare(right.entity_type, "ru") ||
      left.en_id - right.en_id
  );
}

const CanonicalEntityEditorDialog: React.FC<CanonicalEntityEditorDialogProps> = ({
  entity,
  isNew,
  existingEntities,
  onClose,
  onSave,
  onDelete,
  onConfirmUnsavedBoardLoss,
  currentPictureMetadata,
  onLoadImageMetadata,
  onUpdateImageMetadata,
  onUploadImage,
}) => {
  const [name, setName] = useState(entity.name);
  const [entityType, setEntityType] = useState<BoardNodeType>(entity.entity_type);
  const [mergedTo, setMergedTo] = useState<number | null>(
    getCanonicalEntityMergeTarget(entity)
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [imageChanged, setImageChanged] = useState(false);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [pickedFileName, setPickedFileName] = useState<string>("image.png");
  const [imageSrcForCrop, setImageSrcForCrop] = useState<string | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataSaving, setMetadataSaving] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [metadataAuthorDraft, setMetadataAuthorDraft] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentPicturePath = useMemo(() => getCanonicalEntityPicturePath(entity), [entity]);
  const effectiveCurrentPicturePath = imageRemoved ? null : currentPicturePath;
  const currentImgUrl = useMemo(
    () =>
      effectiveCurrentPicturePath
        ? `${FILE_RES_BASE_URL}/res/${effectiveCurrentPicturePath}`
        : null,
    [effectiveCurrentPicturePath]
  );
  const availableMergeTargets = useMemo(
    () =>
      sortMergeTargetEntities(
        existingEntities.filter((existingEntity) => existingEntity.en_id !== entity.en_id)
      ),
    [entity.en_id, existingEntities]
  );
  const hasPendingImageSelection =
    imageSrcForCrop !== null || croppedBlob !== null || previewUrl !== null;
  const canRemoveImage = Boolean(currentPicturePath) || hasPendingImageSelection;
  const removeImageButtonLabel =
    currentPicturePath && imageRemoved && !hasPendingImageSelection
      ? "Вернуть изображение"
      : "Удалить изображение";

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (imageSrcForCrop) URL.revokeObjectURL(imageSrcForCrop);
    };
  }, [imageSrcForCrop]);

  useEffect(() => {
    setMetadataDialogOpen(false);
    setMetadataLoading(false);
    setMetadataSaving(false);
    setMetadataError(null);
    setMetadataAuthorDraft("");
  }, [effectiveCurrentPicturePath, entity.en_id]);

  const clearPendingImageSelection = () => {
    setImageChanged(false);
    setPickedFileName("image.png");
    setCroppedAreaPixels(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedBlob(null);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    if (imageSrcForCrop) {
      URL.revokeObjectURL(imageSrcForCrop);
      setImageSrcForCrop(null);
    }
  };

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
    setImageRemoved(false);

    const nextUrl = URL.createObjectURL(file);
    setImageSrcForCrop(nextUrl);
    setCroppedAreaPixels(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setImageChanged(true);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (saving || deleting) return;

    const file = event.dataTransfer.files?.[0];
    if (file) acceptFile(file);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handlePickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) acceptFile(file);
  };

  const handleCropComplete = (_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  };

  const handleApplyCrop = async () => {
    if (!imageSrcForCrop || !croppedAreaPixels) return;

    setError(null);
    try {
      const blob = await cropToSquare512(imageSrcForCrop, croppedAreaPixels, "image/png");
      setCroppedBlob(blob);

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch {
      setError("Не удалось обрезать изображение.");
    }
  };

  const handleOpenMetadataDialog = async () => {
    if (!effectiveCurrentPicturePath || saving || deleting || metadataLoading) return;

    setError(null);
    setMetadataLoading(true);
    try {
      const loadedMetadata =
        currentPictureMetadata !== undefined
          ? currentPictureMetadata ?? null
          : (await onLoadImageMetadata([effectiveCurrentPicturePath]))[effectiveCurrentPicturePath] ??
            null;

      setMetadataAuthorDraft(
        typeof loadedMetadata?.author === "string" ? loadedMetadata.author : ""
      );
      setMetadataError(null);
      setMetadataDialogOpen(true);
    } catch (metadataLoadError: unknown) {
      setError(
        metadataLoadError instanceof Error
          ? metadataLoadError.message
          : "Не удалось загрузить метаданные изображения."
      );
    } finally {
      setMetadataLoading(false);
    }
  };

  const handleCloseMetadataDialog = () => {
    if (metadataSaving) return;
    setMetadataDialogOpen(false);
    setMetadataError(null);
  };

  const handleSaveMetadata = async () => {
    if (!effectiveCurrentPicturePath) return;

    setMetadataSaving(true);
    setMetadataError(null);
    try {
      const normalizedAuthor = metadataAuthorDraft.trim();
      await onUpdateImageMetadata(
        effectiveCurrentPicturePath,
        normalizedAuthor ? { author: normalizedAuthor } : null
      );
      setMetadataDialogOpen(false);
    } catch (metadataSaveError: unknown) {
      setMetadataError(
        metadataSaveError instanceof Error
          ? metadataSaveError.message
          : "Не удалось сохранить метаданные изображения."
      );
    } finally {
      setMetadataSaving(false);
    }
  };

  const handleToggleImageRemoval = () => {
    if (saving || deleting || metadataLoading || metadataSaving) return;

    setError(null);

    if (currentPicturePath && imageRemoved && !hasPendingImageSelection) {
      setImageRemoved(false);
      return;
    }

    clearPendingImageSelection();
    setImageRemoved(Boolean(currentPicturePath));
    setMetadataDialogOpen(false);
    setMetadataError(null);
    setMetadataAuthorDraft("");
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const normalizedMergedTo = mergedTo;

    if (!trimmedName) {
      setError("У сущности должно быть имя.");
      return;
    }

    if (normalizedMergedTo === entity.en_id) {
      setError("Сущность не может быть merged сама в себя.");
      return;
    }

    if (
      normalizedMergedTo &&
      !availableMergeTargets.some((candidate) => candidate.en_id === normalizedMergedTo)
    ) {
      setError("Выберите существующую canonical entity для merged_to.");
      return;
    }

    if (imageChanged && !croppedBlob) {
      setError("Сначала примените обрезку изображения.");
      return;
    }

    const confirmed = await onConfirmUnsavedBoardLoss();
    if (!confirmed) return;

    setSaving(true);
    setError(null);

    try {
      let picturePaths = imageRemoved ? [] : [...entity.picture_paths];
      if (imageChanged && croppedBlob) {
        const uploadResult = await onUploadImage(croppedBlob);
        picturePaths = [...picturePaths.filter(Boolean), uploadResult.id];
      }

      await onSave(
        {
          en_id: entity.en_id,
          name: trimmedName,
          entity_type: entityType,
          picture_paths: picturePaths,
          merged_to: normalizedMergedTo,
        },
        isNew ? null : entity.en_id
      );
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить сущность.");
      setSaving(false);
      return;
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    const confirmed = window.confirm(
      `Удалить canonical entity "${entity.name || formatCanonicalEntityId(entity.en_id)}"?`
    );
    if (!confirmed) return;

    const canContinue = await onConfirmUnsavedBoardLoss();
    if (!canContinue) return;

    setDeleting(true);
    setError(null);

    try {
      const deleteResult = await onDelete();

      if (deleteResult.outcome === "blocked") {
        setError(
          "Сначала удалите все ноды, связанные с данной canonical Entity, и проверьте связанные merge-ссылки."
        );
        return;
      }

      if (deleteResult.outcome === "placeholder") {
        setError(
          "Удаление canonical entity пока работает в placeholder-режиме."
        );
      }
    } catch (deleteError: unknown) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Не удалось удалить сущность."
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={saving || deleting ? undefined : onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(720px, calc(100vw - 40px))",
          maxHeight: "min(760px, calc(100vh - 40px))",
          overflowY: "auto",
          borderRadius: 10,
          border: "1px solid #ddd",
          background: "#fff",
          boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
          padding: "18px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              {isNew ? "Новая canonical entity" : "Редактирование canonical entity"}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.68 }}>
              Изображение, имя и тип применяются ко всем нодам, которые используют эту сущность.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving || deleting}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #bbb",
              backgroundColor: "#fff",
              color: "#333",
              cursor: saving || deleting ? "default" : "pointer",
              fontSize: 13,
            }}
          >
            Закрыть
          </button>
        </div>

        {error && <div style={{ fontSize: 12, color: "#b00020", whiteSpace: "pre-wrap" }}>{error}</div>}

        <label style={{ fontSize: 12, fontWeight: 600 }}>
          Имя
          <input
            type="text"
            value={name}
            disabled={saving || deleting}
            onChange={(event) => setName(event.target.value)}
            style={{
              width: "100%",
              marginTop: 4,
              padding: "6px 8px",
              fontSize: 13,
              borderRadius: 6,
              border: "1px solid #ccc",
              boxSizing: "border-box",
              backgroundColor: saving || deleting ? "#f2f2f2" : "#fff",
            }}
          />
        </label>

        <label style={{ fontSize: 12, fontWeight: 600 }}>
          Тип сущности
          <select
            value={entityType}
            disabled={saving || deleting}
            onChange={(event) => setEntityType(event.target.value as BoardNodeType)}
            style={{
              width: "100%",
              marginTop: 4,
              padding: "6px 8px",
              fontSize: 13,
              borderRadius: 6,
              border: "1px solid #ccc",
              boxSizing: "border-box",
              backgroundColor: saving || deleting ? "#f2f2f2" : "#fff",
            }}
          >
            {BOARD_NODE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 12, fontWeight: 600 }}>
          merged_to
          <select
            value={mergedTo === null ? "" : String(mergedTo)}
            disabled={saving || deleting}
            onChange={(event) =>
              setMergedTo(
                event.target.value === "" ? null : Number(event.target.value)
              )
            }
            style={{
              width: "100%",
              marginTop: 4,
              padding: "6px 8px",
              fontSize: 13,
              borderRadius: 6,
              border: "1px solid #ccc",
              boxSizing: "border-box",
              backgroundColor: saving || deleting ? "#f2f2f2" : "#fff",
            }}
          >
            <option value="">Не merged</option>
            {availableMergeTargets.map((candidate) => (
              <option key={candidate.en_id} value={String(candidate.en_id)}>
                {getCanonicalEntityDisplayName(candidate)} ({candidate.entity_type}) [{formatCanonicalEntityId(candidate.en_id)}]
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>Картинка (PNG/JPEG) — кроп 1:1, 512×512</div>

          <div
            style={{
              width: "100%",
              aspectRatio: "1 / 1",
              maxWidth: 320,
              borderRadius: 16,
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
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(255,255,255,0.65)",
                  fontSize: 12,
                  textAlign: "center",
                  padding: 16,
                  boxSizing: "border-box",
                }}
              >
                {imageRemoved && currentPicturePath
                  ? "Изображение будет отвязано после сохранения сущности."
                  : "У этой сущности пока нет изображения."}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleOpenMetadataDialog}
              disabled={
                !effectiveCurrentPicturePath ||
                imageChanged ||
                saving ||
                deleting ||
                imageRemoved ||
                metadataLoading ||
                metadataSaving
              }
              title={
                imageChanged
                  ? "Сначала сохраните сущность, чтобы редактировать метаданные новой картинки."
                  : imageRemoved
                    ? "Сначала сохраните удаление картинки или отмените его."
                    : !effectiveCurrentPicturePath
                    ? "Метаданные можно редактировать только у сохранённой картинки."
                    : undefined
              }
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #777",
                backgroundColor:
                  !effectiveCurrentPicturePath ||
                  imageChanged ||
                  saving ||
                  deleting ||
                  imageRemoved ||
                  metadataLoading ||
                  metadataSaving
                    ? "#f2f2f2"
                    : "#fff",
                color:
                  !effectiveCurrentPicturePath ||
                  imageChanged ||
                  saving ||
                  deleting ||
                  imageRemoved ||
                  metadataLoading ||
                  metadataSaving
                    ? "#888"
                    : "#333",
                cursor:
                  !effectiveCurrentPicturePath ||
                  imageChanged ||
                  saving ||
                  deleting ||
                  imageRemoved ||
                  metadataLoading ||
                  metadataSaving
                    ? "default"
                    : "pointer",
                fontSize: 12,
              }}
            >
              {metadataLoading ? "Загружаю метаданные…" : "Ред. метаданные"}
            </button>
            <button
              type="button"
              onClick={handleToggleImageRemoval}
              disabled={
                !canRemoveImage ||
                saving ||
                deleting ||
                metadataLoading ||
                metadataSaving
              }
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #9c4d4d",
                backgroundColor:
                  !canRemoveImage || saving || deleting || metadataLoading || metadataSaving
                    ? "#f2f2f2"
                    : "#fff",
                color:
                  !canRemoveImage || saving || deleting || metadataLoading || metadataSaving
                    ? "#888"
                    : "#7a1f1f",
                cursor:
                  !canRemoveImage || saving || deleting || metadataLoading || metadataSaving
                    ? "default"
                    : "pointer",
                fontSize: 12,
              }}
            >
              {removeImageButtonLabel}
            </button>
          </div>

          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            style={{
              padding: "10px 10px",
              borderRadius: 14,
              border: "1px dashed #999",
              backgroundColor: "#fff",
              fontSize: 12,
              opacity: saving || deleting ? 0.6 : 1,
            }}
          >
            Перетащите PNG/JPEG сюда или{" "}
            <button
              type="button"
              onClick={openFileDialog}
              disabled={saving || deleting}
              style={{
                border: "none",
                background: "none",
                padding: 0,
                color: "#0b57d0",
                textDecoration: "underline",
                cursor: saving || deleting ? "default" : "pointer",
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
              onChange={handlePickFile}
            />
          </div>

          {imageSrcForCrop && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: 260,
                  background: "#111",
                  borderRadius: 16,
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
                  onCropComplete={handleCropComplete}
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
                  disabled={saving || deleting}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  style={{ flexGrow: 1 }}
                />
              </label>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={handleApplyCrop}
                  disabled={saving || deleting || !croppedAreaPixels}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #555",
                    backgroundColor: saving || deleting ? "#ddd" : "#333",
                    color: saving || deleting ? "#777" : "#fff",
                    cursor: saving || deleting ? "default" : "pointer",
                    fontSize: 13,
                  }}
                >
                  Применить обрезку
                </button>
                <div style={{ fontSize: 12, opacity: 0.6 }}>{pickedFileName}</div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div>
            {!isNew && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving || deleting}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #b00020",
                  backgroundColor: "#fff",
                  color: "#b00020",
                  cursor: saving || deleting ? "default" : "pointer",
                  fontSize: 13,
                }}
              >
                {deleting ? "Удаляю…" : "Удалить сущность"}
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving || deleting}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #bbb",
                backgroundColor: "#f2f2f2",
                color: "#333",
                cursor: saving || deleting ? "default" : "pointer",
                fontSize: 13,
              }}
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || deleting}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #555",
                backgroundColor: saving || deleting ? "#ddd" : "#333",
                color: saving || deleting ? "#777" : "#f5f5f5",
                cursor: saving || deleting ? "default" : "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {saving ? "Сохраняю…" : isNew ? "Создать сущность" : "Сохранить сущность"}
            </button>
          </div>
        </div>

        {metadataDialogOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1400,
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
            onClick={handleCloseMetadataDialog}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              style={{
                width: "min(420px, calc(100vw - 40px))",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fff",
                boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Метаданные изображения</div>
                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.68 }}>
                  Укажите автора для текущей сохранённой картинки.
                </div>
              </div>

              {metadataError && (
                <div style={{ fontSize: 12, color: "#b00020", whiteSpace: "pre-wrap" }}>
                  {metadataError}
                </div>
              )}

              <label style={{ fontSize: 12, fontWeight: 600 }}>
                Автор изображения
                <input
                  type="text"
                  value={metadataAuthorDraft}
                  disabled={metadataSaving}
                  autoFocus
                  onChange={(event) => setMetadataAuthorDraft(event.target.value)}
                  style={{
                    width: "100%",
                    marginTop: 4,
                    padding: "6px 8px",
                    fontSize: 13,
                    borderRadius: 6,
                    border: "1px solid #ccc",
                    boxSizing: "border-box",
                    backgroundColor: metadataSaving ? "#f2f2f2" : "#fff",
                  }}
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={handleCloseMetadataDialog}
                  disabled={metadataSaving}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #bbb",
                    backgroundColor: "#f2f2f2",
                    color: "#333",
                    cursor: metadataSaving ? "default" : "pointer",
                    fontSize: 13,
                  }}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleSaveMetadata}
                  disabled={metadataSaving}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid #555",
                    backgroundColor: metadataSaving ? "#ddd" : "#333",
                    color: metadataSaving ? "#777" : "#f5f5f5",
                    cursor: metadataSaving ? "default" : "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {metadataSaving ? "Сохраняю…" : "Сохранить метаданные"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const CanonicalEntityManager: React.FC<CanonicalEntityManagerProps> = ({
  entities,
  createRequestToken,
  editEntityId = null,
  editRequestToken = 0,
  onCreateEntityDraft,
  onClose,
  onChange,
  onDelete,
  onConfirmUnsavedBoardLoss,
  pictureMetaById,
  onLoadImageMetadata,
  onUpdateImageMetadata,
  onUploadImage,
}) => {
  const [search, setSearch] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<StatusTone>("info");
  const [editorState, setEditorState] = useState<EntityEditorState>(null);
  const [shouldRefreshNodesOnClose, setShouldRefreshNodesOnClose] = useState(false);
  const handledCreateRequestTokenRef = useRef<number | null>(null);
  const handledEditRequestTokenRef = useRef<number | null>(null);

  const groupedEntities = useMemo(() => buildGroupedEntities(entities, search), [entities, search]);

  const openExistingEntityEditor = (entity: CanonicalEntity) => {
    const picturePath = getCanonicalEntityPicturePath(entity);
    if (
      picturePath &&
      !Object.prototype.hasOwnProperty.call(pictureMetaById, picturePath)
    ) {
      void onLoadImageMetadata([picturePath]).catch((error: unknown) => {
        console.error("[CanonicalEntityManager] Не удалось предзагрузить метаданные картинки", error);
      });
    }

    setEditorState({
      entity,
      isNew: false,
    });
  };

  useEffect(() => {
    if (createRequestToken <= 0 || handledCreateRequestTokenRef.current === createRequestToken) return;

    const nextEntityDraft = onCreateEntityDraft();
    if (!nextEntityDraft) return;

    handledCreateRequestTokenRef.current = createRequestToken;
    setEditorState({
      entity: nextEntityDraft,
      isNew: true,
    });
  }, [createRequestToken, onCreateEntityDraft]);

  useEffect(() => {
    if (editRequestToken <= 0 || handledEditRequestTokenRef.current === editRequestToken) return;
    if (editEntityId === null) {
      handledEditRequestTokenRef.current = editRequestToken;
      return;
    }

    const entityToEdit =
      entities.find((entity) => entity.en_id === editEntityId) ?? null;
    if (!entityToEdit) return;

    handledEditRequestTokenRef.current = editRequestToken;
    openExistingEntityEditor(entityToEdit);
  }, [
    editEntityId,
    editRequestToken,
    entities,
    onLoadImageMetadata,
    pictureMetaById,
  ]);

  const openCreateEntityEditor = () => {
    const nextEntityDraft = onCreateEntityDraft();
    if (!nextEntityDraft) return;

    setEditorState({
      entity: nextEntityDraft,
      isNew: true,
    });
  };

  const handleSaveEntity = async (nextEntity: CanonicalEntity, previousEntityId: number | null) => {
    const nextEntities = sortCanonicalEntities(
      previousEntityId !== null
        ? entities.map((entity) => (entity.en_id === previousEntityId ? nextEntity : entity))
        : [...entities, nextEntity]
    );

    const syncResult = await onChange(nextEntities);

    setStatusTone(syncResult.persisted ? "success" : "info");
    setStatusMessage(
      syncResult.persisted
        ? previousEntityId === null
          ? "Новая canonical entity сохранена на сервере и список перечитан."
          : "Canonical entity сохранена на сервере. Данные перечитаны."
        : previousEntityId === null
          ? "Новая сущность добавлена локально. Серверный sync пока работает в placeholder-режиме."
        : "Изменения сущности сохранены локально. Серверный sync пока работает в placeholder-режиме."
    );
    if (syncResult.persisted) {
      setShouldRefreshNodesOnClose(true);
    }
    setEditorState(null);
  };

  const handleDeleteEntity = async (
    entityId: number
  ): Promise<CanonicalEntityDeleteResult> => {
    const deleteResult = await onDelete(entityId);

    if (deleteResult.outcome === "deleted") {
      setStatusTone("success");
      setStatusMessage("Canonical entity удалена.");
      setShouldRefreshNodesOnClose(true);
      setEditorState(null);
    }

    if (deleteResult.outcome === "placeholder") {
      setStatusTone("info");
      setStatusMessage(
        "Удаление canonical entity пока работает в placeholder-режиме."
      );
    }

    return deleteResult;
  };

  const handleClose = () => {
    onClose({ shouldRefreshNodes: shouldRefreshNodesOnClose });
  };

  const handleImageMetadataUpdate = async (
    pictureId: string,
    metadata: PictureMeta | null
  ): Promise<PictureMeta | null> => {
    const updatedMetadata = await onUpdateImageMetadata(pictureId, metadata);
    setStatusTone("success");
    setStatusMessage(
      updatedMetadata?.author
        ? "Автор изображения сохранён."
        : "Метаданные изображения очищены."
    );
    return updatedMetadata;
  };

  const editorPicturePath = editorState
    ? getCanonicalEntityPicturePath(editorState.entity)
    : null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1200,
          background: "rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
        onClick={handleClose}
      >
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            width: "min(980px, calc(100vw - 40px))",
            height: "min(760px, calc(100vh - 40px))",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "#fff",
            boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px 18px 12px",
              borderBottom: "1px solid #e5e5e5",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>Настройка canonical entities</div>
                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.68 }}>
                  Сущности сгруппированы по типу и отсортированы по алфавиту. Щелчок по карточке открывает редактор.
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={openCreateEntityEditor}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #555",
                    backgroundColor: "#333",
                    color: "#f5f5f5",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  Новая сущность
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #bbb",
                    backgroundColor: "#fff",
                    color: "#333",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Закрыть
                </button>
              </div>
            </div>

            <label style={{ fontSize: 12, fontWeight: 600 }}>
              Поиск
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Фильтр по имени, типу или ce-id"
                style={{
                  width: "100%",
                  marginTop: 4,
                  padding: "7px 9px",
                  fontSize: 13,
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  boxSizing: "border-box",
                }}
              />
            </label>

            {statusMessage && (
              <div
                style={{
                  fontSize: 12,
                  color: statusTone === "success" ? "#2a5c2a" : "#244a7d",
                  background: statusTone === "success" ? "#f4fbf4" : "#f2f7ff",
                  padding: "8px 10px",
                  borderRadius: 8,
                }}
              >
                {statusMessage}
              </div>
            )}
          </div>

          <div
            style={{
              flexGrow: 1,
              overflowY: "auto",
              padding: "16px 18px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 18,
              backgroundColor: "#fafafa",
            }}
          >
            {groupedEntities.length > 0 ? (
              groupedEntities.map(([entityType, groupEntities]) => (
                <section key={entityType} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#333" }}>{entityType}</div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
                    {groupEntities.map((entity) => {
                      const picturePath = getCanonicalEntityPicturePath(entity);
                      const imageUrl = picturePath ? `${FILE_RES_BASE_URL}/res/${picturePath}` : null;
                      const mergedTarget = getCanonicalEntityMergeTarget(entity);
                      const merged = isCanonicalEntityMerged(entity);

                      return (
                        <button
                          key={entity.en_id}
                          type="button"
                          onClick={() => openExistingEntityEditor(entity)}
                          style={{
                            textAlign: "left",
                            padding: 0,
                            borderRadius: 12,
                            border: "1px solid #d9d9d9",
                            background: "#fff",
                            cursor: "pointer",
                            overflow: "hidden",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                          }}
                        >
                          <div style={{ display: "flex", minHeight: 120 }}>
                            <div
                              style={{
                                width: 96,
                                flexShrink: 0,
                                background: imageUrl ? "#111" : "#f0f0f0",
                                borderRight: "1px solid #e5e5e5",
                              }}
                            >
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt=""
                                  draggable={false}
                                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    textAlign: "center",
                                    fontSize: 11,
                                    color: "#666",
                                    padding: 10,
                                    boxSizing: "border-box",
                                  }}
                                >
                                  Без картинки
                                </div>
                              )}
                            </div>

                            <div
                              style={{
                                flexGrow: 1,
                              padding: "10px 12px",
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                              <div
                                style={{
                                  fontWeight: 700,
                                  fontSize: 14,
                                  color: merged ? "#818181" : "#222",
                                }}
                              >
                                {entity.name || "Без имени"}
                              </div>
                              <div style={{ fontSize: 12, color: "#666" }}>
                                {formatCanonicalEntityId(entity.en_id)}
                              </div>
                              {mergedTarget && (
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: "#b24444",
                                    fontWeight: 400,
                                    letterSpacing: "0.08em",
                                  }}
                                >
                                  MERGED {"->"} {formatCanonicalEntityId(mergedTarget)}
                                </div>
                              )}
                              <div style={{ marginTop: "auto", fontSize: 12, color: "#444" }}>{entity.entity_type}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))
            ) : (
              <div
                style={{
                  borderRadius: 12,
                  border: "1px dashed #c8c8c8",
                  background: "#fff",
                  padding: "18px 16px",
                  fontSize: 13,
                  color: "#555",
                }}
              >
                По текущему фильтру сущности не найдены.
              </div>
            )}
          </div>
        </div>
      </div>

      {editorState && (
        <CanonicalEntityEditorDialog
          entity={editorState.entity}
          isNew={editorState.isNew}
          existingEntities={entities}
          onClose={() => setEditorState(null)}
          onSave={handleSaveEntity}
          onDelete={
            editorState.isNew
              ? null
              : () => handleDeleteEntity(editorState.entity.en_id)
          }
          onConfirmUnsavedBoardLoss={onConfirmUnsavedBoardLoss}
          currentPictureMetadata={
            editorPicturePath ? pictureMetaById[editorPicturePath] : undefined
          }
          onLoadImageMetadata={onLoadImageMetadata}
          onUpdateImageMetadata={handleImageMetadataUpdate}
          onUploadImage={onUploadImage}
        />
      )}
    </>
  );
};
