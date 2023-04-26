import type { ActionArgs, LoaderArgs, V2_MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import ReactS3Uploader from "react-s3-uploader";
import { Form, useFetcher, useLoaderData, useRevalidator, useSubmit } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { requireUserId } from "~/session.server";
import invariant from "tiny-invariant";
import type { CropTrackerOpts, TrackHint } from "~/models/project.server";
import {
  addProjectTrackHints,
  getProject,
  ProjectState,
  updateCropTrackerOptsProject,
  updateProject,
  updateProjectState,
} from "~/models/project.server";
import { getS3KeyFileName, sendSqsMessage } from "~/sqs.server";
import classNames from "classnames";
import { signGetObjectUrl } from "~/s3.server";
import ProjectPreview from "~/components/preview";

enum ProjectFormAction {
  uploadFile,
  addTrackHint,
  sendProcessRequest,
}

export const meta: V2_MetaFunction = () => [{ title: "Clips App" }];

export const loader = async ({ params, request }: LoaderArgs) => {
  const userId = await requireUserId(request);
  invariant(params.projectId, "projectId not found");

  const project = await getProject({ id: params.projectId, userId });
  if (!project) {
    throw new Response("Not Found", { status: 404 });
  }
  console.log("loading project page");
  console.log(project);
  let inputSignedUrl = "", outputSignedUrl = ""
  if (project.inputFile) {
    const resp = await signGetObjectUrl({
      userId,
      bucket: project.inputFile.bucket,
      key: project.inputFile.key,
    });
    if (!resp.ok) {
      throw json({ error: "Failed to sign object url" }, { status: 400 });
    }
    const body = await resp.json();
    inputSignedUrl = body.signedUrl
  }
  if (project.outputFile) {
    try {
      const resp = await signGetObjectUrl({
        userId,
        bucket: project.outputFile.bucket,
        key: project.outputFile.key,
      });
      const body = await resp.json();
      outputSignedUrl = body.signedUrl

      if (project.state === ProjectState.Processing) {
        // TODO: Technically this is a side-effect;
        // but this is good for now while i work on adding this to the clips-core
        await updateProjectState({
          id: params.projectId,
          userId,
          state: ProjectState.Completed,
        });
      }
      
    } catch (e) {
      console.warn(`Output key ${project.outputFile.key} does not exist.`)
    }
  }
  return json({ project, inputSignedUrl, outputSignedUrl });
};

export const action = async ({ params, request }: ActionArgs) => {
  const userId = await requireUserId(request);
  invariant(params.projectId, "projectId not found");

  const formData = await request.formData();
  const projectAction = formData.get("action");
  if (typeof projectAction !== "string" || !action) {
    return json(
      { errors: { body: null, title: "action is required" } },
      { status: 400 }
    );
  }

  console.log("===== PROJECT ACTION =====");

  if (parseInt(projectAction) === ProjectFormAction.uploadFile) {
    console.log("====> Updating with file info...");
    const key = formData.get("key");
    const bucket = formData.get("bucket");
    if (typeof key !== "string" || key.length === 0) {
      return json(
        { errors: { body: null, title: "key is required" } },
        { status: 400 }
      );
    }
    if (typeof bucket !== "string" || bucket.length === 0) {
      return json(
        { errors: { body: null, title: "bucket is required" } },
        { status: 400 }
      );
    }
    const outputKey = `tmp/${userId}/${params.projectId}/out/${getS3KeyFileName(
      key
    )}.mp4`;

    await updateProject({
      id: params.projectId,
      userId,
      inputFile: {
        bucket,
        key,
      },
      outputFile: {
        bucket,
        key: outputKey,
      },
    });
    await updateProjectState({
      id: params.projectId,
      userId,
      state: ProjectState.Ready,
    });
  } else if (parseInt(projectAction) === ProjectFormAction.addTrackHint) {
    console.log("====> Adding track hint...");
    const trackHintStr = formData.get("trackHint");
    if (typeof trackHintStr !== "string" || trackHintStr.length === 0) {
      return json(
        { errors: { body: null, title: "trackHint is required" } },
        { status: 400 }
      );
    }

    const trackHint: TrackHint = JSON.parse(trackHintStr);
    console.log(trackHint);
    await addProjectTrackHints(
      {
        id: params.projectId,
        userId,
      },
      trackHint
    );
  } else if (parseInt(projectAction) === ProjectFormAction.sendProcessRequest) {
    console.log("====> Sending request to SQS...");
    const cropTrackerOpts: CropTrackerOpts = {
      excludeLimbs: true,
      paddingRatio: 1.2,
      smoothingWindowSecs: 2,
    };

    const updatedProject = await updateCropTrackerOptsProject({
      id: params.projectId,
      userId,
      cropTrackerOpts,
    });

    if (!updatedProject.inputFile || !updatedProject.outputFile) {
      throw new Response("Missing inputFile and outputFile fields in project", {
        status: 400,
      });
    }
    if (!updatedProject.cropTrackerOpts) {
      throw new Response("Missing effectMetadata field in project", {
        status: 400,
      });
    }

    const response = await sendSqsMessage({
      type: "crop",
      input_key: updatedProject.inputFile.key,
      output_key: updatedProject.outputFile.key,
      bucket: updatedProject.inputFile.bucket,
      output_width: updatedProject.size.width,
      output_height: updatedProject.size.height,
      exclude_limbs: updatedProject.cropTrackerOpts.excludeLimbs,
      padding_ratio: updatedProject.cropTrackerOpts.paddingRatio,
      smoothing_window_secs: updatedProject.cropTrackerOpts.smoothingWindowSecs,
      track_hints: updatedProject.cropTrackerOpts.trackHints,
    });

    console.log("SQS Response:");
    console.log(response);

    await updateProjectState({
      id: params.projectId,
      userId,
      state: ProjectState.Processing,
    });
  }

  return redirect(`?`);
};

enum UploadState {
  Idle,
  Uploading,
  Complete,
  Error,
}

export default function ProjectPage() {
  const data = useLoaderData<typeof loader>();
  const uploadedObjUrlFetcher = useFetcher();
  const submit = useSubmit();
  const [uploadState, setUploadState] = useState<UploadState>(
    data.project.inputFile ? UploadState.Complete : UploadState.Idle
  );
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [currentTrackHint, setTrackHint] = useState<TrackHint>();
  const [isShowingOverlay, setIsShowingOverlay] = useState<boolean>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const revalidator = useRevalidator();
  const inputSignedUrl =
    (uploadedObjUrlFetcher.data && uploadedObjUrlFetcher.data.signedUrl) ||
    data.inputSignedUrl;

  const onUploadStart = (file: File, next: (f: File) => void) => {
    setUploadState(UploadState.Uploading);
    setUploadPercent(0);
    next(file);
  };

  const onUploadProgress = (percent: number, status: string, file: File) => {
    setUploadPercent(percent);
  };

  const onUploadFinish = (res: any, file: any) => {
    // console.log(res, file);
    const params = new URLSearchParams({
      key: res.key,
      bucket: res.bucket,
    });
    uploadedObjUrlFetcher.data = undefined;
    uploadedObjUrlFetcher.load(`/s3/getobjecturl?${params.toString()}`);
    // if (inputComp) {
    //   inputComp.disabled = true;
    // }
    // setInputFile({
    //   key: res.key,
    //   bucket: res.bucket,
    // });
    setUploadState(UploadState.Complete);
    setUploadPercent(0);

    const formData = new FormData();
    formData.append("action", ProjectFormAction.uploadFile.toString());
    formData.append("key", res.key);
    formData.append("bucket", res.bucket);
    submit(formData, {
      method: "post",
    });
  };

  const onUploadError = (message: string) => {
    setUploadState(UploadState.Error);
  };

  const clearOverlay = () => {
    if (canvasRef.current) {
      const overlay = canvasRef.current;
      const ctx = overlay.getContext("2d");
      if (!ctx) {
        return;
      }
      overlay.width = 0;
      overlay.height = 0;
    }
  };

  const toggleSelector = () => {
    if (isShowingOverlay) {
      clearOverlay();
      setIsShowingOverlay(false);
      return;
    }

    if (canvasRef.current && videoRef.current) {
      const overlay = canvasRef.current;
      const ctx = overlay.getContext("2d");
      if (!ctx) {
        return;
      }

      const video = videoRef.current;
      const dims = video.getBoundingClientRect();
      overlay.width = dims.width;
      overlay.height = dims.height;
      //  Move the time forward because using 0 is not good for the tracker.
      if (video.currentTime <= 1) {
        video.currentTime = 2
      }
      setIsShowingOverlay(true);

      // style the context
      ctx.strokeStyle = "cyan";
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, dims.width, dims.height);

      // calculate where the canvas is on the window
      // (used to help calculate mouseX/mouseY)
      let overlayRect = overlay.getBoundingClientRect();
      let offsetX = overlayRect.left;
      let offsetY = overlayRect.top;
      // var scrollX = $canvas.scrollLeft();
      // var scrollY = $canvas.scrollTop();

      // this flage is true when the user is dragging the mouse
      let isDown = false;

      // these vars will hold the starting mouse position
      let startX = offsetX;
      let startY = offsetX;

      let prevStartX = 0;
      let prevStartY = 0;

      let prevWidth = 0;
      let prevHeight = 0;

      let mouseX = 0;
      let mouseY = 0;

      overlay.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();

        // save the starting x/y of the rectangle
        startX = Math.floor(e.clientX - offsetX);
        startY = Math.floor(e.clientY - offsetY);

        // set a flag indicating the drag has begun
        isDown = true;
      };

      overlay.onmouseup = (e) => {
        e.preventDefault();
        e.stopPropagation();

        // the drag is over, clear the dragging flag
        isDown = false;
        // console.log(prevStartX, prevStartY, prevWidth, prevHeight)
        ctx.strokeRect(prevStartX, prevStartY, prevWidth, prevHeight);
        setTrackHint({
          normLtwh: [
            prevStartX / dims.width,
            prevStartY / dims.height,
            prevWidth / dims.width,
            prevHeight / dims.height,
          ],
          timeSecs: video.currentTime,
        });
        // setCurrentVideoTime(video.currentTime)
      };

      overlay.onmouseout = (e) => {
        e.preventDefault();
        e.stopPropagation();

        // the drag is over, clear the dragging flag
        isDown = false;
      };

      overlay.onmousemove = (e) => {
        e.preventDefault();
        e.stopPropagation();

        // if we're not dragging, just return
        if (!isDown) {
          return;
        }

        // get the current mouse position
        mouseX = Math.floor(e.clientX - offsetX);
        mouseY = Math.floor(e.clientY - offsetY);

        // Put your mousemove stuff here

        // console.log(mouseX, mouseY)

        // calculate the rectangle width/height based
        // on starting vs current mouse position
        var width = mouseX - startX;
        var height = mouseY - startY;

        // clear the canvas
        ctx.clearRect(0, 0, overlay.width, overlay.height);

        // draw a new rect from the start position
        // to the current mouse position
        ctx.strokeRect(startX, startY, width, height);

        prevStartX = startX;
        prevStartY = startY;

        prevWidth = width;
        prevHeight = height;
      };

      // overlay.ontouchstart = (e) => {
      //   const touch = e.touches[0]
      // }
      // overlay.ontouchend
      // overlay.ontouchmove
      // Get the position of a touch relative to the canvas
      overlay.addEventListener(
        "touchstart",
        (e) => {
          const touch = e.touches[0];
          mouseX = Math.floor(touch.clientX - offsetX);
          mouseY = Math.floor(touch.clientY - offsetY);
          var mouseEvent = new MouseEvent("mousedown", {
            clientX: touch.clientX,
            clientY: touch.clientY,
          });
          overlay.dispatchEvent(mouseEvent);
        },
        false
      );
      overlay.addEventListener(
        "touchend",
        (e) => {
          var mouseEvent = new MouseEvent("mouseup", {});
          overlay.dispatchEvent(mouseEvent);
        },
        false
      );
      overlay.addEventListener(
        "touchmove",
        (e) => {
          var touch = e.touches[0];
          var mouseEvent = new MouseEvent("mousemove", {
            clientX: touch.clientX,
            clientY: touch.clientY,
          });
          overlay.dispatchEvent(mouseEvent);
        },
        false
      );
      // Prevent scrolling when touching the overlay
      document.body.addEventListener("touchstart", (e) => {
        if (e.target == overlay) {
          e.preventDefault();
        }
      }, false);
      document.body.addEventListener("touchend", (e) => {
        if (e.target == overlay) {
          e.preventDefault();
        }
      }, false);
      document.body.addEventListener("touchmove", (e) => {
        if (e.target == overlay) {
          e.preventDefault();
        }
      }, false);
    }
  };

  const addFocus = () => {
    clearOverlay();

    if (!currentTrackHint) {
      console.error("Current selection or video time.");
      return;
    }
    console.log(currentTrackHint);
    const formData = new FormData();
    formData.append("action", ProjectFormAction.addTrackHint.toString());
    formData.append("trackHint", JSON.stringify(currentTrackHint));
    submit(formData, {
      method: "post",
    });

    setIsShowingOverlay(false);
    setTrackHint(undefined);
    // setCurrentVideoTime(0)
  };

  const sendProcessRequest = () => {
    const formData = new FormData();
    formData.append("action", ProjectFormAction.sendProcessRequest.toString());
    submit(formData, {
      method: "post",
    });
    revalidator.revalidate()
  };

  return (
    <div className="prose flex h-full w-full max-w-xl flex-col items-center p-2">
      <div className="w-full max-w-lg">
        <h3 className="mt-0">1. Upload your video file here</h3>
        <label className="label">
          <span className="label-text">{"Accepts video files < 5GB"}</span>
        </label>
        <ReactS3Uploader
          className="file-input w-full max-w-lg"
          signingUrl="/s3/putobjecturl"
          signingUrlMethod="GET"
          s3path={`${data.project.id}`}
          preprocess={onUploadStart}
          // onSignedUrl={onSignedUrl}
          onProgress={onUploadProgress}
          onError={onUploadError}
          onFinish={onUploadFinish}
          // signingUrlHeaders={{ additional: headers }}
          // signingUrlQueryParams={{ additional: query-params }}
          signingUrlWithCredentials={true} // in case when need to pass authentication credentials via CORS
          uploadRequestHeaders={{ "x-amz-acl": "private" }}
          contentDisposition="auto"
          scrubFilename={(filename: string) =>
            filename.replace(/[^\w\d_\-.]+/gi, "")
          }
          // inputRef={(cmp) => setInputComp(cmp)}
          autoUpload={true}
          disabled={uploadState !== UploadState.Idle}
        />
        <progress
          className="progress progress-success w-full"
          value={uploadPercent}
          max="100"
          hidden={uploadState !== UploadState.Uploading}
        ></progress>
        <div className="divider"></div>
        <h3 className="mt-0">2. Select processing options</h3>
        {data.project.state >= 1 && (
          <div className="w-full">
            {/* <Form method="post">
              <input type="hidden" name="key" value={inputFile?.key} />
              <input type="hidden" name="bucket" value={inputFile?.bucket} />
              <button
                className={classNames("btn-primary btn my-1", {
                  loading: uploadState === UploadState.Uploading,
                })}
                disabled={!inputFile}
              >
                {uploadPercent ?? uploadPercent + " "}Next
              </button>
            </Form> */}
            {inputSignedUrl && (
              <>
                <div className="flex justify-between">
                  <label className="label cursor-pointer justify-start space-x-1">
                    <input
                      type="checkbox"
                      className="checkbox-primary checkbox"
                      checked={isShowingOverlay}
                      onClick={toggleSelector}
                      disabled={data.project.state >= 2}
                    />
                    <span className="label-text">Manual Person Selection</span>
                  </label>
                  <button
                      className="btn-primary btn-sm btn m-2"
                      disabled={
                        !inputSignedUrl || !isShowingOverlay || !currentTrackHint
                      }
                      onClick={addFocus}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="h-6 w-6 mr-1"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Add Person
                    </button>
                </div>

                {/* <button
                  className="btn my-2"
                  disabled={!signedUrl || isShowingOverlay}
                  onClick={showSelector}
                >
                  Add Track Hint
                </button> */}

                <label className="label">
                  <span className="label-text">{"Input Video Preview"}</span>
                </label>
                <div className="flex flex-col">
                  <div className="relative">
                    <canvas
                      ref={canvasRef}
                      className="absolute left-0 top-0 z-10"
                      width={0}
                      height={0}
                    ></canvas>
                    <video
                      ref={videoRef}
                      className="m-0 max-h-96 max-w-full"
                      controls
                    >
                      <source src={inputSignedUrl} />
                    </video>
                  </div>
                </div>

                <button
                  className={classNames("btn-primary btn my-4 w-full", {
                    'loading': data.project.state === 2
                  })}
                  disabled={!inputSignedUrl || isShowingOverlay || data.project.state === 2}
                  onClick={sendProcessRequest}
                >
                  {data.project.state === 2 ? "Processing" : "Start Processing"}
                </button>
              </>
            )}
          </div>
        )}
        <div className="divider"></div>
        <h3 className="mt-0">3. Voila! See results. </h3>
        {data.project.state >= 2 && (
          <>
            <ProjectPreview project={data.project} revalidator={revalidator}></ProjectPreview>
          </>
        )}
        <div className="divider"></div>
      </div>
    </div>
  );
}
