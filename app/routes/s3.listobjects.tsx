import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import AWS from "aws-sdk";
import { requireUserId } from "~/session.server";

const CLIPS_S3_BUCKET_NAME = "clips-store-5a1a17e"
const CLIPS_S3_UPLOAD_PATH = "cropper_out"

export async function loader({ request, params }: LoaderArgs) {
    const userId = await requireUserId(request, '/');

    // Get signed URL from S3
    const listObjParams = {
        Bucket: CLIPS_S3_BUCKET_NAME,
        Prefix: `${CLIPS_S3_UPLOAD_PATH}/${userId}/${params.projectId}/tracks`,
    }
    // console.log('Params: ', params)
    const s3 = new AWS.S3()
    const objects = await s3.listObjectsV2(listObjParams).promise()
    // console.log(objects)

    return json({
        objects
    })
}