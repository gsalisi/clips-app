import AWS, { SQS } from "aws-sdk";
import { bool } from "aws-sdk/clients/signer";
import cuid from "cuid";
import path from "node:path";
import { TrackHint } from "./models/project.server";

// This is in camel-case because this is consumed in the python code
export type CropperSQSPayload = {
  type: "crop";
  env: "testing" | "staging" | "production";
  project_id: string;
  user_id: string;
  bucket: string;
  input_key: string;
  output_key: string;
  output_width: number;
  output_height: number;
  padding_ratio: number;
  smoothing_window_secs: number;
  exclude_limbs: bool;
  track_hints?: TrackHint[];
};

// type TrackerSQSPayload = {
//     type: "track";
//     bucket: string;
//     input_key: string;
//     track_dest: string;
//     track_preview_dir: string;
// };

const QUEUE_URL = "https://sqs.us-west-2.amazonaws.com/872511653058/cropper_queue-4f01062"

// TODO: Use explicit dedupe id for project ?
export const sendSqsMessage = async (
  payload: CropperSQSPayload
): Promise<SQS.SendMessageResult> => {
  // for (let [key, value] of Object.entries(payload)) {
  //   if (key !== "trackHints" && !value) {
  //     throw Error(`All parameters required. ${value} does not exist.`);
  //   }
  // }
  const body = JSON.stringify(payload)
  console.log(body)
  const params = {
    MessageAttributes: {
      Action: {
        DataType: "String",
        StringValue: payload.type,
      },
    },
    MessageBody: body,
    // MessageDeduplicationId: cuid(), // Required for FIFO queues
    // MessageGroupId: "Group1", // Required for FIFO queues
    QueueUrl: QUEUE_URL,
  };
  const sqs = new AWS.SQS({ apiVersion: "2012-11-05" });
  return new Promise(
    (resolve, reject) => {
      sqs.sendMessage(params, function (err, data) {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    }
  );
};

export const getS3KeyFileName = (key: string): string => {
  return path.parse(key).name;
};

export const getS3KeyExt = (key: string): string => {
  return path.parse(key).ext;
};
