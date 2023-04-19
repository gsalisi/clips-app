import AWS, { SQS } from "aws-sdk";
import path from "node:path";


type CropperMessage = {
    key: string,
    bucket: string,
    output_width: number,
    output_height: number,
}

export const sendSqsMessage = async ({
    key,
    bucket,
    output_width,
    output_height,
  }: CropperMessage): Promise<SQS.SendMessageResult> => {
  const sqs = new AWS.SQS({ apiVersion: "2012-11-05" });

  if (!key || !bucket || !output_height || !output_width) {
    throw Error(`All parameters required: ${key}, ${bucket}, ${output_width}, ${output_height}`)
  }
  const payload = {
    key,
    bucket,
    output_width,
    output_height,
  };

  // track_file?
  // track_ids?
  const params = {
    // Remove DelaySeconds parameter and value for FIFO queues
    MessageAttributes: {
      Action: {
        DataType: "String",
        StringValue: "crop",
      },
    },
    MessageBody: JSON.stringify(payload),
    MessageDeduplicationId: key, // Required for FIFO queues
    MessageGroupId: "Group1", // Required for FIFO queues
    QueueUrl:
      "https://sqs.us-west-2.amazonaws.com/872511653058/cropper_queue-a871fe0.fifo",
  };

  const sendMessagePromise: Promise<SQS.SendMessageResult> = new Promise(
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
  return sendMessagePromise;
};

export const getS3KeyFileName = (key: string): string => {
    return path.parse(key).name
}
