import type { StreamingBlobPayloadInputTypes } from "@smithy/types";

import { dialog } from "@electron/remote";
import { contextBridge } from "electron";
import {
  access,
  lstat,
  mkdir,
  readdir,
  readFile,
  rmdir,
  unlink,
  writeFile,
} from "fs/promises";
import { basename, dirname, join } from "path";

const deleteObject = async (Bucket: string, Key: string) => {
    await unlink(join(Bucket, Key));
  },
  getObject = async (Bucket: string, Key: string) => {
    try {
      const file = join(Bucket, Key);
      const [body, mime] = await Promise.all([readFile(file), import("mime")]);
      const type = mime.default.getType(file);
      const headers = new Headers(type ? { "content-type": type } : undefined);
      return new Response(body.buffer, { headers });
    } catch {
      return new Response();
    }
  },
  getObjectBlob = async (Bucket: string, Key: string) =>
    (await getObject(Bucket, Key)).blob(),
  getObjectText = async (Bucket: string, Key: string) =>
    (await getObject(Bucket, Key)).text(),
  headObject = async (Bucket: string, Key: string) => {
    const stats = await lstat(join(Bucket, Key));
    if (stats.isFile()) return undefined;
    throw new Error("It's not a file");
  },
  putObject = async (
    Bucket: string,
    Key: string,
    body: StreamingBlobPayloadInputTypes,
  ) => {
    const filePath = join(Bucket, Key);
    const dirName = dirname(filePath);
    try {
      await access(dirName);
    } catch {
      await mkdir(dirName, { recursive: true });
    }
    await writeFile(filePath, body as string | Uint8Array);
  },
  removeEmptyDirectories = async (directory: string, exclude: string[]) => {
    const fileStats = await lstat(directory);
    if (!fileStats.isDirectory() || exclude.includes(basename(directory)))
      return;
    let fileNames = await readdir(directory);
    if (fileNames.length) {
      await Promise.all(
        fileNames.map((fileName) =>
          removeEmptyDirectories(join(directory, fileName), exclude),
        ),
      );
      fileNames = await readdir(directory);
    }
    if (!fileNames.length) await rmdir(directory);
  };

Object.entries({
  deleteObject,
  dialog,
  getObjectBlob,
  getObjectText,
  headObject,
  putObject,
  removeEmptyDirectories,
}).forEach(([apiKey, api]) => {
  contextBridge.exposeInMainWorld(apiKey, api);
});
