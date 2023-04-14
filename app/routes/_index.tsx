import type { V2_MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";

export const meta: V2_MetaFunction = () => [{ title: "Clips App" }];

export async function loader() {
  return redirect("/app")
}