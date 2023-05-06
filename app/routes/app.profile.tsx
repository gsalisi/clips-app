import type { LoaderArgs, V2_MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { requireUser } from "~/session.server";

export const meta: V2_MetaFunction = () => [{ title: "PopCrop - Profile" }];

export const loader = async ({ request }: LoaderArgs) => {
  const user = await requireUser(request);

  return json({ user });
};

export default function ProfilePage() {
    const data = useLoaderData<typeof loader>();
    return (
      <div className="flex w-full justify-center bg-gray-50">
        <div className="h-full w-full max-w-lg bg-gray-50">
          <div className="prose justify-between py-4">
            <h2 className="text-slate">
              Profile
            </h2>
            <p className="label-text">Email: {data.user.email}</p>
            <p className="label-text">Credits Available: {data.user.credits}</p>
          </div>
          <div className="divider"></div>
          <Form action="/logout" method="post">
            <button className="btn btn-error w-full">
                Logout
            </button>
          </Form>
        </div>
      </div>
    );
  }
  