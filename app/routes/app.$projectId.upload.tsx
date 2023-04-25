import {
  ActionArgs,
  json,
  LoaderArgs,
  redirect,
  V2_MetaFunction,
} from "@remix-run/node";
import ReactS3Uploader from "react-s3-uploader";
import { Form, useFetcher, useLoaderData, useSubmit } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { requireUserId } from "~/session.server";
import invariant from "tiny-invariant";
import { addProjectTrackHints as addCropTrackerOptsTrackHints, CropTrackerOpts, getProject, S3Location, TrackHint, updateCropTrackerOptsProject, updateProject } from "~/models/project.server";
import { getS3KeyFileName, sendSqsMessage } from "~/sqs.server";
import classNames from "classnames";
import { signGetObjectUrl } from "~/s3.server";

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
  // console.log(project.cropTrackerOpts.trackHints[0].norm_ltwh);
  if (project.inputFile) {
    // return redirect(
    //   `/app/${project.id}/${project.effectMetadata ? "preview" : "options"}`
    // )
    const resp = await signGetObjectUrl({
      userId,
      bucket: project.inputFile.bucket,
      key: project.inputFile.key,
    });
    if (!resp.ok) {
      throw json({ error: "Failed to sign object url" }, { status: 400 });
    }
    const body = await resp.json();
    return json({ project, signedUrl: body.signedUrl });
  }
  return json({ project, signedUrl: "" });
};

export const action = async ({ params, request }: ActionArgs) => {
  const userId = await requireUserId(request);
  invariant(params.projectId, "projectId not found");

  const formData = await request.formData();
  const projectAction = formData.get("action")
  if (typeof projectAction !== "string" || !action) {
    return json(
      { errors: { body: null, title: "action is required" } },
      { status: 400 }
    );
  }

  console.log("===== PROJECT ACTION =====")

  if (parseInt(projectAction) === ProjectFormAction.uploadFile) {
    console.log("====> Updating with file info...")
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
  } else if (parseInt(projectAction) === ProjectFormAction.addTrackHint) {
    console.log("====> Adding track hint...")
    const trackHintStr = formData.get("trackHint");
    if (typeof trackHintStr !== "string" || trackHintStr.length === 0) {
      return json(
        { errors: { body: null, title: "trackHint is required" } },
        { status: 400 }
      );
    }

    const trackHint: TrackHint = JSON.parse(trackHintStr)
    console.log(trackHint)
    await addCropTrackerOptsTrackHints({
      id: params.projectId,
      userId,
    }, trackHint);
  } else if (parseInt(projectAction) === ProjectFormAction.sendProcessRequest) {
    const cropTrackerOpts: CropTrackerOpts = {
      excludeLimbs: true,
      paddingRatio: 1.2,
      smoothingWindowSecs: 2,
    }
    
    const updatedProject = await updateCropTrackerOptsProject({
      id: params.projectId,
      userId,
      cropTrackerOpts,
    });
  
    if (!updatedProject.inputFile || !updatedProject.outputFile) {
      throw new Response("Missing inputFile and outputFile fields in project", { status: 400 });
    }
    if (!updatedProject.cropTrackerOpts) {
      throw new Response("Missing effectMetadata field in project", { status: 400 });
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
    })
  
    console.log("SQS Response:")
    console.log(response)
    return redirect(`/app/${params.projectId}/preview`);
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
  const [inputComp, setInputComp] = useState<HTMLInputElement>();
  // const [inputFile, setInputFile] = useState<S3Location>();
  const [uploadState, setUploadState] = useState<UploadState>(UploadState.Idle);
  const [uploadPercent, setUploadPercent] = useState<string>("");
  // const [currentVideoTime, setCurrentVideoTime] = useState<number>(0);
  const [currentTrackHint, setTrackHint] = useState<TrackHint>()
  const [isShowingOverlay, setIsShowingOverlay] = useState<boolean>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signedUrl = uploadedObjUrlFetcher.data || data.signedUrl;

  const onUploadStart = (file: File, next: (f: File) => void) => {
    setUploadState(UploadState.Uploading);
    setUploadPercent("0%");
    next(file);
  };

  const onUploadProgress = (percent: number, status: string, file: File) => {
    setUploadPercent(`${percent}%`);
  };

  const onUploadFinish = (res: any, file: any) => {
    // console.log(res, file);
    const params = new URLSearchParams({
      key: res.key,
      bucket: res.bucket,
    });
    uploadedObjUrlFetcher.data = undefined;
    uploadedObjUrlFetcher.load(`/s3/getobjecturl?${params.toString()}`);
    if (inputComp) {
      inputComp.disabled = true;
    }
    // setInputFile({
    //   key: res.key,
    //   bucket: res.bucket,
    // });
    setUploadState(UploadState.Complete);
    setUploadPercent("");

    const formData = new FormData();
    formData.append("action", ProjectFormAction.uploadFile.toString())
    formData.append("key", res.key);
    formData.append("bucket", res.bucket);
    submit(formData, {
      method: "post",
    });
  };

  const onUploadError = (message: string) => {
    setUploadState(UploadState.Error);
  };

  const showSelector = () => {
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
      setIsShowingOverlay(true)
      // video.addEventListener("play", () => {
      //   function step() {
      //     if (!ctx) return;
      //     setCurrentVideoTime(video.currentTime);
      //     // ctx.drawImage(video, 0, 0, overlay.width, overlay.height);
      //     requestAnimationFrame(step);
      //   }
      //   requestAnimationFrame(step);
      // });


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
          normLtwh: [prevStartX / dims.width, prevStartY / dims.height, prevWidth / dims.width, prevHeight / dims.height],
          timeSecs: video.currentTime,
        })
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
      // canvas.addEventListener(
      //   "touchstart",
      //   function (e) {
      //     mousePos = getTouchPos(canvas, e);
      //     var touch = e.touches[0];
      //     var mouseEvent = new MouseEvent("mousedown", {
      //       clientX: touch.clientX,
      //       clientY: touch.clientY,
      //     });
      //     canvas.dispatchEvent(mouseEvent);
      //   },
      //   false
      // );
      // canvas.addEventListener(
      //   "touchend",
      //   function (e) {
      //     var mouseEvent = new MouseEvent("mouseup", {});
      //     canvas.dispatchEvent(mouseEvent);
      //   },
      //   false
      // );
      // canvas.addEventListener(
      //   "touchmove",
      //   function (e) {
      //     var touch = e.touches[0];
      //     var mouseEvent = new MouseEvent("mousemove", {
      //       clientX: touch.clientX,
      //       clientY: touch.clientY,
      //     });
      //     canvas.dispatchEvent(mouseEvent);
      //   },
      //   false
      // );
      //// Prevent scrolling when touching the canvas
      // document.body.addEventListener("touchstart", function (e) {
      //   if (e.target == canvas) {
      //     e.preventDefault();
      //   }
      // }, false);
      // document.body.addEventListener("touchend", function (e) {
      //   if (e.target == canvas) {
      //     e.preventDefault();
      //   }
      // }, false);
      // document.body.addEventListener("touchmove", function (e) {
      //   if (e.target == canvas) {
      //     e.preventDefault();
      //   }
      // }, false);
    }
  };

  const addFocus = () => {
    if (canvasRef.current) {
      const overlay = canvasRef.current;
      const ctx = overlay.getContext("2d");
      if (!ctx) {
        return;
      }
      overlay.width = 0;
      overlay.height = 0;
    }

    if (!currentTrackHint) {
      console.error("Current selection or video time.")
      return 
    }
    console.log(currentTrackHint)
    const formData = new FormData();
    formData.append("action", ProjectFormAction.addTrackHint.toString())
    formData.append("trackHint", JSON.stringify(currentTrackHint));
    submit(formData, {
      method: "post",
    });

    setIsShowingOverlay(false)
    setTrackHint(undefined)
    // setCurrentVideoTime(0)
  }

  const sendProcessRequest = () => {
    const formData = new FormData();
    formData.append("action", ProjectFormAction.sendProcessRequest.toString())
    // formData.append("trackHint", JSON.stringify(currentTrackHint));
    submit(formData, {
      method: "post",
    });

    // setIsShowingOverlay(false)
    // setTrackHint(undefined)
    // setCurrentVideoTime(0)
  }

  return (
    <div className="flex h-full w-full max-w-xl flex-col items-center p-2">
      <div className="w-full max-w-lg">
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
          inputRef={(cmp) => setInputComp(cmp)}
          autoUpload={true}
        />
      </div>
      <div className="w-full max-w-lg">
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
        {signedUrl && (
          <>
            <label className="label">
              <span className="label-text">{"Input Preview"}</span>
            </label>
            <div className="flex flex-col">
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  className="absolute left-0 top-0 z-10"
                  width={0}
                  height={0}
                ></canvas>
                <video ref={videoRef} className="max-h-96 max-w-lg" controls>
                  <source src={signedUrl} />
                </video>
              </div>
            </div>
            <button
              className="btn btn-primary my-2"
              disabled={!signedUrl || isShowingOverlay}
              onClick={showSelector}
            >
              Draw box on person
            </button>
            <button
              className="btn m-2"
              disabled={!signedUrl || !isShowingOverlay || !currentTrackHint}
              onClick={addFocus}
            >
              Add
            </button>
          </>
        )}
      </div>
      <button
        className="btn w-full btn-primary my-2"
        disabled={!signedUrl || isShowingOverlay}
        onClick={sendProcessRequest}
      >
        Go
      </button>
    </div>
  );
}
