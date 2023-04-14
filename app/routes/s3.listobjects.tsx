import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import AWS from "aws-sdk";
import { requireUserId } from "~/session.server";
// import { v4 as uuidv4 } from 'uuid';


const CLIPS_S3_BUCKET_NAME = "clips-store-5a1a17e"
const CLIPS_S3_UPLOAD_PATH = "cropper_out"

export async function loader({ request }: LoaderArgs) {
    const userId = await requireUserId(request, '/');

    // Get signed URL from S3
    const params = {
        Bucket: CLIPS_S3_BUCKET_NAME,
        Prefix: `${CLIPS_S3_UPLOAD_PATH}/${userId}/`,
    }
    // console.log('Params: ', params)
    const s3 = new AWS.S3()
    const objects = await s3.listObjectsV2(params).promise()
    // console.log(objects)

    return json({
        objects
    })
}