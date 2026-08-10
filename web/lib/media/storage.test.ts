import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import {
  getMediaAssetDirectory,
  getMediaAssetFilePath,
  getMediaContentType,
  sanitizeOriginalFilename,
  writeMediaAssetFiles,
} from "./storage";

describe("sanitizeOriginalFilename", () => {
  it("strips directory paths and control characters", () => {
    expect(sanitizeOriginalFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeOriginalFilename("bad\tname\r\n.txt")).toBe("bad name .txt");
  });

  it("replaces dangerous characters and falls back to 'upload'", () => {
    expect(sanitizeOriginalFilename("a<b>c:d?.txt")).toBe("a_b_c_d_.txt");
    expect(sanitizeOriginalFilename("...")).toBe("upload");
    expect(sanitizeOriginalFilename("")).toBe("upload");
  });
});

describe("getMediaContentType", () => {
  it("maps file extensions to MIME types", () => {
    expect(getMediaContentType("original.jpg", "image/jpeg")).toBe("image/jpeg");
    expect(getMediaContentType("original.webp", "image/png")).toBe("image/webp");
    expect(getMediaContentType("original.avif", "image/jpeg")).toBe("image/avif");
    expect(getMediaContentType("original.mp4", "video/mp4")).toBe("video/mp4");
    expect(getMediaContentType("original.webm", "video/mp4")).toBe("video/webm");
    expect(getMediaContentType("original.mov", "video/mp4")).toBe("video/quicktime");
    expect(getMediaContentType("unknown.bin", "image/jpeg")).toBe("image/jpeg");
  });
});

describe("media path safety", () => {
  it("rejects paths that escape the media root", () => {
    const root = path.join(os.tmpdir(), "changers-media-test-root");
    // A file name that walks far enough up from the asset dir escapes the root.
    expect(() => getMediaAssetFilePath(root, "posts/abc", "../../../../secret.txt")).toThrow();
    // An absolute file name is also outside the root.
    expect(() => getMediaAssetFilePath(root, "posts/abc", "/absolutely/elsewhere.txt")).toThrow();
  });

  it("neutralizes traversal segments in the storage key", () => {
    const root = path.join(os.tmpdir(), "changers-media-test-root");
    // ".." segments are stripped rather than followed, so the resolved path
    // always stays inside the root.
    expect(getMediaAssetDirectory(root, "../../etc")).toBe(path.join(root, "etc"));
    expect(getMediaAssetDirectory(root, "public/posts/id")).toBe(path.join(root, "public", "posts", "id"));
  });
});

describe("video container verification", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("rejects a video that does not match its claimed container", async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "changers-media-test-"));
    const bogus = Buffer.from("this is definitely not a webm file at all....");
    await expect(
      writeMediaAssetFiles({
        mediaRoot: tmpDir,
        mediaId: "m1",
        purpose: "post",
        visibility: "public",
        buffer: bogus,
        mimeType: "video/webm",
        originalFilename: "clip.webm",
      }),
    ).rejects.toThrow("not a valid WebM");
  });

  it("accepts a WebM with a valid EBML magic and stores it", async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "changers-media-test-"));
    const ebml = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00]);
    const result = await writeMediaAssetFiles({
      mediaRoot: tmpDir,
      mediaId: "m2",
      purpose: "post",
      visibility: "public",
      buffer: ebml,
      mimeType: "video/webm",
      originalFilename: "clip.webm",
    });
    expect(result.mimeType).toBe("video/webm");
    const written = await fs.readFile(result.originalPath);
    expect(written.equals(ebml)).toBe(true);
  });

  it("rejects an MP4 without an ftyp box", async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "changers-media-test-"));
    const fakeMp4 = Buffer.alloc(64, 0);
    await expect(
      writeMediaAssetFiles({
        mediaRoot: tmpDir,
        mediaId: "m3",
        purpose: "post",
        visibility: "public",
        buffer: fakeMp4,
        mimeType: "video/mp4",
        originalFilename: "clip.mp4",
      }),
    ).rejects.toThrow("not a valid MP4/MOV");
  });
});
