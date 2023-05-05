import type { V2_MetaFunction } from "@remix-run/node";
import { Form, Link, Outlet, useSubmit } from "@remix-run/react";
import { useOptionalUser } from "~/utils";
import { UserIcon } from "@heroicons/react/24/solid";

export const meta: V2_MetaFunction = () => [{ title: "PopCrop" }];

export default function IndexPage() {
  const user = useOptionalUser();
  return (
    <div className="flex h-full min-h-screen flex-col">
      <header className="bg-grey-800 w-full p-4 text-white">
        <div className="m-auto flex h-full w-full max-w-lg items-center justify-stretch">
          <Link className="prose flex-1" to="/app">
            <div
              className="h-12 w-12"
              style={{
                backgroundImage: "url(/_static/popcrop-icon.png)",
                backgroundSize: "cover",
              }}
            ></div>
          </Link>
          <div className="full-width flex justify-end space-x-2">
            {!user && (
              <Link
                to="/app/login"
                className="mx-2 flex items-center justify-center rounded-md bg-red-500 px-4 py-3 font-medium text-white hover:bg-red-600"
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
              <>
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
                <Link to="profile">
                    <button className="rounded-full bg-slate-600 px-2 py-2 text-blue-100 hover:bg-blue-500 active:bg-blue-600">
                        <UserIcon
                            className="h-4 w-4 text-white"
                            title={user.email}
                        />
                    </button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex min-h-full bg-white">
        <Outlet />
      </main>
      {/* <footer className="footer items-center bg-neutral p-4 text-neutral-content">
        <div className="grid-flow-col items-center">
          <p>All rights reserved - gsalisi.dev</p>
        </div>
        {/* <div className="grid-flow-col gap-4 md:place-self-center md:justify-self-end">
        <a><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="fill-current"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"></path></svg>
        </a> 
        <a><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="fill-current"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"></path></svg></a>
        <a><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="fill-current"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"></path></svg></a>
    </div> 
      </footer> */}
    </div>
  );
}
