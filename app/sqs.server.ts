import AWS, { SQS } from "aws-sdk";
import { bool } from "aws-sdk/clients/signer";
import path from "node:path";

// This is in camel-case because this is consumed in the python code
type ClipsCorePayload = {
  type: "crop" | "track";
  bucket: string;
  input_key: string;
  output_key: string;
  output_width: number;
  output_height: number;
  padding_ratio: number;
  smoothing_window_secs: number;
  exclude_limbs: bool;
};

const QUEUE_URL = "https://sqs.us-west-2.amazonaws.com/872511653058/cropper_queue-a871fe0.fifo"

export const sendSqsMessage = async (
  payload: ClipsCorePayload
): Promise<SQS.SendMessageResult> => {
  for (let value of Object.values(payload)) {
    if (!value) {
      throw Error(`All parameters required. ${value} does not exist.`);
    }
  }
  const params = {
    MessageAttributes: {
      Action: {
        DataType: "String",
        StringValue: payload.type,
      },
    },
    MessageBody: JSON.stringify(payload),
    MessageDeduplicationId: payload.output_key, // Required for FIFO queues
    MessageGroupId: "Group1", // Required for FIFO queues
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
