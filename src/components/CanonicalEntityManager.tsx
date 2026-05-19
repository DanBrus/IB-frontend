import React, { useEffect, useMemo, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import {
  createEmptyCanonicalEntity,
  getCanonicalEntityPicturePath,
  sortCanonicalEntities,
} from "../canonicalEntities";
import { BOARD_NODE_TYPES, type BoardNodeType, type CanonicalEntity } from "../boardTypes";
import type {
  CanonicalEntitiesSyncResult,
  CanonicalEntityDeleteResult,
} from "../boardDataSource";
import { FILE_RES_BASE_URL } from "../fileDataSource";

type Area = { x: number; y: number; width: number; height: number };
type EntityEditorState = {
  entity: CanonicalEntity;
  isNew: boolean;
} | null;

interface CanonicalEntityManagerProps {
  entities: CanonicalEntity[];
  createRequestToken: number;
  onClose: (options?: { shouldRefreshNodes: boolean }) => void;
  onChange: (entities: CanonicalEntity[]) => Promise<CanonicalEntitiesSyncResult>;
  onDelete: (entityId: string) => Promise<CanonicalEntityDeleteResult>;
  onUploadImage: (blob: Blob) => Promise<{ id: string; url: string }>;
}

interface CanonicalEntityEditorDialogProps {
  entity: CanonicalEntity;
  isNew: boolean;
  existingEntities: CanonicalEntity[];
  onClose: () => void;
  onSave: (nextEntity: CanonicalEntity, previousEntityId: string | null) => Promise<void>;
  onDelete?: (() => Promise<CanonicalEntityDeleteResult>) | null;
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

    const haystack = [entity.name, entity.en_id, entity.entity_type]
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

const CanonicalEntityEditorDialog: React.FC<CanonicalEntityEditorDialogProps> = ({
  entity,
  isNew,
  existingEntities,
  onClose,
  onSave,
  onDelete,
  onUploadImage,
}) => {
  const [entityId, setEntityId] = useState(entity.en_id);
  const [name, setName] = useState(entity.name);
  const [entityType, setEntityType] = useState<BoardNodeType>(entity.entity_type);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [imageChanged, setImageChanged] = useState(false);
  const [pickedFileName, setPickedFileName] = useState<string>("image.png");
  const [imageSrcForCrop, setImageSrcForCrop] = useState<string | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentImgUrl = useMemo(() => {
    const picturePath = getCanonicalEntityPicturePath(entity);
    return picturePath ? `${FILE_RES_BASE_URL}/res/${picturePath}` : null;
  }, [entity]);

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

  const handleSave = async () => {
    const trimmedEntityId = entityId.trim();
    const trimmedName = name.trim();

    if (!trimmedEntityId) {
      setError("У сущности должен быть en_id.");
      return;
    }

    if (!trimmedName) {
      setError("У сущности должно быть имя.");
      return;
    }

    const duplicate = existingEntities.find(
      (existingEntity) => existingEntity.en_id === trimmedEntityId && existingEntity.en_id !== entity.en_id
    );
    if (duplicate) {
      setError(`Сущность с en_id "${trimmedEntityId}" уже существует.`);
      return;
    }

    if (imageChanged && !croppedBlob) {
      setError("Сначала примените обрезку изображения.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let picturePaths = [...entity.picture_paths];
      if (imageChanged && croppedBlob) {
        const uploadResult = await onUploadImage(croppedBlob);
        picturePaths = [...picturePaths.filter(Boolean), uploadResult.id];
      }

      await onSave(
        {
          en_id: trimmedEntityId,
          name: trimmedName,
          entity_type: entityType,
          picture_paths: picturePaths,
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
      `Удалить canonical entity "${entity.name || entity.en_id}"?`
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    try {
      const deleteResult = await onDelete();

      if (deleteResult.outcome === "blocked") {
        setError(
          "Сначала удалите все ноды, связанные с данной canonical Entity."
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
          en_id
          <input
            type="text"
            value={entityId}
            disabled={saving || deleting || !isNew}
            onChange={(event) => setEntityId(event.target.value)}
            style={{
              width: "100%",
              marginTop: 4,
              padding: "6px 8px",
              fontSize: 13,
              borderRadius: 6,
              border: "1px solid #ccc",
              boxSizing: "border-box",
              backgroundColor: saving || deleting || !isNew ? "#f2f2f2" : "#fff",
            }}
          />
        </label>

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
                У этой сущности пока нет изображения.
              </div>
            )}
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
      </div>
    </div>
  );
};

export const CanonicalEntityManager: React.FC<CanonicalEntityManagerProps> = ({
  entities,
  createRequestToken,
  onClose,
  onChange,
  onDelete,
  onUploadImage,
}) => {
  const [search, setSearch] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<StatusTone>("info");
  const [editorState, setEditorState] = useState<EntityEditorState>(null);
  const [shouldRefreshNodesOnClose, setShouldRefreshNodesOnClose] =
    useState(false);
  const handledCreateRequestTokenRef = useRef<number | null>(null);

  const groupedEntities = useMemo(() => buildGroupedEntities(entities, search), [entities, search]);

  useEffect(() => {
    if (createRequestToken <= 0 || handledCreateRequestTokenRef.current === createRequestToken) return;

    handledCreateRequestTokenRef.current = createRequestToken;
    setEditorState({
      entity: createEmptyCanonicalEntity(entities),
      isNew: true,
    });
  }, [createRequestToken, entities]);

  const openCreateEntityEditor = () => {
    setEditorState({
      entity: createEmptyCanonicalEntity(entities),
      isNew: true,
    });
  };

  const openExistingEntityEditor = (entity: CanonicalEntity) => {
    setEditorState({
      entity,
      isNew: false,
    });
  };

  const handleSaveEntity = async (nextEntity: CanonicalEntity, previousEntityId: string | null) => {
    const nextEntities = sortCanonicalEntities(
      previousEntityId
        ? entities.map((entity) => (entity.en_id === previousEntityId ? nextEntity : entity))
        : [...entities, nextEntity]
    );

    const syncResult = await onChange(nextEntities);

    if (previousEntityId !== null && syncResult.persisted) {
      setShouldRefreshNodesOnClose(true);
    }

    setStatusTone(syncResult.persisted ? "success" : "info");
    setStatusMessage(
      syncResult.persisted
        ? previousEntityId === null
          ? "Новая canonical entity сохранена на сервере."
          : "Canonical entity сохранена на сервере. После закрытия окна ноды будут перечитаны."
        : previousEntityId === null
          ? "Новая сущность добавлена локально. Серверный sync пока работает в placeholder-режиме."
          : "Изменения сущности сохранены локально. Серверный sync пока работает в placeholder-режиме."
    );
    setEditorState(null);
  };

  const handleDeleteEntity = async (
    entityId: string
  ): Promise<CanonicalEntityDeleteResult> => {
    const deleteResult = await onDelete(entityId);

    if (deleteResult.outcome === "deleted") {
      setStatusTone("success");
      setStatusMessage("Canonical entity удалена.");
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
                placeholder="Фильтр по имени, типу или en_id"
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
                              <div style={{ fontWeight: 700, fontSize: 14, color: "#222" }}>{entity.name || "Без имени"}</div>
                              <div style={{ fontSize: 12, color: "#666" }}>{entity.en_id}</div>
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
          onUploadImage={onUploadImage}
        />
      )}
    </>
  );
};
