import type { V2_MetaFunction } from "@remix-run/node";
import { Form, Link, Outlet } from "@remix-run/react";
import { useOptionalUser } from "~/utils";
import { UserIcon } from '@heroicons/react/24/solid';

export const meta: V2_MetaFunction = () => [{ title: "Clips App" }];

export default function IndexPage() {
  const user = useOptionalUser();

  return (
    <div className="flex h-full min-h-screen flex-col">
      <header className="flex items-center justify-stretch bg-slate-800 p-4 text-white">
        <h1 className="flex-1 text-3xl font-bold">
          <Link to=".">Clips</Link>
        </h1>
        <div className="full-width flex justify-end space-x-2">
            {user && (
                <div className="flex items-center">
                    <p>{user.email}</p>
                </div>
            )}
            {!user && (
            <Link
                to="/app/login"
                className="flex items-center justify-center rounded-md bg-red-500 mx-2 px-4 py-3 font-medium text-white hover:bg-red-600"
            >
                Log In
            </Link>
            
            )}
            {!user && (
                <Link
                    to="/app/join"
                    className="flex items-center justify-center rounded-md bg-red-500 px-4 py-3 font-medium text-white hover:bg-red-600"
                    >
                    Sign Up
                </Link>
            )}
            {user && (
            <Form action="/logout" method="post">
                <button
                type="submit"
                className="rounded-full bg-slate-600 px-2 py-2 text-blue-100 hover:bg-blue-500 active:bg-blue-600"
                >
                <UserIcon className="h-4 w-4 text-white" title={user.email}/>
                </button>
            </Form>
            )}
        </div>
      </header>
      <main className="flex h-full bg-white">
        <Outlet/>
      </main>
    </div>
  );
}
