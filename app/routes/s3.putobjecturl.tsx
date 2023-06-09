import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import AWS from "aws-sdk";
import { requireUserId } from "~/session.server";


const CLIPS_S3_BUCKET_NAME = "clips-store-5a1a17e"
const CLIPS_S3_UPLOAD_PATH = "tmp"

export async function loader({ request }: LoaderArgs) {
    const userId = await requireUserId(request);
    const url = new URL(request.url)
    const objectName = url.searchParams.get('objectName')
    const contentType = url.searchParams.get('contentType')
    const projectId = url.searchParams.get('path')

    // Get signed URL from S3
    const s3Params = {
        Bucket: CLIPS_S3_BUCKET_NAME,
        Key: `${CLIPS_S3_UPLOAD_PATH}/${userId}/${projectId}/${objectName}`,
        Expires: 300,
        ContentType: contentType,
        ACL: 'private'
    }
    // console.log('Params: ', s3Params)
    const s3 = new AWS.S3()
    const uploadURL = await s3.getSignedUrlPromise('putObject', s3Params)

    return json({
        signedUrl: uploadURL,
        bucket: s3Params.Bucket,
        key: s3Params.Key,
        contentType: s3Params.ContentType,
    })
}