import { json } from "@remix-run/node";
import AWS from "aws-sdk";


export async function signGetObjectUrl({ userId, bucket, key }: { userId: string, bucket: string, key: string }) {
    // const url = new URL(request.url)
    // const bucket = url.searchParams.get('bucket')
    // const key = url.searchParams.get('key')

    if (!bucket || !key) {
        throw json({ error: "Missing key or bucket" }, { status: 422 })
    }
    if (!(key?.startsWith(`tmp/${userId}`) || key?.startsWith(`cropper_out/${userId}`))) {
        throw json({ error: "S3 path not accessible by user" }, { status : 403 })
    }

    const s3Params = {
        Bucket: bucket,
        Key: key,
        Expires: 300,
    }
    const s3 = new AWS.S3()
    try {
        await s3.headObject({ Bucket: bucket, Key: key }).promise();
    } catch (e) {
        throw json({ error: "S3 path does not exist" }, { status: 404 })
    }
    
    const getObjUrl = await s3.getSignedUrlPromise('getObject', s3Params)
    return json({
        signedUrl: getObjUrl,
        bucket: s3Params.Bucket,
        key: s3Params.Key,
    })
}