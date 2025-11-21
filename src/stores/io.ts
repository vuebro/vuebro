import type { StreamingBlobPayloadInputTypes } from "@smithy/types";

import * as fsa from "@vuebro/fsa";
import * as s3 from "stores/s3";
import { reactive, watchEffect } from "vue";

let fileSystemDirectoryHandle: FileSystemDirectoryHandle | undefined,
  remote = false;

const bucket = $ref(""),
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
  deleteObject: async (Key: string) => {
    if (bucket)
      if (fileSystemDirectoryHandle)
        await fsa.deleteObject(fileSystemDirectoryHandle, Key);
      else await io().deleteObject(bucket, Key);
  },
  getObjectBlob: async (Key: string, ResponseCacheControl?: string) => {
    if (fileSystemDirectoryHandle)
      return fsa.getObjectBlob(fileSystemDirectoryHandle, Key);
    return io().getObjectBlob(bucket, Key, ResponseCacheControl);
  },
  getObjectText: async (Key: string, ResponseCacheControl?: string) => {
    if (fileSystemDirectoryHandle)
      return fsa.getObjectText(fileSystemDirectoryHandle, Key);
    return io().getObjectText(bucket, Key, ResponseCacheControl);
  },
  headBucket: async (Bucket: string, pin: string | undefined) => {
    try {
      await s3.headBucket(Bucket, pin);
      remote = true;
    } catch (err) {
      const { message } = err as Error;
      throw new Error(message);
    }
  },
  headObject: async (Key: string, ResponseCacheControl?: string) => {
    if (fileSystemDirectoryHandle)
      return fsa.headObject(fileSystemDirectoryHandle, Key);
    return io().headObject(bucket, Key, ResponseCacheControl);
  },
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
  removeEmptyDirectories: async () => {
    const exclude = ["node_modules", ".git"];
    if (bucket)
      if (fileSystemDirectoryHandle)
        await fsa.removeEmptyDirectories(fileSystemDirectoryHandle, exclude);
      else await io().removeEmptyDirectories?.(bucket, exclude);
  },
  setFileSystemDirectoryHandle: (value: FileSystemDirectoryHandle) => {
    fileSystemDirectoryHandle = value;
  },
});
