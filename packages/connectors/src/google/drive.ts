import { fetchWithRetry } from "../runtime/retry.js";

export type DriveFile = {
  id: string;
  name?: string;
  mimeType?: string;
  modifiedTime?: string;
  size?: string;
  parents?: string[];
  driveId?: string;
};

export type DriveSearchArgs = {
  accessToken: string;
  query?: string | null;
  folderId?: string | null;
  limit?: number;
};

function buildDriveQuery(args: { query?: string | null; folderId?: string | null }): string {
  const parts: string[] = [];
  if (args.query && args.query.trim().length > 0) parts.push(`(${args.query.trim()})`);
  if (args.folderId && args.folderId.trim().length > 0) parts.push(`('${args.folderId.trim()}' in parents)`);
  parts.push("(trashed = false)");
  return parts.join(" and ");
}

export async function gdriveSearchFiles(args: DriveSearchArgs): Promise<{ files: DriveFile[] }> {
  const q = buildDriveQuery({ query: args.query ?? null, folderId: args.folderId ?? null });
  const pageSize = Math.max(1, Math.min(1000, args.limit ?? 50));
  const fields = "files(id,name,mimeType,modifiedTime,size,parents,driveId)";

  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", q);
  url.searchParams.set("pageSize", String(pageSize));
  url.searchParams.set("fields", fields);
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");

  const res = await fetchWithRetry(url.toString(), {
    method: "GET",
    headers: { authorization: `Bearer ${args.accessToken}` }
  });

  const raw = await res.text();
  if (!res.ok) {
    const err = new Error(`gdrive search failed: ${res.status} ${raw}`) as Error & { exitCode?: number };
    err.exitCode = 20;
    throw err;
  }
  const parsed = JSON.parse(raw) as { files?: DriveFile[] };
  return { files: Array.isArray(parsed.files) ? parsed.files : [] };
}

export type DriveGetMetadataArgs = {
  accessToken: string;
  fileId: string;
};

export async function gdriveGetMetadata(args: DriveGetMetadataArgs): Promise<DriveFile> {
  const fields = "id,name,mimeType,modifiedTime,size,parents,driveId";
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(args.fileId)}`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("supportsAllDrives", "true");

  const res = await fetchWithRetry(url.toString(), {
    method: "GET",
    headers: { authorization: `Bearer ${args.accessToken}` }
  });
  const raw = await res.text();
  if (!res.ok) {
    const err = new Error(`gdrive metadata failed: ${res.status} ${raw}`) as Error & { exitCode?: number };
    err.exitCode = 20;
    throw err;
  }
  return JSON.parse(raw) as DriveFile;
}

export type DriveExportArgs = {
  accessToken: string;
  fileId: string;
  mimeType: string;
};

export async function gdriveExportFile(args: DriveExportArgs): Promise<{
  bytes: Uint8Array;
  contentType: string;
}> {
  const url = new URL(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(args.fileId)}/export`
  );
  url.searchParams.set("mimeType", args.mimeType);
  url.searchParams.set("supportsAllDrives", "true");

  const res = await fetchWithRetry(url.toString(), {
    method: "GET",
    headers: { authorization: `Bearer ${args.accessToken}` }
  });
  if (!res.ok) {
    const raw = await res.text();
    const err = new Error(`gdrive export failed: ${res.status} ${raw}`) as Error & { exitCode?: number };
    err.exitCode = 20;
    throw err;
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  return {
    bytes: buf,
    contentType: res.headers.get("content-type") ?? "application/octet-stream"
  };
}

export type DriveDownloadArgs = {
  accessToken: string;
  fileId: string;
};

export async function gdriveDownloadFile(args: DriveDownloadArgs): Promise<{
  bytes: Uint8Array;
  contentType: string;
}> {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(args.fileId)}`);
  url.searchParams.set("alt", "media");
  url.searchParams.set("supportsAllDrives", "true");

  const res = await fetchWithRetry(url.toString(), {
    method: "GET",
    headers: { authorization: `Bearer ${args.accessToken}` }
  });
  if (!res.ok) {
    const raw = await res.text();
    const err = new Error(`gdrive download failed: ${res.status} ${raw}`) as Error & { exitCode?: number };
    err.exitCode = 20;
    throw err;
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  return {
    bytes: buf,
    contentType: res.headers.get("content-type") ?? "application/octet-stream"
  };
}
