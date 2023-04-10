import ReactS3Uploader from "react-s3-uploader";
import { Form, Link, useFetcher } from "@remix-run/react";
import { useUser } from "~/utils";
import { useState } from "react";

export default function UploadIndexPage() {
  const getObjectUrl = useFetcher();
  const sqsAction = useFetcher();
  const user = useUser();
  const [inputComp, setInputComp] = useState<HTMLInputElement>();

  const onUploadFinish = (res: any, file: any) => {
    console.log(res, file);
    const params = new URLSearchParams({
      key: res.key,
      bucket: res.bucket,
    });
    getObjectUrl.data = undefined;
    getObjectUrl.load(`/s3/getobjecturl?${params.toString()}`);
    if (inputComp) {
      inputComp.value = "";
    }
    sqsAction.submit({ key: res.key, bucket: res.bucket }, { method: "post", action: "/sqs/cropper"})
  };

  return (
    <div className="flex h-full min-h-screen flex-col">
      <header className="flex items-center justify-between bg-slate-800 p-4 text-white">
        <h1 className="text-3xl font-bold">
          <Link to=".">Uploader</Link>
        </h1>
        <p>{user.email}</p>
        <Form action="/logout" method="post">
          <button
            type="submit"
            className="rounded bg-slate-600 px-4 py-2 text-blue-100 hover:bg-blue-500 active:bg-blue-600"
          >
            Logout
          </button>
        </Form>
      </header>

      <main className="flex h-full bg-white">
        <div className="h-full w-80 border-r bg-gray-50">
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

          <hr />
        </div>

        <div className="flex-1 p-6">
          {getObjectUrl.state === "idle" && getObjectUrl.data && (
            <video width="320" height="240" controls>
              <source src={getObjectUrl.data.signedUrl} />
            </video>
          )}
        </div>
      </main>
    </div>
  );
}
