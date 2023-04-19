import type { V2_MetaFunction, ActionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { requireUserId } from "~/session.server";
import type { Size } from "~/models/project.server";
import { createProject } from "~/models/project.server";
import { Form, useActionData } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import classNames from "classnames";

export const meta: V2_MetaFunction = () => [{ title: "Clips - New Project" }];

enum AspectRatio {
  TallPortrait = "tall_portrait",
  Portrait = "portrait",
  Box = "box",
}

export const action = async ({ request }: ActionArgs) => {
  const userId = await requireUserId(request);

  const formData = await request.formData();
  const title = formData.get("title");

  if (typeof title !== "string" || title.length === 0) {
    return json(
      { errors: { body: null, title: "Title is required" } },
      { status: 400 }
    );
  }

  const sizes: { [key in AspectRatio]: Size } = {
    [AspectRatio.TallPortrait]: {
      width: 720,
      height: 1280,
    },
    [AspectRatio.Portrait]: {
      width: 720,
      height: 960,
    },
    [AspectRatio.Box]: {
      width: 720,
      height: 720,
    },
  };

  const aspectRatioStr = formData.get("aspectRatio");
  const size: Size =
    sizes[AspectRatio[aspectRatioStr as keyof typeof AspectRatio]];

  const project = await createProject({ size, title, userId });

  return redirect(`/app/${project.id}`);
};

export default function ProjectsPage() {
  const actionData = useActionData<typeof action>();
  const titleRef = useRef<HTMLInputElement>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
    AspectRatio.TallPortrait
  );

  useEffect(() => {
    if (actionData?.errors?.title) {
      titleRef.current?.focus();
    }
  }, [actionData]);

  const onAspectRatioChange: React.ChangeEventHandler<HTMLInputElement> = (
    event
  ) => {
    setAspectRatio(
      AspectRatio[event.currentTarget.value as keyof typeof AspectRatio]
    );
  };

  return (
    <div className="flex h-full w-full justify-center bg-gray-50">
      <div className="h-full w-full max-w-xl py-2">
        <Form method="post" className="form-control p-2">
          <label className="label">
            <span className="label-text" >Project Title</span>
          </label>
          <input
            ref={titleRef}
            type="text"
            name="title"
            placeholder="My awesome project"
            className={classNames("max-w-s input w-full", {"input-error": !!actionData?.errors?.title})}
            aria-invalid={actionData?.errors?.title ? true : undefined}
          />
          <label className="label">
            <span className="label-text">Aspect Ratio</span>
          </label>
          <label className="label cursor-pointer justify-normal space-x-2">
            <input
              type="radio"
              name="aspectRatio"
              className="radio checked:bg-blue-500"
              onChange={onAspectRatioChange}
              checked={aspectRatio === AspectRatio.TallPortrait}
              value={AspectRatio.TallPortrait}
            />
            <span className="label-text">
              9:16 - 720x1280 - Best for TikTok / Reels / Shorts
            </span>
          </label>
          <label className="label cursor-pointer justify-normal space-x-2">
            <input
              type="radio"
              name="aspectRatio"
              className="radio checked:bg-blue-500"
              onChange={onAspectRatioChange}
              checked={aspectRatio === AspectRatio.Portrait}
              value={AspectRatio.Portrait}
            />
            <span className="m label-text">3:4 - 720x960 - Portrait</span>
          </label>
          <label className="label cursor-pointer justify-normal space-x-2">
            <input
              type="radio"
              name="aspectRatio"
              className="radio checked:bg-blue-500"
              onChange={onAspectRatioChange}
              checked={aspectRatio === AspectRatio.Box}
              value={AspectRatio.Box}
            />
            <span className="m label-text">1:1 - 720x720 - Box</span>
          </label>
          <button type="submit" className="btn-primary btn my-1">Create Project</button>
          <button onClick={() => history.back()} className="btn-secondary btn my-1">Cancel</button>
        </Form>  
      </div>
    </div>
  );
}
