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

const isMobile = () => {
  let check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor);
  return check;
};

export default function ProjectPreview({ project, revalidator }: { project: Project, revalidator: ReturnType<typeof useRevalidator> }) {
  const [outputUrl, setOutputUrl] = useState<string>("");
  const [outputPollInterval, setOutputPollInterval] = useState<NodeJS.Timer>();
  // const [hasWebviewWarning, setHasWebViewWarning] = useState(false);

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

    if (isMobile()) {
      location.assign(resJson.signedUrl)
    } else {
      open(resJson.signedUrl, "_blank");
    }
  };

  
  return (
    <>
      {project.state === 2 && (
        <>
          <h3 id="completed" className="mt-0"> <LoadingSpinner />Our AI 🤖 is processing your video...</h3>
          <div className="mb-6 p-2 rounded-md border-2 border-sky-600/10 bg-sky-500/10 w-full">
            <p className="m-2 font-bold">You can leave this page and come back later!👋</p>
            <p className="m-2">Our ✨magic✨ may require up to 30 minutes to complete.</p> 
            <p className="m-2"> We promise it's worth the wait!🙏 </p>
          </div>
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
                      <video className="m-0 max-full-w" controls preload="auto">
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
