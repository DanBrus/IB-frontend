export interface FileDataSource {
  uploadImage(file: Blob, filename?: string): Promise<{ id: string; url: string }>;
}

const FILE_BASE_URL = (import.meta.env.VITE_FILE_BASE_URL ?? "http://localhost:8081").replace(/\/$/, "");

class HttpFileDataSource implements FileDataSource {
  async uploadImage(file: Blob, filename = "image.png"): Promise<{ id: string; url: string }> {
    const url = `${FILE_BASE_URL}/res`;

    const fd = new FormData();
    fd.append("file", file, filename);

    const res = await fetch(url, { method: "POST", body: fd });

    if (!res.ok) {
      throw new Error(`File upload failed: HTTP ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { id: string; url: string };
    return data;
  }
}

export const fileDataSource: FileDataSource = new HttpFileDataSource();

export const FILE_RES_BASE_URL = FILE_BASE_URL; // для <img src="...">
