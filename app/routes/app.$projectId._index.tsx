import type { V2_MetaFunction } from "@remix-run/node";
import ReactS3Uploader from "react-s3-uploader";
import { useFetcher } from "@remix-run/react";
import { useState } from "react";

export const meta: V2_MetaFunction = () => [{ title: "Clips App" }];

export default function ProjectPage() {
  const uploadedObjUrlFetcher = useFetcher();
  const [inputComp, setInputComp] = useState<HTMLInputElement>();

  const onUploadFinish = (res: any, file: any) => {
    console.log(res, file);
    const params = new URLSearchParams({
      key: res.key,
      bucket: res.bucket,
    });
    uploadedObjUrlFetcher.data = undefined;
    uploadedObjUrlFetcher.load(`/s3/getobjecturl?${params.toString()}`);
    if (inputComp) {
      inputComp.disabled = true
    }
  };

  return (
    <div className="flex h-full w-full max-w-xl flex-col items-center p-2">
      <div className="w-full max-w-lg">
        <label className="label">
          <span className="label-text">{"Accepts video files < 5GB"}</span>
        </label>
        <ReactS3Uploader
          className="file-input w-full max-w-lg"
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
      {uploadedObjUrlFetcher.data && (
        <div className="w-full max-w-lg">
          <label className="label">
            <span className="label-text">{"Input Preview"}</span>
          </label>
          <div className="flex flex-col items-center">
            <video className="max-w-lg max-h-96" controls>
              <source src={uploadedObjUrlFetcher.data.signedUrl} />
            </video>
          </div>
        </div>
      )}
    </div>
  );
}
