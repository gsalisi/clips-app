import type { V2_MetaFunction } from "@remix-run/node";
import ReactS3Uploader from "react-s3-uploader";
import { useFetcher } from "@remix-run/react";
import { useOptionalUser } from "~/utils";
import { useEffect, useState } from "react";

export const meta: V2_MetaFunction = () => [{ title: "Clips App" }];

export default function ProjectsPage() {
  const listObjectsFetcher = useFetcher();
  const uploadedObjUrlFetcher = useFetcher();
  const sqsAction = useFetcher();
  const user = useOptionalUser();
  const [inputComp, setInputComp] = useState<HTMLInputElement>();
  const [previewUrl, setPreviewUrl] = useState<string>();

  const getObjectUrl = async (bucket: string, key: string) => {
    const params = new URLSearchParams({
      key,
      bucket,
    });
    const res = await fetch(`/s3/getobjecturl?${params.toString()}`);
    const resJson = await res.json();
    return resJson.signedUrl;
  };

  const downloadObject = async (bucket: string, key: string) => {
    const signedUrl = await getObjectUrl(bucket, key);
    window.open(signedUrl, "_blank");
  };

  const onUploadFinish = (res: any, file: any) => {
    console.log(res, file);
    const params = new URLSearchParams({
      key: res.key,
      bucket: res.bucket,
    });
    uploadedObjUrlFetcher.data = undefined;
    uploadedObjUrlFetcher.load(`/s3/getobjecturl?${params.toString()}`);
    if (inputComp) {
      inputComp.value = "";
    }
    sqsAction.submit(
      { key: res.key, bucket: res.bucket },
      { method: "post", action: "/sqs/cropper" }
    );
  };

  const listObjects = () => {
    listObjectsFetcher.load("/s3/listobjects");
  };

  useEffect(() => {
    if (user) {
      listObjects()
    }
  }, [])

  return (
    <div className="flex-1 p-6">
      <div className="p-2">
        <ReactS3Uploader
          signingUrl="/s3/putobjecturl"
          signingUrlMethod="GET"
          s3path="tmp/"
          // preprocess={this.onUploadStart}
          // onSignedUrl={onSignedUrl}
          // onProgress={this.onUploadProgress}
          // onError={this.onUploadError}
          onFinish={onUploadFinish}
          // signingUrlHeaders={{ additional: headers }}
          // signingUrlQueryParams={{ additional: query-params }}
          signingUrlWithCredentials={true} // in case when need to pass authentication credentials via CORS
          uploadRequestHeaders={{ "x-amz-acl": "private" }}
          contentDisposition="auto"
          scrubFilename={(filename: string) =>
            filename.replace(/[^\w\d_\-.]+/gi, "")
          }
          inputRef={(cmp) => setInputComp(cmp)}
          autoUpload={true}
        />
      </div>
      {uploadedObjUrlFetcher.state === "idle" &&
        uploadedObjUrlFetcher.data && (
          <div className="p-6">
            <h1>Input Preview</h1>
            <video width="320" height="240" controls>
              <source src={uploadedObjUrlFetcher.data.signedUrl} />
            </video>
          </div>
          
        )}
      <button
        onClick={listObjects}
        className="bg-gray-100 hover:bg-gray-500 rounded-md p-2 font-medium text-black"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-4 w-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
          />
        </svg>
      </button>
      <ul className="list-disc px-6">
        {listObjectsFetcher.data &&
          listObjectsFetcher.data.objects.Contents.map((content: any) => (
            <li key={content.ETag}>
              <button
                className="mx-1 rounded-sm bg-gray-100 p-2 text-black hover:bg-gray-200"
                onClick={() =>
                  downloadObject(
                    listObjectsFetcher.data.objects.Name,
                    content.Key
                  )
                }
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
              </button>
              <button
                className="mx-1 rounded-sm bg-gray-100 p-2 text-black hover:bg-gray-200"
                onClick={() =>
                  getObjectUrl(
                    listObjectsFetcher.data.objects.Name,
                    content.Key
                  ).then((url) => setPreviewUrl(url))
                }
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
              {content.Key}
            </li>
          ))}
      </ul>
      {previewUrl && (
          <div className="p-6">
            <h1>Output Preview</h1>
            <video width="320" height="240" controls>
              <source src={previewUrl} />
            </video>
          </div>
        )}
    </div>
  );
}
