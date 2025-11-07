import type { StreamingBlobPayloadInputTypes } from "@smithy/types";

import * as fsa from "@vuebro/fsa";
import * as s3 from "stores/s3";
import { ref, watch } from "vue";

let fileSystemDirectoryHandle: FileSystemDirectoryHandle | undefined;

const remote = ref(false);

/**
 * Returns the appropriate I/O interface based on whether we're using remote
 * storage or local file system
 *
 * @returns The S3 interface if remote, otherwise the window object
 */
const io: () => typeof s3 | Window = () => (remote.value ? s3 : window);

/**
 * Deletes an object from storage (either S3 or the local file system)
 *
 * @param Key - The key/path of the object to delete
 * @returns A promise that resolves when the object is deleted
 */
export const bucket = ref(""),
  deleteObject = async (Key: string) => {
    if (bucket.value)
      if (fileSystemDirectoryHandle)
        await fsa.deleteObject(fileSystemDirectoryHandle, Key);
      else await io().deleteObject(bucket.value, Key);
  },
  /**
   * Gets an object as a Blob from storage (either S3 or the local file system)
   *
   * @param Key - The key/path of the object to retrieve
   * @param [ResponseCacheControl] - Optional cache control header
   * @returns The object as a Blob
   */
  getObjectBlob = async (Key: string, ResponseCacheControl?: string) => {
    if (fileSystemDirectoryHandle)
      return fsa.getObjectBlob(fileSystemDirectoryHandle, Key);
    return io().getObjectBlob(bucket.value, Key, ResponseCacheControl);
  },
  /**
   * Gets an object as text from storage (either S3 or the local file system)
   *
   * @param Key - The key/path of the object to retrieve
   * @param [ResponseCacheControl] - Optional cache control header
   * @returns The object as text
   */
  getObjectText = async (Key: string, ResponseCacheControl?: string) => {
    if (fileSystemDirectoryHandle)
      return fsa.getObjectText(fileSystemDirectoryHandle, Key);
    return io().getObjectText(bucket.value, Key, ResponseCacheControl);
  },
  /**
   * Checks if a bucket exists and sets the remote flag accordingly
   *
   * @param Bucket - The name of the bucket to check
   * @param pin - Optional PIN for authentication
   * @returns A promise that resolves when the check is complete
   */
  headBucket = async (Bucket: string, pin: string | undefined) => {
    try {
      await s3.headBucket(Bucket, pin);
      remote.value = true;
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
  headObject = async (Key: string, ResponseCacheControl?: string) => {
    if (fileSystemDirectoryHandle)
      return fsa.headObject(fileSystemDirectoryHandle, Key);
    return io().headObject(bucket.value, Key, ResponseCacheControl);
  },
  /**
   * Puts an object into storage (either S3 or the local file system)
   *
   * @param Key - The key/path to store the object at
   * @param body - The content of the object
   * @param ContentType - The content type of the object
   * @returns A promise that resolves when the object is stored
   */
  putObject = async (
    Key: string,
    body: StreamingBlobPayloadInputTypes,
    ContentType: string,
  ) => {
    if (bucket.value)
      if (fileSystemDirectoryHandle)
        await fsa.putObject(fileSystemDirectoryHandle, Key, body);
      else await io().putObject(bucket.value, Key, body, ContentType);
  },
  /**
   * Removes empty directories from storage (either S3 or the local file system)
   *
   * @returns A promise that resolves when the operation is complete
   */
  removeEmptyDirectories = async () => {
    const exclude = ["node_modules", ".git"];
    if (bucket.value)
      if (fileSystemDirectoryHandle)
        await fsa.removeEmptyDirectories(fileSystemDirectoryHandle, exclude);
      else await io().removeEmptyDirectories?.(bucket.value, exclude);
  },
  /**
   * Sets the file system directory handle for local file access
   *
   * @param value - The directory handle to set
   */
  setFileSystemDirectoryHandle = (value: FileSystemDirectoryHandle) => {
    fileSystemDirectoryHandle = value;
  };

watch(bucket, (value) => {
  if (!value) {
    s3.setS3Client();
    remote.value = false;
    if (fileSystemDirectoryHandle) fileSystemDirectoryHandle = undefined;
  }
});
