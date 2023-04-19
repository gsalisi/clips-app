import {
  ActionArgs,
  json,
  LoaderArgs,
  redirect,
  V2_MetaFunction,
} from "@remix-run/node";
import ReactS3Uploader from "react-s3-uploader";
import { Form, useFetcher, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { requireUserId } from "~/session.server";
import invariant from "tiny-invariant";
import { getProject, S3Location, updateProject } from "~/models/project.server";
import { getS3KeyFileName } from "~/sqs.server";

export const meta: V2_MetaFunction = () => [{ title: "Clips App" }];

export const loader = async ({ params, request }: LoaderArgs) => {
  const userId = await requireUserId(request);
  invariant(params.projectId, "projectId not found");

  const project = await getProject({ id: params.projectId, userId });
  if (!project) {
    throw new Response("Not Found", { status: 404 });
  }

  if (project.inputFile) {
    return redirect(`app/${project.id}/preview`);
  }
  return json({ project });
};

export const action = async ({ params, request }: ActionArgs) => {
  const userId = await requireUserId(request);
  invariant(params.projectId, "projectId not found");

  const formData = await request.formData();
  const key = formData.get("key");
  const bucket = formData.get("bucket");
  if (typeof key !== "string" || key.length === 0) {
    return json(
      { errors: { body: null, title: "key is required" } },
      { status: 400 }
    );
  }
  if (typeof bucket !== "string" || bucket.length === 0) {
    return json(
      { errors: { body: null, title: "bucket is required" } },
      { status: 400 }
    );
  }
  const outputKey = `cropper_out/${userId}/${params.projectId}/${getS3KeyFileName(key)}.mp4`;

  await updateProject({
    id: params.projectId,
    userId,
    inputFile: {
      bucket,
      key,
    },
    outputFile: {
      bucket,
      key: outputKey,
    },
  });

  return redirect("options");
};

export default function ProjectPage() {
  const data = useLoaderData<typeof loader>();
  const uploadedObjUrlFetcher = useFetcher();
  const [inputComp, setInputComp] = useState<HTMLInputElement>();
  const [inputFile, setInputFile] = useState<S3Location>();

  const onUploadFinish = (res: any, file: any) => {
    console.log(res, file);
    const params = new URLSearchParams({
      key: res.key,
      bucket: res.bucket,
    });
    uploadedObjUrlFetcher.data = undefined;
    uploadedObjUrlFetcher.load(`/s3/getobjecturl?${params.toString()}`);
    if (inputComp) {
      inputComp.disabled = true;
    }
    setInputFile({
      key: res.key,
      bucket: res.bucket,
    });
  };

  return (
    <div className="flex h-full w-full max-w-xl flex-col items-center p-2">
      <div className="w-full max-w-lg">
        <h3 className="text-2xl font-bold">{data.project.title}</h3>
        <label className="label">
          <span className="label-text">{"Accepts video files < 5GB"}</span>
        </label>
        <ReactS3Uploader
          className="file-input w-full max-w-lg"
          signingUrl="/s3/putobjecturl"
          signingUrlMethod="GET"
          s3path={`${data.project.id}`}
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
          <div className="flex flex-col">
            <video className="max-h-96 max-w-lg" controls>
              <source src={uploadedObjUrlFetcher.data.signedUrl} />
            </video>
          </div>
          {inputFile && (
            <Form method="post">
              <input type="hidden" name="key" value={inputFile.key} />
              <input type="hidden" name="bucket" value={inputFile.bucket} />
              <button className="btn-primary btn my-1">Next</button>
            </Form>
          )}
        </div>
      )}
    </div>
  );
}
