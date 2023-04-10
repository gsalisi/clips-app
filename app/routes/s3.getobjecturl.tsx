import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import AWS, { CognitoIdentityServiceProvider } from "aws-sdk";
import { requireUserId } from "~/session.server";
// import { v4 as uuidv4 } from 'uuid';

const s3 = new AWS.S3()
const CLIPS_S3_BUCKET_NAME = "clips-store-5a1a17e"
const CLIPS_S3_UPLOAD_PATH = "tmp"

export async function loader({ request }: LoaderArgs) {
    const userId = await requireUserId(request);
    const url = new URL(request.url)
    const bucket = url.searchParams.get('bucket')
    const key = url.searchParams.get('key')

    if (!key?.startsWith(`tmp/${userId}`)) {
        return json({ error: "S3 path not accessible by user", ok : false })
    }

    const s3Params = {
        Bucket: bucket,
        Key: key,
        Expires: 300,
    }
    const getObjUrl = await s3.getSignedUrlPromise('getObject', s3Params)

    return json({
        signedUrl: getObjUrl,
        bucket: s3Params.Bucket,
        key: s3Params.Key,
    })
}