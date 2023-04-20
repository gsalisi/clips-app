import {
  json,
  LoaderArgs,
  V2_MetaFunction,
} from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { requireUserId } from "~/session.server";
import invariant from "tiny-invariant";
import { getProject, Project, updateProject } from "~/models/project.server";

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

const fetchOutputUrl = async (project: Project) => {
  if (!project.outputFile) {
    return;
  }
  const outputFile = project.outputFile;
  const params = new URLSearchParams({
    key: outputFile.key,
    bucket: outputFile.bucket,
  });
  const response = await fetch(`/s3/getobjecturl?${params.toString()}`);
  const body = await response.json();
  if (!response.ok) {
    throw body
  }
  return body.signedUrl;
};

export default function ProjectPreview() {
  const data = useLoaderData<typeof loader>();
  const [outputUrl, setOutputUrl] = useState<string>("");
  const [outputPollInterval, setOutputPollInterval] = useState<NodeJS.Timer>();

  useEffect(() => {
    if (outputPollInterval) {
      clearInterval(outputPollInterval);
    }

    const interval = setInterval(() => {
      fetchOutputUrl(data.project).then((url) => {
        setOutputUrl(url);
        clearInterval(interval);
      });
    }, 2000);

    setOutputPollInterval(interval);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-full w-full max-w-xl flex-col items-center p-2">
      <div className="form-control w-full max-w-lg">
        <label className="label">
          <span className="label-text">{"Output Preview"}</span>
        </label>
        {outputUrl && (
          <div className="w-full max-w-lg">
            <div className="flex flex-col">
              <video className="max-h-96 max-w-lg" controls>
                <source src={outputUrl} />
              </video>
            </div>
          </div>
        )}
        {!outputUrl && (
          <progress className="progress w-56"></progress>
        )}
      </div>
    </div>
  );
}
