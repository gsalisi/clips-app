import { useRevalidator } from "@remix-run/react";
import { useEffect, useState } from "react";
import type { Project } from "~/models/project.server";
import { DownloadIcon } from "./Icons";


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
    window.open(resJson.signedUrl, "_blank");
  };

  return (
    <div className="flex w-full">
      <div className="flex-col w-full max-w-lg">
        {outputUrl && (
          <>
             <label className="label">
              <span className="label-text">{"Output Preview"}</span>
            </label>
            <div className="w-full max-w-lg">
              <div className="flex flex-col">
                <video className="m-0 max-h-96 max-full-w" controls>
                  <source src={outputUrl} />
                </video>
              </div>
            </div>
          </>
        )}
        <button className="btn my-2" onClick={downloadObject} disabled={!outputUrl}>
          <DownloadIcon/>
          Download
        </button>
      </div>
    </div>
  );
}
