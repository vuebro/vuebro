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

/**
 * Deletes an object from the local file system
 *
 * @param Bucket - The directory path (acts as a bucket)
 * @param Key - The file path relative to the directory
 * @returns A promise that resolves when the file is deleted
 */
const deleteObject = async (Bucket: string, Key: string) => {
    await unlink(join(Bucket, Key));
  },
  /**
   * Gets an object from the local file system
   *
   * @param Bucket - The directory path (acts as a bucket)
   * @param Key - The file path relative to the directory
   * @returns A response containing the file content
   */
  getObject = async (Bucket: string, Key: string) => {
    try {
      const file = join(Bucket, Key);
      const [body, mime] = await Promise.all([readFile(file), import("mime")]);
      const type = mime.default.getType(file);
      const headers = new Headers(type ? { "content-type": type } : undefined);
      return new Response(body.buffer, { headers });
    } catch {
      //
    }
    return new Response();
  },
  /**
   * Gets an object as a Blob from the local file system
   *
   * @param Bucket - The directory path (acts as a bucket)
   * @param Key - The file path relative to the directory
   * @returns A promise that resolves with the file content as a Blob
   */
  getObjectBlob = async (Bucket: string, Key: string) =>
    (await getObject(Bucket, Key)).blob(),
  /**
   * Gets an object as text from the local file system
   *
   * @param Bucket - The directory path (acts as a bucket)
   * @param Key - The file path relative to the directory
   * @returns A promise that resolves with the file content as text
   */
  getObjectText = async (Bucket: string, Key: string) =>
    (await getObject(Bucket, Key)).text(),
  /**
   * Checks if an object exists in the local file system
   *
   * @param Bucket - The directory path (acts as a bucket)
   * @param Key - The file path relative to the directory
   * @returns A promise that resolves with undefined if the file exists, or
   *   throws an error if it's not a file
   */
  headObject = async (Bucket: string, Key: string) => {
    const stats = await lstat(join(Bucket, Key));
    if (stats.isFile()) return undefined;
    throw new Error("It's not a file");
  },
  /**
   * Puts an object into the local file system
   *
   * @param Bucket - The directory path (acts as a bucket)
   * @param Key - The file path relative to the directory
   * @param body - The content to write to the file
   * @returns A promise that resolves when the file is written
   */
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
  /**
   * Removes empty directories from the local file system
   *
   * @param directory - The directory to process
   * @param exclude - Directories to exclude from removal
   * @returns A promise that resolves when the operation is complete
   */
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
