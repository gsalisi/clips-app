// import { ActionArgs, json } from "@remix-run/node";
// import AWS from "aws-sdk";
// import { requireUserId } from "~/session.server";

// AWS.config.update({ region: "us-west-2" });

// export const action = async ({ request }: ActionArgs) => {
//     await requireUserId(request);
//     const sqs = new AWS.SQS({ apiVersion: "2012-11-05" });
//     const formData = await request.formData();
//     const key = formData.get("key")?.toString();
//     const bucket = formData.get("bucket")?.toString();
//     const output_width =
//         parseInt(formData.get("output_width")?.toString() || "0") || 720;
//     const output_height =
//         parseInt(formData.get("output_height")?.toString() || "0") || 1280;

//     if (!key || !bucket) {
//         return json({ error: "missing s3Uri form data", status: 400 });
//     }
//     const payload = {
//         key,
//         bucket,
//         output_width,
//         output_height,
//     };

//     // track_file?
//     // track_ids?
//     const params = {
//         // Remove DelaySeconds parameter and value for FIFO queues
//         MessageAttributes: {
//         Action: {
//             DataType: "String",
//             StringValue: "crop",
//         },
//         },
//         MessageBody: JSON.stringify(payload),
//         MessageDeduplicationId: key, // Required for FIFO queues
//         MessageGroupId: "Group1", // Required for FIFO queues
//         QueueUrl:
//         "https://sqs.us-west-2.amazonaws.com/872511653058/cropper_queue-a871fe0.fifo",
//     };

//     const sendMessagePromise = new Promise((resolve, reject) => {
//         sqs.sendMessage(params, function (err, data) {
//         if (err) {
//             reject(err);
//         } else {
//             resolve(data);
//         }
//         });
//     });
//     await sendMessagePromise;

//     return json({});
// };
