import {
  V2_MetaFunction,
  LoaderArgs,
  ActionArgs,
  redirect,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, NavLink, useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";

import { deleteProject, getProjectListItems, ProjectState } from "~/models/project.server";
import { requireUserId } from "~/session.server";
import { useUser } from "~/utils";

export const meta: V2_MetaFunction = () => [{ title: "Clips App" }];

export const loader = async ({ request }: LoaderArgs) => {
  const userId = await requireUserId(request);
  const projectListItems = await getProjectListItems({ userId });
  return json({ projectListItems });
};

export const action = async ({ params, request }: ActionArgs) => {
  const userId = await requireUserId(request);
  invariant(params.projectID, "projectID not found");

  await deleteProject({ id: params.projectID, userId });

  return redirect("/app");
};

export default function ProjectsPage() {
  const data = useLoaderData<typeof loader>();
  // const user = useUser();
  const projectStateToString = (state: ProjectState) => {
    switch(state) {
      case 0:
        return "Created"
      case 1:
        return "Ready"
      case 2:
        return "Processing"
      case 3:
        return "Completed"
    }
  }
  return (
    <div className="flex h-full w-full justify-center bg-gray-50">
      <div className="h-full w-full max-w-lg bg-gray-50">
        <div className="flex justify-between py-4">
          <h2 className="mx-4 text-xl font-bold text-slate my-auto">Projects</h2>
          <Link to="new" className="block mx-4">
            <button className="btn-primary btn-sm btn">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New
            </button>
          </Link>
        </div>
        
        <hr />
        {data.projectListItems.length === 0 ? (
          <p className="p-4">No projects yet</p>
        ) : (
          <ol>
            {data.projectListItems.map((project, idx) => (
              <li key={project.id} className="bg-gray-100">
                <NavLink
                  className="flex block border-b border-gray-200 p-4 justify-between items-center"
                  to={project.id}
                >
                  <span className="text-med text-neutral font-bold">
                   {`${idx+1}) ${project.title}`}
                  </span>
                  <div className="flex items-end">
                    <span className="text-sm text-neutral pr-4">
                      {`${projectStateToString(project.state)}`}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" />
                    </svg>
                  </div>
                 
                </NavLink>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
