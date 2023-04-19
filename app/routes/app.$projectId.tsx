import type { V2_MetaFunction } from "@remix-run/node";
import ReactS3Uploader from "react-s3-uploader";
import { Outlet, useFetcher } from "@remix-run/react";
import { useOptionalUser } from "~/utils";
import { useEffect, useState } from "react";

export const meta: V2_MetaFunction = () => [{ title: "Clips App" }];

export default function ProjectPage() {
  return (
    <div className="flex justify-center h-full w-full bg-gray-50">
      <div className="flex-row justify-center h-full w-full max-w-xl py-2">
        <ul className="steps w-full">
          <li className="step step-primary">Upload Clip</li>
          <li className="step">Choose Effect</li>
          <li className="step">Clip Preview</li>
        </ul>
        <div>
          <Outlet/>
        </div>
      </div>
    </div>
  );
}
