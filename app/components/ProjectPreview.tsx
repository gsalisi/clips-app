import { Link, useRevalidator } from "@remix-run/react";
import { useEffect, useState } from "react";
import type { Project } from "~/models/project.server";
import { DownloadIcon, LoadingSpinner } from "./Icons";


const fetchOutputUrl = async (project: Project) => {
  if (!project.outputFile) {
    return;
  }
  const outputFile = project.outputFile;
  const params = new URLSearchParams({
    key: outputFile.key,
    bucket: outputFile.bucket,
  });
  const response = await fetch(`/s3/getobjecturl?${params.toString()}`);
  const body = await response.json();
  if (!response.ok) {
    throw body;
  }
  return body.signedUrl;
};

export default function ProjectPreview({ project, revalidator }: { project: Project, revalidator: ReturnType<typeof useRevalidator> }) {
  const [outputUrl, setOutputUrl] = useState<string>("");
  const [outputPollInterval, setOutputPollInterval] = useState<NodeJS.Timer>();
  const [hasWebviewWarning, setHasWebViewWarning] = useState(false);

  useEffect(() => {
    if (outputPollInterval) {
      clearInterval(outputPollInterval);
    }
    fetchOutputUrl(project).then((url) => {
        setOutputUrl(url);
        revalidator.revalidate()
    });
    const interval = setInterval(() => {
      fetchOutputUrl(project).then((url) => {
        setOutputUrl(url);
        revalidator.revalidate()
        clearInterval(interval);
      });
    }, 10000);

    setOutputPollInterval(interval);

    const userAgent = window.navigator.userAgent.toLowerCase();
    // safari = /safari/.test( userAgent ),
    const ios = /iphone|ipod|ipad/.test( userAgent );

    if( ios ) {
      setHasWebViewWarning(true)
    }
    return () => clearInterval(interval);
  }, []);


  const downloadObject = async () => {
    if (!project.outputFile) {
      throw Error("Project.outputFile should not be undefined");
    }
    const params = new URLSearchParams({
      key: project.outputFile.key,
      bucket: project.outputFile.bucket,
    });
    const res = await fetch(`/s3/getobjecturl?${params.toString()}`);
    const resJson = await res.json();
    if (hasWebviewWarning) {
      location.assign(resJson.signedUrl)
    } else {
      open(resJson.signedUrl, "_blank");
    }
  };

  
  return (
    <>
      {project.state === 2 && (
        <>
          <h3 id="completed" className="mt-0">⌛️ Your video is cropping...</h3>
          <span className="flex justify-center items-center my-4">
            <LoadingSpinner />
            <label className="label">
              You can leave this page while waiting...
            </label>
          </span>
          
          {/* {estCompleteDate && 
            <progress
              className="progress progress-success w-full"
              value={proccesProgress}
              max="100"
            ></progress>
          } */}
        </>
      )}
      {project.state === 3 && (
        <>
          <h3 id="completed" className="mt-0"> 🎉 Crop Complete!</h3>
          {hasWebviewWarning &&
            <p>
              💢 Problems downloading file? Make sure you open the app on your phone browser. Don't worry your file will be here waiting for you. 
            </p>
          }
          <button className="btn btn-primary my-2" onClick={downloadObject} disabled={!outputUrl}>
            <DownloadIcon/>
            Download file
          </button>
          <label className="label">
            Videos will only be available to download for 24 hours.
          </label>
          <div className="flex w-full">
            <div className="flex-col w-full max-w-lg">
              {outputUrl && (
                <>
                  <div className="w-full max-w-lg">
                    <div className="flex flex-col">
                      <video className="m-0 max-h-96 max-full-w" controls>
                        <source src={outputUrl} />
                      </video>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
      {project.state === 4 && (
        <>
          <h3 id="completed" className="mt-0">😭 Processing Failed!</h3>
          <p className="text-red-700">
            Sorry! Something went wrong. Please try again in a <Link to="/app/new">new project</Link>.
          </p>
        </>
      )}
      
    </>
    
  );
}
