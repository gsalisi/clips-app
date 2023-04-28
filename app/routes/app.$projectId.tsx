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
  
  return (
    <div className="flex justify-center w-full bg-gray-50">
      <div className="flex justify-center w-full max-w-xl p-6">
        {/* <h2 className="text-2xl font-bold my-2 indent-1">{data.project.title}</h2>
        <div className="divider"></div> */}
        <Outlet/>
      </div>
    </div>
  );
}
