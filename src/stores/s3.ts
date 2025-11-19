import type { S3ClientConfig } from "@aws-sdk/client-s3";
import type { StreamingBlobPayloadInputTypes } from "@smithy/types";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { FetchHttpHandler } from "@smithy/fetch-http-handler";
import { sharedStore } from "@vuebro/shared";
import { useStorage } from "@vueuse/core";
import { AES, Utf8 } from "crypto-es";
import { mergeDefaults } from "stores/defaults";

let s3Client: S3Client | undefined;

const { credentials: defaults } = sharedStore;

const credential = $(
  useStorage("s3", defaults, localStorage, {
    mergeDefaults,
  }),
);

export const removeEmptyDirectories = undefined,
  /**
   * Sets or clears the S3 client instance
   *
   * @param [value] - The S3 client instance to set, or undefined to clear
   */
  setS3Client = (value?: S3Client) => {
    s3Client?.destroy();
    s3Client = value;
  };

/**
 * Gets an object from an S3 bucket
 *
 * @param Bucket - The name of the S3 bucket
 * @param Key - The key of the object to retrieve
 * @param [ResponseCacheControl] - Optional cache control header
 * @returns The response containing the object
 */
const getObject = async (
  Bucket: string,
  Key: string,
  ResponseCacheControl?: string,
) => {
  if (s3Client)
    try {
      const { Body, ContentType } = await s3Client.send(
        new GetObjectCommand({ Bucket, Key, ResponseCacheControl }),
      );
      const headers = new Headers({ "content-type": ContentType ?? "" });
      return new Response(Body as BodyInit, { headers });
    } catch {
      //
    }
  return new Response();
};

/**
 * Deletes an object from an S3 bucket
 *
 * @param Bucket - The name of the S3 bucket
 * @param Key - The key of the object to delete
 * @returns A promise that resolves when the object is deleted
 */
export const deleteObject = async (Bucket: string, Key: string) => {
    await s3Client?.send(new DeleteObjectCommand({ Bucket, Key }));
  },
  /**
   * Gets an object as a Blob from an S3 bucket
   *
   * @param Bucket - The name of the S3 bucket
   * @param Key - The key of the object to retrieve
   * @param [ResponseCacheControl] - Optional cache control header
   * @returns The object as a Blob
   */
  getObjectBlob = async (
    Bucket: string,
    Key: string,
    ResponseCacheControl?: string,
  ) => (await getObject(Bucket, Key, ResponseCacheControl)).blob(),
  /**
   * Gets an object as text from an S3 bucket
   *
   * @param Bucket - The name of the S3 bucket
   * @param Key - The key of the object to retrieve
   * @param [ResponseCacheControl] - Optional cache control header
   * @returns The object as text
   */
  getObjectText = async (
    Bucket: string,
    Key: string,
    ResponseCacheControl?: string,
  ) => (await getObject(Bucket, Key, ResponseCacheControl)).text(),
  /**
   * Checks if an S3 bucket exists
   *
   * @param Bucket - The name of the S3 bucket to check
   * @param pin - Optional PIN for authentication
   * @returns A promise that resolves when the check is complete
   */
  headBucket = async (Bucket: string, pin: string | undefined) => {
    let { accessKeyId, endpoint, region, secretAccessKey } =
      credential[Bucket] ?? {};
    if (pin) {
      accessKeyId = AES.decrypt(accessKeyId ?? "", pin).toString(Utf8);
      endpoint = AES.decrypt(endpoint ?? "", pin).toString(Utf8);
      region = AES.decrypt(region ?? "", pin).toString(Utf8);
      secretAccessKey = AES.decrypt(secretAccessKey ?? "", pin).toString(Utf8);
    }
    const credentials = { accessKeyId, secretAccessKey };
    s3Client = new S3Client({
      credentials,
      endpoint,
      region,
      requestHandler: new FetchHttpHandler(),
    } as S3ClientConfig);
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket }));
    } catch (err) {
      setS3Client();
      const { message } = err as Error;
      throw new Error(message);
    }
  },
  /**
   * Checks if an object exists in an S3 bucket
   *
   * @param Bucket - The name of the S3 bucket
   * @param Key - The key of the object to check
   * @param [ResponseCacheControl] - Optional cache control header
   * @returns The output of the head object command or undefined
   */
  headObject = async (
    Bucket: string,
    Key: string,
    ResponseCacheControl?: string,
  ) =>
    s3Client?.send(
      new HeadObjectCommand({ Bucket, Key, ResponseCacheControl }),
    ),
  /**
   * Puts an object into an S3 bucket
   *
   * @param Bucket - The name of the S3 bucket
   * @param Key - The key to store the object at
   * @param body - The content of the object
   * @param ContentType - The content type of the object
   * @returns A promise that resolves when the object is stored
   */
  putObject = async (
    Bucket: string,
    Key: string,
    body: StreamingBlobPayloadInputTypes,
    ContentType: string,
  ) => {
    const Body =
      typeof body === "string" ? new TextEncoder().encode(body) : body;
    await s3Client?.send(
      new PutObjectCommand({ Body, Bucket, ContentType, Key }),
    );
  };
