import type { StreamingBlobPayloadInputTypes } from "@smithy/types";

import * as fsa from "@vuebro/fsa";
import * as s3 from "stores/s3";
import { reactive, watchEffect } from "vue";

let fileSystemDirectoryHandle: FileSystemDirectoryHandle | undefined,
  remote = false;

const bucket = $ref(""),
  /**
   * Returns the appropriate I/O interface based on whether we're using remote
   * storage or local file system
   *
   * @returns The S3 interface if remote, otherwise the window object
   */
  io: () => typeof s3 | Window = () => (remote ? s3 : window);

watchEffect(() => {
  if (!bucket) {
    s3.setS3Client();
    remote = false;
    fileSystemDirectoryHandle = undefined;
  }
});

export const ioStore = reactive({
  bucket: $$(bucket),
  /**
   * Deletes an object from storage (either S3 or the local file system)
   *
   * @param Key - The key/path of the object to delete
   * @returns A promise that resolves when the object is deleted
   */
  deleteObject: async (Key: string) => {
    if (bucket)
      if (fileSystemDirectoryHandle)
        await fsa.deleteObject(fileSystemDirectoryHandle, Key);
      else await io().deleteObject(bucket, Key);
  },
  /**
   * Gets an object as a Blob from storage (either S3 or the local file system)
   *
   * @param Key - The key/path of the object to retrieve
   * @param [ResponseCacheControl] - Optional cache control header
   * @returns The object as a Blob
   */
  getObjectBlob: async (Key: string, ResponseCacheControl?: string) => {
    if (fileSystemDirectoryHandle)
      return fsa.getObjectBlob(fileSystemDirectoryHandle, Key);
    return io().getObjectBlob(bucket, Key, ResponseCacheControl);
  },
  /**
   * Gets an object as text from storage (either S3 or the local file system)
   *
   * @param Key - The key/path of the object to retrieve
   * @param [ResponseCacheControl] - Optional cache control header
   * @returns The object as text
   */
  getObjectText: async (Key: string, ResponseCacheControl?: string) => {
    if (fileSystemDirectoryHandle)
      return fsa.getObjectText(fileSystemDirectoryHandle, Key);
    return io().getObjectText(bucket, Key, ResponseCacheControl);
  },
  /**
   * Checks if a bucket exists and sets the remote flag accordingly
   *
   * @param Bucket - The name of the bucket to check
   * @param pin - Optional PIN for authentication
   * @returns A promise that resolves when the check is complete
   */
  headBucket: async (Bucket: string, pin: string | undefined) => {
    try {
      await s3.headBucket(Bucket, pin);
      remote = true;
    } catch (err) {
      const { message } = err as Error;
      throw new Error(message);
    }
  },
  /**
   * Checks if an object exists in storage (either S3 or the local file system)
   *
   * @param Key - The key/path of the object to check
   * @param [ResponseCacheControl] - Optional cache control header
   * @returns Returns undefined if object exists, throws error if not
   */
  headObject: async (Key: string, ResponseCacheControl?: string) => {
    if (fileSystemDirectoryHandle)
      return fsa.headObject(fileSystemDirectoryHandle, Key);
    return io().headObject(bucket, Key, ResponseCacheControl);
  },
  /**
   * Puts an object into storage (either S3 or the local file system)
   *
   * @param Key - The key/path to store the object at
   * @param body - The content of the object
   * @param ContentType - The content type of the object
   * @returns A promise that resolves when the object is stored
   */
  putObject: async (
    Key: string,
    body: StreamingBlobPayloadInputTypes,
    ContentType: string,
  ) => {
    if (bucket)
      if (fileSystemDirectoryHandle)
        await fsa.putObject(fileSystemDirectoryHandle, Key, body);
      else await io().putObject(bucket, Key, body, ContentType);
  },
  /**
   * Removes empty directories from storage (either S3 or the local file system)
   *
   * @returns A promise that resolves when the operation is complete
   */
  removeEmptyDirectories: async () => {
    const exclude = ["node_modules", ".git"];
    if (bucket)
      if (fileSystemDirectoryHandle)
        await fsa.removeEmptyDirectories(fileSystemDirectoryHandle, exclude);
      else await io().removeEmptyDirectories?.(bucket, exclude);
  },
  /**
   * Sets the file system directory handle for local file access
   *
   * @param value - The directory handle to set
   */
  setFileSystemDirectoryHandle: (value: FileSystemDirectoryHandle) => {
    fileSystemDirectoryHandle = value;
  },
});
