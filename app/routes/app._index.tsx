import {
  V2_MetaFunction,
  LoaderArgs,
  ActionArgs,
  redirect,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, NavLink, useLoaderData, useSubmit } from "@remix-run/react";
import invariant from "tiny-invariant";

import {
  deleteProject,
  getProjectListItems,
  ProjectState,
} from "~/models/project.server";
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
  const submit = useSubmit();
  // const user = useUser();
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
    }
  };

  const deleteProject = (id: string) => {
    const formData = new FormData();
    formData.append("projectId", id);
    submit(formData, {
      method: "post",
    });
  }
  return (
    <div className="flex w-full justify-center bg-gray-50">
      <div className="h-full w-full max-w-lg bg-gray-50">
        <div className="flex justify-between py-4">
          <h2 className="text-slate mx-4 my-auto text-xl font-bold">
            Projects
          </h2>
          <Link to="new" className="mx-4 block">
            <button className="btn-primary btn-sm btn">
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
                  d="M12 4.5v15m7.5-7.5h-15"
                />
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
                  className="block flex items-center justify-between border-b border-gray-200 p-4"
                  to={project.id}
                >
                  <div className="flex items-center">
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
                    <span className="text-med font-bold text-neutral">
                      {`${project.title}`}
                    </span>
                  </div>

                  <div className="flex items-center">
                    <span className="pr-4 text-sm text-neutral">
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
