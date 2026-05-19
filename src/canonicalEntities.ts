import type { CanonicalEntity } from "./boardTypes";

export function getCanonicalEntityPicturePath(entity: CanonicalEntity): string | null {
  const normalizedPaths = entity.picture_paths
    .map((picturePath) => picturePath.trim())
    .filter(Boolean);

  return normalizedPaths.length > 0 ? normalizedPaths[normalizedPaths.length - 1] : null;
}

export function getCanonicalEntityMergeTarget(entity: CanonicalEntity): number | null {
  return typeof entity.merged_to === "number" && Number.isFinite(entity.merged_to)
    ? entity.merged_to
    : null;
}

export function formatCanonicalEntityId(entityId: number | null | undefined): string {
  return typeof entityId === "number" && Number.isFinite(entityId)
    ? `ce-${entityId}`
    : "";
}

export function isCanonicalEntityMerged(entity: CanonicalEntity): boolean {
  return getCanonicalEntityMergeTarget(entity) !== null;
}

export function sortCanonicalEntities(entities: CanonicalEntity[]): CanonicalEntity[] {
  return [...entities].sort(
    (left, right) =>
      left.entity_type.localeCompare(right.entity_type, "ru") ||
      left.name.localeCompare(right.name, "ru") ||
      left.en_id - right.en_id
  );
}

export function createEmptyCanonicalEntity(entityId: number): CanonicalEntity {
  return {
    en_id: entityId,
    name: "",
    entity_type: "person_node",
    picture_paths: [],
    merged_to: null,
  };
}
