import { ActionArgs, json, LoaderArgs, redirect, V2_MetaFunction } from "@remix-run/node";
import ReactS3Uploader from "react-s3-uploader";
import { Form, useFetcher, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { requireUserId } from "~/session.server";
import invariant from "tiny-invariant";
import { getProject, updateProject } from "~/models/project.server";
import { sendSqsMessage } from "~/sqs.server";

export const meta: V2_MetaFunction = () => [{ title: "Clips App" }];

export const loader = async ({ params, request }: LoaderArgs) => {
  const userId = await requireUserId(request);
  invariant(params.projectId, "projectId not found");

  const project = await getProject({ id: params.projectId, userId });
  if (!project) {
    throw new Response("Not Found", { status: 404 });
  }
  return json({ project });
};

export const action = async ({ params, request }: ActionArgs) => {
  const userId = await requireUserId(request);
  invariant(params.projectId, "projectId not found");

  const project = await getProject({ id: params.projectId, userId });
  if (!project) {
    throw new Response("Not Found", { status: 404 });
  }
  const response = await sendSqsMessage({
    key: project.inputFile.key,
    bucket: project.inputFile.bucket,
    output_width: project.size.width,
    output_height: project.size.height,
  })

  console.log("SQS Response:")
  console.log(response)
  return redirect("preview");
};


export default function ProjectOptions() {
  // const data = useLoaderData<typeof loader>();
  const allEffects = ["Single Person Crop", "Multi-Person Crop"]
  const [selectedEffect, setSelectedEffect] = useState<string>(allEffects[0]);
  const onEffectChange: React.ChangeEventHandler<HTMLSelectElement> = (event) => {
    setSelectedEffect(event.target.value as string)
  }

  return (
    <div className="flex h-full w-full max-w-xl flex-col items-center p-2">
      <div className="form-control w-full max-w-lg">
        <label className="label">
          <span className="label-text">{"Select Effect Type"}</span>
        </label>
        <select className="select select-bordered" onChange={onEffectChange} value={selectedEffect}>
          {allEffects.map((eff) => <option key={eff} value={eff}>{eff}</option>)}
        </select>
        <Form method="post">
          <button className="btn-primary btn my-1" disabled={selectedEffect !== allEffects[0]}>Next</button>
        </Form>
      </div>
    </div>
  );
}
