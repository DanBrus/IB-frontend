import type { BoardNode, CanonicalEntity } from "./boardTypes";

function normalizePicturePathList(picturePaths: string[] | null | undefined): string[] {
  if (!Array.isArray(picturePaths)) return [];

  return picturePaths
    .map((picturePath) => picturePath.trim())
    .filter(Boolean);
}

export function getCanonicalEntityPicturePath(entity: CanonicalEntity): string | null {
  const normalizedPaths = normalizePicturePathList(entity.picture_paths);

  return normalizedPaths.length > 0 ? normalizedPaths[normalizedPaths.length - 1] : null;
}

export function getCanonicalEntityMergeTarget(entity: CanonicalEntity): number | null {
  return typeof entity.merged_to === "number" && Number.isFinite(entity.merged_to)
    ? entity.merged_to
    : null;
}

export function getPrimaryNodePicturePath(
  picturePaths: string[] | null | undefined
): string | null {
  const normalizedPaths = normalizePicturePathList(picturePaths);

  return normalizedPaths.length > 0 ? normalizedPaths[normalizedPaths.length - 1] : null;
}

export function formatCanonicalEntityId(entityId: number | null | undefined): string {
  return typeof entityId === "number" && Number.isFinite(entityId)
    ? `ce-${entityId}`
    : "";
}

export function isCanonicalEntityMerged(entity: CanonicalEntity): boolean {
  return getCanonicalEntityMergeTarget(entity) !== null;
}

export function resolveCanonicalEntityRootId(
  entityId: number | null | undefined,
  entities: CanonicalEntity[]
): number | null {
  if (typeof entityId !== "number" || !Number.isFinite(entityId)) return null;

  const entitiesById = new Map(
    entities.map((entity) => [entity.en_id, entity] as const)
  );
  const visited = new Set<number>();
  let currentEntityId: number | null = entityId;

  while (currentEntityId !== null) {
    if (visited.has(currentEntityId)) {
      return null;
    }
    visited.add(currentEntityId);

    const currentEntity = entitiesById.get(currentEntityId);
    if (!currentEntity) {
      return currentEntityId;
    }

    const nextEntityId = getCanonicalEntityMergeTarget(currentEntity);
    if (nextEntityId === null) {
      return currentEntityId;
    }

    currentEntityId = nextEntityId;
  }

  return null;
}

export function getCanonicalEntityPicturePathChain(
  entityId: number | null | undefined,
  entities: CanonicalEntity[]
): string[] {
  if (typeof entityId !== "number" || !Number.isFinite(entityId)) return [];

  const entitiesById = new Map(
    entities.map((entity) => [entity.en_id, entity] as const)
  );
  const childrenById = new Map<number, CanonicalEntity[]>();

  entities.forEach((entity) => {
    const mergeTarget = getCanonicalEntityMergeTarget(entity);
    if (mergeTarget === null) return;

    const children = childrenById.get(mergeTarget) ?? [];
    children.push(entity);
    childrenById.set(mergeTarget, children);
  });

  childrenById.forEach((children, targetId) => {
    childrenById.set(
      targetId,
      [...children].sort(
        (left, right) =>
          left.name.localeCompare(right.name, "ru") || left.en_id - right.en_id
      )
    );
  });

  const result: string[] = [];
  const visited = new Set<number>();

  const visit = (currentEntityId: number) => {
    if (visited.has(currentEntityId)) return;
    visited.add(currentEntityId);

    const children = childrenById.get(currentEntityId) ?? [];
    children.forEach((childEntity) => visit(childEntity.en_id));

    const currentEntity = entitiesById.get(currentEntityId);
    if (!currentEntity) return;

    const picturePath = getCanonicalEntityPicturePath(currentEntity);
    if (picturePath) {
      result.push(picturePath);
    }
  };

  visit(entityId);
  return result;
}

export function getNodePicturePathChain(
  entityId: number | null | undefined,
  entities: CanonicalEntity[],
  fallbackPicturePaths: string[] | null | undefined
): string[] {
  const picturePathChain = getCanonicalEntityPicturePathChain(entityId, entities);
  return picturePathChain.length > 0
    ? picturePathChain
    : normalizePicturePathList(fallbackPicturePaths);
}

export function applyCanonicalEntityPicturesToNodes(
  nodes: BoardNode[],
  entities: CanonicalEntity[]
): BoardNode[] {
  return nodes.map((node) => {
    const nextPicturePaths = getNodePicturePathChain(
      node.ce_id,
      entities,
      node.picture_path
    );
    const currentPicturePaths = normalizePicturePathList(node.picture_path);
    const hasSamePicturePaths =
      currentPicturePaths.length === nextPicturePaths.length &&
      currentPicturePaths.every(
        (picturePath, index) => picturePath === nextPicturePaths[index]
      );

    return hasSamePicturePaths
      ? node
      : {
          ...node,
          picture_path: nextPicturePaths,
        };
  });
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
