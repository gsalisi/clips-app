import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import AWS from "aws-sdk";

const s3 = new AWS.S3()

export async function loader({ request }: LoaderArgs) {
    const randomID = Math.random() * 10000000
    const Key = `${randomID}.jpg`

    // Get signed URL from S3
    const s3Params = {
        Bucket: "iceborg-cold-store-dev",
        Key,
        Expires: 300,
        ContentType: 'image/jpeg',

        // This ACL makes the uploaded object publicly readable. You must also uncomment
        // the extra permission for the Lambda function in the SAM template.

        // ACL: 'public-read'
    }

    console.log('Params: ', s3Params)
    const uploadURL = await s3.getSignedUrlPromise('putObject', s3Params)

    return json({
        uploadURL: uploadURL,
        Key
    })
}