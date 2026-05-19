import type { CanonicalEntity } from "./boardTypes";

export function getCanonicalEntityPicturePath(entity: CanonicalEntity): string | null {
  const normalizedPaths = entity.picture_paths
    .map((picturePath) => picturePath.trim())
    .filter(Boolean);

  return normalizedPaths.length > 0 ? normalizedPaths[normalizedPaths.length - 1] : null;
}

export function getCanonicalEntityMergeTarget(entity: CanonicalEntity): string | null {
  if (typeof entity.merged_to !== "string") return null;

  const normalizedValue = entity.merged_to.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

export function isCanonicalEntityMerged(entity: CanonicalEntity): boolean {
  return getCanonicalEntityMergeTarget(entity) !== null;
}

export function sortCanonicalEntities(entities: CanonicalEntity[]): CanonicalEntity[] {
  return [...entities].sort(
    (left, right) =>
      left.entity_type.localeCompare(right.entity_type, "ru") ||
      left.name.localeCompare(right.name, "ru") ||
      left.en_id.localeCompare(right.en_id, "ru")
  );
}

export function createEmptyCanonicalEntity(existingEntities: CanonicalEntity[]): CanonicalEntity {
  const existingIds = new Set(existingEntities.map((entity) => entity.en_id));

  let counter = existingEntities.length + 1;
  let nextId = `canonical-entity-${counter}`;
  while (existingIds.has(nextId)) {
    counter += 1;
    nextId = `canonical-entity-${counter}`;
  }

  return {
    en_id: nextId,
    name: "",
    entity_type: "person_node",
    picture_paths: [],
    merged_to: null,
  };
}
