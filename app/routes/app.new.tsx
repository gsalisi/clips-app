import type { V2_MetaFunction, ActionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { requireUserId } from "~/session.server";
import type { Size } from "~/models/project.server";
import { createProject } from "~/models/project.server";
import { Form, useActionData } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import classNames from "classnames";

export const meta: V2_MetaFunction = () => [{ title: "PopCrop - New Project" }];

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
      width: 1080,
      height: 1920,
    },
    [AspectRatio.Portrait]: {
      width: 1080,
      height: 1440,
    },
    [AspectRatio.Box]: {
      width: 1080,
      height: 1080,
    },
  };

  const aspectRatioStr = formData.get("aspectRatio");
  const size: Size = sizes[aspectRatioStr as AspectRatio];

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
    setAspectRatio(event.currentTarget.value as AspectRatio);
  };

  return (
    <div className="flex h-full w-full justify-center bg-gray-50">
      <div className="prose h-full w-full max-w-lg py-2">
        <h2 className="m-2">👋 Create a new project</h2>
        <Form method="post" className="form-control space-y-2 p-2">
          <div>
            <label className="label">
              <span className="label-text font-bold">Project Title</span>
            </label>
            <input
              ref={titleRef}
              type="text"
              name="title"
              placeholder="My awesome project"
              className={classNames("max-w-s input w-full", {
                "input-error": !!actionData?.errors?.title,
              })}
              aria-invalid={actionData?.errors?.title ? true : undefined}
              autoFocus
            />
          </div>
          <div>
            <label className="label">
                <span className="label-text font-bold">Aspect Ratio</span>
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
                9:16 - 1080x1920 - For TikTok / Reels
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
                <span className="m label-text">3:4 - 1080x1440 - Portrait</span>
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
                <span className="m label-text">1:1 - 1080x1080 - Box</span>
            </label>
          </div>
          <div className="rounded-md border-2 border-sky-600/10 bg-sky-500/10">
            <p className="m-4">⚠️ All projects are deleted after 24 hours. </p>
          </div>

          <button type="submit" className="btn-primary btn my-1">
            Create Project
          </button>
          <button onClick={() => history.back()} className="btn my-1">
            Cancel
          </button>
        </Form>
      </div>
    </div>
  );
}
