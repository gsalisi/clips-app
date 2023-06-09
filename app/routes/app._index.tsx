import {
  V2_MetaFunction,
  LoaderArgs,
  ActionArgs,
  redirect,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, NavLink, useLoaderData, useRevalidator, useSubmit } from "@remix-run/react";
import classNames from "classnames";
import { formatDistanceToNow } from "date-fns";
import { useEffect } from "react";

import {
  deleteProject,
  getProjectListItems,
  ProjectState,
} from "~/models/project.server";
import { requireUserId } from "~/session.server";

export const meta: V2_MetaFunction = () => [{ title: "PopCrop" }];

export const loader = async ({ request }: LoaderArgs) => {
  const userId = await requireUserId(request);
  const projectListItems = await getProjectListItems({ userId });
  return json({ projectListItems });
};

export const action = async ({ params, request }: ActionArgs) => {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const projectId = formData.get("projectId");
  if (typeof projectId !== "string" || projectId.length === 0) {
    return json(
      { errors: { } },
      { status: 500 }
    );
  }

  await deleteProject({ id: projectId, userId });

  return redirect("/app");
};

export default function ProjectsPage() {
  const data = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const submit = useSubmit();
  const projectStateToString = (state: ProjectState) => {
    switch (state) {
      case 0:
        return "Created";
      case 1:
        return "Ready";
      case 2:
        return "Processing";
      case 3:
        return "Completed";
      default:
        return "Error";
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      revalidator.revalidate()
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const deleteProject = (id: string) => {
    const formData = new FormData();
    formData.append("projectId", id);
    submit(formData, {
      method: "post",
    });
  }
  return (
    <div className="flex w-full h-full justify-center">
      <div className="h-full w-full max-w-lg">
        <div className="flex justify-between py-4">
          <h2 className="text-slate mx-4 my-auto text-xl font-bold">
            Projects
          </h2>
        </div>

        <hr />
        {data.projectListItems.length === 0 ? (
          <p className="p-4">No projects yet</p>
        ) : (
          <ol>
            {data.projectListItems.map((project, idx) => (
              <li key={project.id} className="bg-gray-100">
                <NavLink
                  className="block flex items-end justify-between border-b border-gray-200 p-4"
                  to={project.id}
                >
                  <div className="flex items-end">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="mr-1 h-4 w-4"
                    >
                      <path
                        strokeLinecap="round"
                        d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
                      />
                    </svg>
                    <span className="text-med font-bold text-neutral leading-none">
                      {`${project.title}`}
                    </span>
                    <span className="text-xs text-slate-500 leading-none mx-2">
                      {project.lastModifiedAt && `${formatDistanceToNow(new Date(project.lastModifiedAt * 1000))} ago`}
                    </span>
                  </div>

                  <div className="flex items-end">
                    <span className="relative flex h-2 w-2 mx-1 mb-1">
                      <span className={classNames("animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75", {
                        "bg-sky-400": project.state === 2,
                        "hidden": project.state !== 2
                      })}></span>
                      <span className={classNames("relative inline-flex rounded-full h-2 w-2", {
                        "bg-zinc-400": project.state < 2,
                        "bg-sky-400": project.state === 2,
                        "bg-green-400": project.state === 3,
                        "bg-red-400": project.state === 4,
                      })}></span>
                    </span>
                    <span className="pr-4 text-xs text-slate-500">
                   
                      {`${projectStateToString(project.state)}`}
                    </span>
                    <button onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      deleteProject(project.id)
                    }}>
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
                          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                        />
                      </svg>
                    </button>
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
