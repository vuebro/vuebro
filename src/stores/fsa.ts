import type { StreamingBlobPayloadInputTypes } from "@smithy/types";
import type { RunSequentialPromisesFulfilledResult } from "quasar";

import { runSequentialPromises } from "quasar";

const create = true;

/**
 * Gets a file or directory handle from the file system
 *
 * @param Bucket - The root directory handle
 * @param Key - The path to the file or directory
 * @param Create - Whether to create the directory if it doesn't exist
 * @returns The file or directory handle
 */
const getHandle = async (
  Bucket: FileSystemDirectoryHandle,
  Key: string,
  Create = false,
) => {
  const branch = [undefined, ...Key.split("/")],
    handle = (
      await runSequentialPromises(
        branch.map(
          (leaf, index) =>
            async (
              resultAggregator: RunSequentialPromisesFulfilledResult<
                number,
                FileSystemDirectoryHandle | FileSystemFileHandle | undefined
              >[],
            ) => {
              if (leaf) {
                const { value } = resultAggregator[index - 1] ?? {};
                if (value?.kind === "directory") {
                  try {
                    return await value.getFileHandle(leaf, { create: false });
                  } catch {
                    try {
                      return await value.getDirectoryHandle(leaf, {
                        create: Create,
                      });
                    } catch {
                      return;
                    }
                  }
                }
              } else return Bucket;
            },
        ),
      )
    ).map(({ value }) => value);
  return branch.length === handle.length
    ? handle[handle.length - 1]
    : undefined;
};
/**
 * Deletes an object from the file system
 *
 * @param Bucket - The root directory handle
 * @param Key - The path to the object to delete
 * @returns A promise that resolves when the object is deleted
 */
const deleteObject = async (Bucket: FileSystemDirectoryHandle, Key: string) => {
    const keys = Key.split("/"),
      name = keys.pop();
    if (name) {
      const handle = await getHandle(Bucket, keys.join("/"));
      if (handle?.kind === "directory") await handle.removeEntry(name);
    }
  },
  /**
   * Gets an object as a Blob from the file system
   *
   * @param Bucket - The root directory handle
   * @param Key - The path to the object
   * @returns The object as a Blob
   */
  getObjectBlob = async (Bucket: FileSystemDirectoryHandle, Key: string) => {
    const handle = await getHandle(Bucket, Key);
    if (handle?.kind === "file") return handle.getFile();
    return new Blob();
  },
  /**
   * Gets an object as text from the file system
   *
   * @param Bucket - The root directory handle
   * @param Key - The path to the object
   * @returns The object as text
   */
  getObjectText = async (Bucket: FileSystemDirectoryHandle, Key: string) =>
    (await getObjectBlob(Bucket, Key)).text(),
  /**
   * Checks if an object exists in the file system
   *
   * @param Bucket - The root directory handle
   * @param Key - The path to the object
   * @returns Returns undefined if object exists, throws error if not
   */
  headObject = async (Bucket: FileSystemDirectoryHandle, Key: string) => {
    const handle = await getHandle(Bucket, Key);
    if (handle?.kind === "file") return undefined;
    throw new Error("It's not a file");
  },
  /**
   * Puts an object into the file system
   *
   * @param Bucket - The root directory handle
   * @param Key - The path to store the object at
   * @param body - The content of the object
   * @returns A promise that resolves when the object is stored
   */
  putObject = async (
    Bucket: FileSystemDirectoryHandle,
    Key: string,
    body: StreamingBlobPayloadInputTypes,
  ) => {
    const keys = Key.split("/"),
      name = keys.pop();
    if (name) {
      const handle = await getHandle(Bucket, keys.join("/"), true);
      if (handle?.kind === "directory") {
        const fileHandle = await handle.getFileHandle(name, { create }),
          writable = await fileHandle.createWritable();
        await writable.write(body as FileSystemWriteChunkType);
        await writable.close();
      }
    }
  },
  /**
   * Removes empty directories from the file system
   *
   * @param directory - The directory to process
   * @param exclude - Directories to exclude from removal
   * @returns A promise that resolves when the operation is complete
   */
  removeEmptyDirectories = async (
    directory: FileSystemDirectoryHandle,
    exclude: string[],
  ) => {
    if (exclude.includes(directory.name)) return;
    const values = (await Array.fromAsync(directory.values())).filter(
      ({ kind }) => kind === "directory",
    );
    await Promise.all(
      values.map((value) =>
        removeEmptyDirectories(value as FileSystemDirectoryHandle, exclude),
      ),
    );
    await Promise.allSettled(
      values.map(({ name }) => directory.removeEntry(name)),
    );
  };

export {
  deleteObject,
  getObjectBlob,
  getObjectText,
  headObject,
  putObject,
  removeEmptyDirectories,
};
