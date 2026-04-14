import { Context } from "hono";
import {
    S3Client,
    ListObjectsV2Command,
    GetObjectCommand,
    PutObjectCommand,
    DeleteObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const isS3Enabled = (c: Context<HonoCustomType>) => {
    return !(!c.env.S3_ENDPOINT ||
        !c.env.S3_ACCESS_KEY_ID ||
        !c.env.S3_SECRET_ACCESS_KEY ||
        !c.env.S3_BUCKET);
}

const getS3Client = (c: Context<HonoCustomType>) => {
    if (
        !c.env.S3_ENDPOINT ||
        !c.env.S3_ACCESS_KEY_ID ||
        !c.env.S3_SECRET_ACCESS_KEY ||
        !c.env.S3_BUCKET
    ) {
        throw new Error("S3 config is not set");
    }
    return new S3Client({
        region: "auto",
        endpoint: c.env.S3_ENDPOINT,
        credentials: {
            accessKeyId: c.env.S3_ACCESS_KEY_ID,
            secretAccessKey: c.env.S3_SECRET_ACCESS_KEY,
        },
    });
}

export default {
    getSignedGetUrl: async (c: Context<HonoCustomType>) => {
        const { address } = c.get("jwtPayload")
        const { key } = await c.req.json()
        const client = getS3Client(c);
        const url = await getSignedUrl(
            client,
            new GetObjectCommand({
                Bucket: c.env.S3_BUCKET,
                Key: `${address}/${key}`
            }),
            { expiresIn: c.env.S3_URL_EXPIRES || 360 }
        );
        return c.json({ url });
    },
    getSignedPutUrl: async (c: Context<HonoCustomType>) => {
        const { address } = c.get("jwtPayload")
        const { key } = await c.req.json()
        const client = getS3Client(c);
        const url = await getSignedUrl(
            client,
            new PutObjectCommand({
                Bucket: c.env.S3_BUCKET,
                Key: `${address}/${key}`
            }),
            { expiresIn: c.env.S3_URL_EXPIRES || 360 }
        );
        return c.json({ url });
    },
    list: async (c: Context<HonoCustomType>) => {
        const { address } = c.get("jwtPayload")
        const client = getS3Client(c);
        const data = await client.send(
            new ListObjectsV2Command({
                Bucket: c.env.S3_BUCKET,
                Prefix: `${address}/`
            })
        );
        return c.json(
            {
                results: data?.Contents
                    ?.map((v) => v.Key?.replace(`${address}/`, ""))
                    ?.filter(k => k)
                    ?.map((k) => ({ key: k }))
            }
        );
    },
    deleteKey: async (c: Context<HonoCustomType>) => {
        const { address } = c.get("jwtPayload")
        const { key } = await c.req.json()
        const client = getS3Client(c);
        await client.send(
            new DeleteObjectCommand({
                Bucket: c.env.S3_BUCKET,
                Key: `${address}/${key}`
            })
        );
        return c.json({ success: true });
    }
}
