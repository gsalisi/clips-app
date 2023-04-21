import { json, LoaderArgs, V2_MetaFunction } from "@remix-run/node";
import { Outlet, useLoaderData, useLocation } from "@remix-run/react";
import { requireUserId } from "~/session.server";
import invariant from "tiny-invariant";
import { getProject } from "~/models/project.server";
import classNames from "classnames";

export const meta: V2_MetaFunction = () => [{ title: "Clips App" }];

export const loader = async ({ params, request }: LoaderArgs) => {
  const userId = await requireUserId(request);
  invariant(params.projectId, "projectId not found");

  const project = await getProject({ id: params.projectId, userId });
  if (!project) {
    throw json({ error: "Not Found" }, { status: 404 });
  }
  return json({ project });
};

export default function ProjectPage(props: { "": any; }) {
  const data = useLoaderData<typeof loader>();
  const location = useLocation();
  
  let didUpload = true, didOptions, didPreview = false
  if (location.pathname.endsWith("preview")) {
    didUpload = true;
    didOptions = true;
    didPreview = true
  } else if (location.pathname.endsWith("options")) {
    didUpload = true;
    didOptions = true;
  }
  
  return (
    <div className="flex justify-center h-full w-full bg-gray-50">
      <div className="flex-row justify-center h-full w-full max-w-xl p-6">
        <h2 className="text-2xl font-bold my-2 indent-1">{data.project.title}</h2>
        <div className="divider"></div>
        <ul className="steps w-full">
          <li className={classNames("step", { "step-primary": didUpload })}>Upload Clip</li>
          <li className={classNames("step", { "step-primary": didOptions })}>Edit Options</li>
          <li className={classNames("step", { "step-primary": didPreview })}>Preview</li>
        </ul>
        <div>
          <Outlet/>
        </div>
      </div>
    </div>
  );
}
