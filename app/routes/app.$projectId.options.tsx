import { ActionArgs, json, LoaderArgs, redirect, V2_MetaFunction } from "@remix-run/node";
import ReactS3Uploader from "react-s3-uploader";
import { Form, useFetcher, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { requireUserId } from "~/session.server";
import invariant from "tiny-invariant";
import { EffectMetadata, getProject, updateProject } from "~/models/project.server";
import { getS3KeyFileName, sendSqsMessage } from "~/sqs.server";

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

  const formData = await request.formData();
  const type = formData.get("type");
  if (typeof type !== "string" ) {
    return json(
      { errors: { body: null, title: "type is required" } },
      { status: 400 }
    );
  }

  const project = await getProject({ id: params.projectId, userId });
  if (!project) {
    throw new Response("Not Found", { status: 404 });
  }

  if (type === "crop") {
    const effectMetadata: EffectMetadata = {
      type: "single_crop",
      attributes: {
        size: project.size,
        excludeLimbs: true,
        paddingRatio: 1.2,
        smoothingWindowSecs: 2,
      }
    }
    
    const updatedProject = await updateProject({
      id: params.projectId,
      userId,
      effectMetadata,
    });
  
    if (!updatedProject.inputFile || !updatedProject.outputFile) {
      throw new Response("Missing inputFile and outputFile fields in project", { status: 400 });
    }
    if (!updatedProject.effectMetadata) {
      throw new Response("Missing effectMetadata field in project", { status: 400 });
    }
  
    const response = await sendSqsMessage({
      type: "crop",
      input_key: updatedProject.inputFile.key,
      output_key: updatedProject.outputFile.key,
      bucket: updatedProject.inputFile.bucket,
      output_width: updatedProject.effectMetadata.attributes.size.width,
      output_height: updatedProject.effectMetadata.attributes.size.height,
      exclude_limbs: updatedProject.effectMetadata.attributes.excludeLimbs,
      padding_ratio: updatedProject.effectMetadata.attributes.paddingRatio,
      smoothing_window_secs: updatedProject.effectMetadata.attributes.smoothingWindowSecs
    })
  
    console.log("SQS Response:")
    console.log(response)
    return redirect(`/app/${params.projectId}/preview`);
  } else if (type === "track") {
    if (!project.inputFile) {
      return json(
        { errors: { body: null, title: "inputFile field from project is required" } },
        { status: 500 }
      );
    }
    const tracksDir = `tmp/${userId}/${params.projectId}/tracks`
    const trackOutputDest = `${tracksDir}/${getS3KeyFileName(project.inputFile.key)}__tracks.json`;
    const response = await sendSqsMessage({
      type: "track",
      bucket: project.inputFile.bucket,
      input_key: project.inputFile.key,
      track_dest: trackOutputDest,
      track_preview_dir: tracksDir,
    })
    console.log("SQS Response:")
    console.log(response)
    return redirect(request.headers.get("Referer") || "?")
  }
  
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
        {selectedEffect === allEffects[1] &&
          <Form method="post">
            <input type="hidden" name="type" value="track" />
            <button className="btn-primary btn my-1">Run Tracker</button>
          </Form>
        }
        <Form method="post">
          <input type="hidden" name="type" value="crop" />
          <button className="btn-primary btn my-1">Next</button>
        </Form>
      </div>
    </div>
  );
}
