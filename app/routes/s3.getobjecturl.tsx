import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import AWS from "aws-sdk";
import { requireUserId } from "~/session.server";


export async function loader({ request }: LoaderArgs) {
    const userId = await requireUserId(request);
    const url = new URL(request.url)
    const bucket = url.searchParams.get('bucket')
    const key = url.searchParams.get('key')

    if (!(key?.startsWith(`tmp/${userId}`) || key?.startsWith(`cropper_out/${userId}`))) {
        return json({ error: { body: "S3 path not accessible by user" } , status : 403 })
    }

    const s3Params = {
        Bucket: bucket,
        Key: key,
        Expires: 300,
    }
    const s3 = new AWS.S3()
    const getObjUrl = await s3.getSignedUrlPromise('getObject', s3Params)

    return json({
        signedUrl: getObjUrl,
        bucket: s3Params.Bucket,
        key: s3Params.Key,
    })
}