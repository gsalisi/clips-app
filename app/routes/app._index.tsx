import type { V2_MetaFunction, LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, NavLink, useLoaderData } from "@remix-run/react";

import { getProjectListItems } from "~/models/project.server";
import { requireUserId } from "~/session.server";
import { useUser } from "~/utils";

export const meta: V2_MetaFunction = () => [{ title: "Clips App" }];

export const loader = async ({ request }: LoaderArgs) => {
  const userId = await requireUserId(request);
  const projectListItems = await getProjectListItems({ userId });
  return json({ projectListItems });
};


export default function ProjectsPage() {
  const data = useLoaderData<typeof loader>();
  // const user = useUser();

  return (
    <div className="flex h-full w-full justify-center">
      <div className="h-full w-full max-w-lg bg-gray-50">
          <Link to="new" className="block p-4 text-xl text-blue-500">
            + New Project
          </Link>

          <hr />

          {data.projectListItems.length === 0 ? (
            <p className="p-4">No projects yet</p>
          ) : (
            <ol>
              {data.projectListItems.map((project) => (
                <li key={project.id}>
                  <NavLink
                    className={({ isActive }) =>
                      `block border-b p-4 text-xl ${isActive ? "bg-white" : ""}`
                    }
                    to={project.id}
                  >
                    📝 {project.title}
                  </NavLink>
                </li>
              ))}
            </ol>
          )}
        </div>
    </div>
  );
}
