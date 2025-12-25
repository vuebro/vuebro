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
const credential = useStorage("s3", defaults, localStorage, {
    mergeDefaults,
  }),
  getObject = async (
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
        return new Response();
      }
    return new Response();
  };

export const setS3Client = (value?: S3Client) => {
  s3Client?.destroy();
  s3Client = value;
};
export const deleteObject = async (Bucket: string, Key: string) => {
    await s3Client?.send(new DeleteObjectCommand({ Bucket, Key }));
  },
  getObjectBlob = async (
    Bucket: string,
    Key: string,
    ResponseCacheControl?: string,
  ) => (await getObject(Bucket, Key, ResponseCacheControl)).blob(),
  getObjectText = async (
    Bucket: string,
    Key: string,
    ResponseCacheControl?: string,
  ) => (await getObject(Bucket, Key, ResponseCacheControl)).text(),
  headBucket = async (Bucket: string, pin: string | undefined) => {
    let { accessKeyId, endpoint, region, secretAccessKey } =
      credential.value[Bucket] ?? {};
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
      throw new Error(err as string);
    }
  },
  headObject = async (
    Bucket: string,
    Key: string,
    ResponseCacheControl?: string,
  ) =>
    s3Client?.send(
      new HeadObjectCommand({ Bucket, Key, ResponseCacheControl }),
    ),
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
  },
  removeEmptyDirectories = undefined;
