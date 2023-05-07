import type { ActionArgs, LoaderArgs, V2_MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import ReactS3Uploader from "react-s3-uploader";
import {
  Form,
  Link,
  useFetcher,
  useLoaderData,
  useLocation,
  useRevalidator,
  useSubmit,
} from "@remix-run/react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import type { CropperSQSPayload } from "~/sqs.server";
import classNames from "classnames";
import { signGetObjectUrl } from "~/s3.server";
import ProjectPreview from "~/components/ProjectPreview";
import FrameAnnotation from "~/components/FrameAnnotation";
import { add, differenceInSeconds, formatDistance } from "date-fns";
import { checkCredits } from "~/models/user.server";

enum ProjectFormAction {
  uploadFile,
  addTrackHint,
  sendProcessRequest,
}

const NO_CREDITS_ERROR_CODE = "no_credits"
const errorCodeToMessage = {
  [NO_CREDITS_ERROR_CODE]: "😰 Sorry, you have no more credits left."
}

export const meta: V2_MetaFunction = () => [{ title: "PopCrop" }];

export const loader = async ({ params, request }: LoaderArgs) => {
  const userId = await requireUserId(request);
  invariant(params.projectId, "projectId not found");

  const project = await getProject({ id: params.projectId, userId });
  if (!project) {
    throw new Response("Not Found", { status: 404 });
  }
  // console.log("loading project page");
  // console.log(project);
  let inputSignedUrl = "",
    outputSignedUrl = "";
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
    inputSignedUrl = body.signedUrl;
  }
  if (project.outputFile) {
    try {
      const resp = await signGetObjectUrl({
        userId,
        bucket: project.outputFile.bucket,
        key: project.outputFile.key,
      });
      const body = await resp.json();
      outputSignedUrl = body.signedUrl;

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
      console.warn(`Output key ${project.outputFile.key} does not exist.`);
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

  const credits = await checkCredits(userId);
  if (credits <= 0)  {
    console.log(`No more credits for ${userId}.`)
    return redirect(`?error=${NO_CREDITS_ERROR_CODE}`)
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
      env: process.env.ARC_ENV as CropperSQSPayload["env"],
      user_id: updatedProject.userId,
      project_id: updatedProject.id,
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
  const location = useLocation();
  const submit = useSubmit();
  const [uploadState, setUploadState] = useState<UploadState>(
    data.project.inputFile ? UploadState.Complete : UploadState.Idle
  );
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [estCompleteDate, setEstCompleteDate] = useState<Date>();
  const [proccesProgress, setProcessProgress] = useState(0);
  const [showFrameAnnotation, setShowFrameAnnotation] =
    useState<boolean>(false);
  const [hasAddedFocus, setHasAddedFocus] = useState<boolean>(false);
  const [readyToProcess, setReadyToProcess] = useState<boolean>(false);
  const [numOfPersonSelectValue, setNumOfPersonSelectValue] =
    useState<string>("");
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>();
  const revalidator = useRevalidator();
  const inputSignedUrl =
    (uploadedObjUrlFetcher.data && uploadedObjUrlFetcher.data.signedUrl) ||
    data.inputSignedUrl;

  const params = new URLSearchParams(location.search);
  const errorCode = params.get("error") as keyof typeof errorCodeToMessage;

  useEffect(() => {
    if (data.project.cropTrackerOpts?.trackHints) {
      setNumOfPersonSelectValue("multi");
      setReadyToProcess(true);
      setHasAddedFocus(true);
    } else if (data.project.inputFile && data.project.state >= 2) {
      setNumOfPersonSelectValue("single");
      setReadyToProcess(true);
    }
  }, [data.project.cropTrackerOpts]);

  const onVideoRefSet = useCallback((ref: HTMLVideoElement | null) => {
    setVideoRef(ref);
  }, []);

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
    const formData = new FormData();
    formData.append("action", ProjectFormAction.uploadFile.toString());
    formData.append("key", res.key);
    formData.append("bucket", res.bucket);
    submit(formData, {
      method: "post",
    });
    setUploadState(UploadState.Complete);
    setUploadPercent(0);
  };

  const onUploadError = (message: string) => {
    setUploadState(UploadState.Error);
  };

  const selectNumPerson: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
    setNumOfPersonSelectValue(e.target.value);
    setShowFrameAnnotation(e.target.value === "multi");
    if (e.target.value === "single") {
      setReadyToProcess(true);
    }
    if (e.target.value === "multi" && !hasAddedFocus) {
      setReadyToProcess(false);
      videoRef?.pause();
    }
  };

  const addFocus = (trackHint: TrackHint) => {
    if (!trackHint) {
      console.error("Current selection or video time.");
      return;
    }
    console.log(trackHint);
    const formData = new FormData();
    formData.append("action", ProjectFormAction.addTrackHint.toString());
    formData.append("trackHint", JSON.stringify(trackHint));
    submit(formData, {
      method: "post",
    });
    setHasAddedFocus(true);
    setReadyToProcess(true);
  };

  const sendProcessRequest = () => {
    setProcessProgress(1);
    const formData = new FormData();
    formData.append("action", ProjectFormAction.sendProcessRequest.toString());
    submit(formData, {
      method: "post",
    });

    if (videoRef) {
      // TODO: should populate this upon upload
      const estimatedTimeToCompleteSecs = videoRef.duration * 10;
      const lastModifiedDate = new Date(data.project.lastModifiedAt * 1000);
      const estDate = add(lastModifiedDate, {
        seconds: estimatedTimeToCompleteSecs,
      });
      setEstCompleteDate(estDate);
    }

    window.scrollTo({ top: 0 });
    revalidator.revalidate();
  };

  // useEffect(() => {
  //   if (estCompleteDate) {
  //     const interval = setInterval(() => {
  //       const lastModifiedDate = new Date(data.project.lastModifiedAt * 1000);
  //       const currDate = new Date()
  //       const percent = differenceInSeconds(estCompleteDate, currDate) / differenceInSeconds(estCompleteDate, lastModifiedDate)
  //       console.log(percent)
  //       setProcessProgress(percent)
  //     }, 1000)
  //     return () => clearInterval(interval)
  //   }
  // }, [estCompleteDate])

  return (
    <div className="prose flex h-full w-full max-w-xl flex-col items-center p-2">
      <div className="w-full max-w-lg">
        {errorCode &&
          <div className="mb-6 rounded-md border-2 border-red-600/10 bg-red-500/10">
            <p className="m-4">{errorCodeToMessage[errorCode]}</p>
          </div>
        }
        <div className="flex items-end">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="mr-1.5 h-5 w-5"
          >
            <path
              strokeLinecap="round"
              d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
          <h3 className="my-0 font-bold leading-none mb-0.5">
            {data.project.title}
          </h3>
        </div>
        <div className="divider"></div>
        {data.project.state === 0 && (
          <>
            <h3 id="idle" className="mt-0">
              📤 Upload your video file here
            </h3>
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
            {uploadState === UploadState.Uploading && (
              <label className="label">
                Please stay on this page until the file is uploaded...
              </label>
            )}
            <progress
              className="progress progress-success w-full"
              value={uploadPercent}
              max="100"
              hidden={uploadState !== UploadState.Uploading}
            ></progress>
            {uploadState === UploadState.Complete && (
              <label className="label">Please wait for the next steps...</label>
            )}
            {uploadState === UploadState.Uploading && (
              <label className="label">
                Files are only stored in our servers for 24 hours.
              </label>
            )}
            <div className="divider"></div>
          </>
        )}
        {data.project.state === 1 && (
          <>
            <h3 id="ready" className="mt-0">
              💁‍♂️ Select processing options
            </h3>
            {data.project.state >= 1 && (
              <div className="w-full">
                {inputSignedUrl && (
                  <>
                    <div className="flex-row justify-between py-2">
                      <label className="label">
                        <span className="label-txt">
                          How many people are visible in the video?
                        </span>
                      </label>
                      <select
                        className="max-w-s select-bordered select-secondary select select-lg w-full"
                        name="numOfPerson"
                        value={numOfPersonSelectValue}
                        onChange={selectNumPerson}
                        disabled={data.project.state >= 2}
                      >
                        <option value="" disabled>
                          Select answer...
                        </option>
                        <option value="single">Just one.</option>
                        <option value="multi">More than one...</option>
                      </select>
                      {/* <label className="label cursor-pointer justify-start space-x-1">
                        <span className="label-text">
                          Are there multiple people in the video?
                        </span>
                        <input
                          type="checkbox"
                          className="checkbox-primary checkbox"
                          checked={showFrameAnnotation}
                          onChange={toggleSelector}
                          disabled={data.project.state >= 2}
                        />
                      </label> */}
                    </div>
                    {numOfPersonSelectValue && (
                      <>
                        <label className="label">
                          <span className="label-text">Preview</span>
                        </label>
                        <div className="my-1 flex flex-col">
                          <video
                            ref={onVideoRefSet}
                            className="m-0 max-w-full"
                            controls
                            preload="auto"
                          >
                            <source src={inputSignedUrl} />
                          </video>
                        </div>
                      </>
                    )}
                    {numOfPersonSelectValue === "multi" && videoRef && (
                      <FrameAnnotation
                        video={videoRef}
                        addFocus={addFocus}
                        existingTrackHints={
                          data.project.cropTrackerOpts?.trackHints
                        }
                      ></FrameAnnotation>
                    )}
                    <button
                      className={classNames("btn-primary btn my-4 w-full", {
                        loading: proccesProgress > 0,
                      })}
                      disabled={!readyToProcess}
                      onClick={sendProcessRequest}
                    >
                      {"🚀 Submit Video"}
                    </button>
                  </>
                )}
              </div>
            )}
            <div className="divider"></div>
          </>
        )}
        {data.project.state >= 2 && (
          <>
            <ProjectPreview project={data.project} revalidator={revalidator} />
            <div className="divider"></div>
          </>
        )}
      </div>
    </div>
  );
}
