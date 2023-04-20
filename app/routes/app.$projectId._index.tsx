import type {
  LoaderArgs,
  V2_MetaFunction,
} from "@remix-run/node";
import { redirect } from "@remix-run/node";
import invariant from "tiny-invariant";

export const meta: V2_MetaFunction = () => [{ title: "Clips App" }];

export const loader = async ({ params }: LoaderArgs) => {
  invariant(params.projectId, "projectId not found");
  return redirect(`/app/${params.projectId}/upload`)
}