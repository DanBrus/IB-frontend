import { authClient } from "./auth/authClient";

export type PictureMeta = {
  author?: string | null;
};

export interface FileDataSource {
  uploadImage(file: Blob, filename?: string): Promise<{ id: string; url: string }>;
  getImageMetadata(ids: string[]): Promise<Record<string, PictureMeta | null>>;
  updateImageMetadata(id: string, metadata: PictureMeta | null): Promise<PictureMeta | null>;
}

const FILE_BASE_URL = (import.meta.env.VITE_FILE_BASE_URL ?? "/api").replace(/\/$/, "");

function handleAuthFailure(res: Response): void {
  if (res.status === 401 || res.status === 403) {
    authClient.clearToken();
  }
}

function normalizePictureMeta(rawValue: unknown): PictureMeta | null {
  if (!rawValue || typeof rawValue !== "object") return null;

  const record = rawValue as Record<string, unknown>;
  const author = typeof record.author === "string" ? record.author.trim() : "";
  return author ? { author } : null;
}

class HttpFileDataSource implements FileDataSource {
  async uploadImage(file: Blob, filename = "image.png"): Promise<{ id: string; url: string }> {
    const url = `${FILE_BASE_URL}/res`;

    const fd = new FormData();
    fd.append("file", file, filename);

    const res = await fetch(url, {
      method: "POST",
      headers: authClient.getAuthHeaders(),
      body: fd,
    });

    if (!res.ok) {
      handleAuthFailure(res);
      throw new Error(`File upload failed: HTTP ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { id: string; url: string };
    return data;
  }

  async getImageMetadata(ids: string[]): Promise<Record<string, PictureMeta | null>> {
    const normalizedIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    if (normalizedIds.length === 0) return {};

    const url = `${FILE_BASE_URL}/res/meta/batch`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: normalizedIds }),
    });

    if (!res.ok) {
      handleAuthFailure(res);
      throw new Error(`Image metadata fetch failed: HTTP ${res.status} ${res.statusText}`);
    }

    const rawData = (await res.json()) as Record<string, unknown>;
    return normalizedIds.reduce<Record<string, PictureMeta | null>>((acc, id) => {
      acc[id] = normalizePictureMeta(rawData[id]);
      return acc;
    }, {});
  }

  async updateImageMetadata(
    id: string,
    metadata: PictureMeta | null
  ): Promise<PictureMeta | null> {
    const normalizedId = id.trim();
    if (!normalizedId) {
      throw new Error("Image id is required to update metadata.");
    }

    const url = `${FILE_BASE_URL}/res/meta?id=${encodeURIComponent(normalizedId)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authClient.getAuthHeaders(),
      },
      body: JSON.stringify(metadata ?? { author: null }),
    });

    if (!res.ok) {
      handleAuthFailure(res);
      throw new Error(`Image metadata update failed: HTTP ${res.status} ${res.statusText}`);
    }

    const rawData = (await res.json()) as unknown;
    return normalizePictureMeta(rawData);
  }
}

export const fileDataSource: FileDataSource = new HttpFileDataSource();

export const FILE_RES_BASE_URL = FILE_BASE_URL; // для <img src="...">
