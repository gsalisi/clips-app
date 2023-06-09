import { useRevalidator } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import type { Project, TrackHint } from "~/models/project.server";

export default function FrameAnnotation({
  video,
  addFocus,
  existingTrackHints,
}: {
  video: HTMLVideoElement;
  existingTrackHints?: TrackHint[];
  addFocus: (t: TrackHint) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [lastTrackHint, setTrackHint] = useState<TrackHint>();
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [loadingOverlay, setLoadingOverlay] = useState(true);
  const [canAddHint, setCanAddHint] = useState(!existingTrackHints);
  const [addedHint, setAddedHint] = useState(false);

  const syncCanvasShape = () => {
    if (!canvasRef.current || !overlayRef.current) {
      return
    }

    const dims = video.getBoundingClientRect();
    canvasRef.current.width = dims.width;
    canvasRef.current.height = dims.height;
    overlayRef.current.width = dims.width;
    overlayRef.current.height = dims.height;
  }

  const drawVideoToCanvas = () => {
    if (!canvasRef.current) {
      return;
    }
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) {
      return;
    }
    syncCanvasShape()
    const dims = video.getBoundingClientRect();
    ctx.drawImage(video, 0, 0, dims.width, dims.height);
    console.log(video.currentTime)
    setCurrentVideoTime(video.currentTime);
  };
  
  video.onseeked = drawVideoToCanvas;
  video.onpause = drawVideoToCanvas;
  video.onplay = drawVideoToCanvas;

  video.oncanplaythrough = () => {
    if (video.currentTime <= 1) {
      video.currentTime = video.duration / 2;
    }
  };

  const setupInteractionHandlers = (
    overlay: HTMLCanvasElement,
    canvas: HTMLCanvasElement
  ) => {
    const ctx = overlay.getContext("2d");
    if (!ctx) {
      return;
    }
    
    // this flage is true when the user is dragging the mouse
    let isActive = false;

    // these vars will hold the starting mouse position
    let posX = 0;
    let posY = 0;
    let width = 0;
    let height = 0;
    let offsetX = 0;
    let offsetY = 0;
    let boxSize = 0;

    const setup = () => {
      const dims = canvas.getBoundingClientRect();
      overlay.width = dims.width;
      overlay.height = dims.height;

      boxSize = Math.floor(Math.min(dims.width, dims.height) / 8);

      // style the context
      ctx.strokeStyle = "cyan";
      ctx.lineWidth = 4;
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 20;
      ctx.strokeRect(0, 0, dims.width, dims.height);

      // calculate where the canvas is on the window
      // (used to help calculate mouseX/mouseY)
      let overlayRect = overlay.getBoundingClientRect();

      offsetX = overlayRect.left;
      offsetY = overlayRect.top;

      posX = offsetX;
      posY = offsetY;
      width = boxSize;
      height = boxSize;
    };

    setup();

    const drawSelectorBox = (mouseX: number, mouseY: number) => {
      // save the starting x/y of the rectangle
      posX = Math.max(
        Math.floor(mouseX - offsetX) - Math.floor(boxSize / 2),
        0
      );
      posY = Math.max(Math.floor(mouseY - offsetY) - boxSize, 0);

      width = Math.min(boxSize, overlay.width - posX);
      height = Math.min(boxSize * 2, overlay.height - posY);

      // clear the canvas
      ctx.clearRect(0, 0, overlay.width, overlay.height);

      // draw a new rect from the start position
      // to the current mouse position
      ctx.strokeRect(posX, posY, width, height);
    };

    overlay.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setup();
      drawSelectorBox(e.clientX, e.clientY);
      isActive = true;
    };

    overlay.onmouseup = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // the drag is over, clear the dragging flag
      isActive = false;
      const dims = canvas.getBoundingClientRect();
      setTrackHint({
        normLtwh: [
          posX / dims.width,
          posY / dims.height,
          width / dims.width,
          height / dims.height,
        ],
        timeSecs: currentVideoTime,
      });
      // setCurrentVideoTime(video.currentTime)
    };

    overlay.onmousemove = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // if we're not dragging, just return
      if (!isActive) {
        return;
      }
      drawSelectorBox(e.clientX, e.clientY);
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
        posX = Math.floor(touch.clientX - offsetX);
        posY = Math.floor(touch.clientY - offsetY);
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
  };

  useEffect(() => {
    if (!canvasRef.current || !overlayRef.current) {
      return;
    }
    // A little hacky but this makes everything more reliable for now
    setTimeout(() => {
      if (!canvasRef.current || !overlayRef.current) {
        return;
      }
      syncCanvasShape()
      if (!existingTrackHints) {
        setupInteractionHandlers(overlayRef.current, canvasRef.current);
      } else {
        const overlayRect = overlayRef.current.getBoundingClientRect();
        const ctx = overlayRef.current.getContext("2d");
        if (!ctx) return;
        // style the context
        ctx.strokeStyle = "cyan";
        ctx.lineWidth = 4;

        let trackHint = existingTrackHints[0];
        const [l, t, w, h] = trackHint.normLtwh;
        ctx.strokeRect(
          l * overlayRect.width,
          t * overlayRect.height,
          w * overlayRect.width,
          h * overlayRect.height
        );
      }
      // eslint-disable-next-line no-self-assign
      video.currentTime = video.currentTime; // This triggers an onseeked event
      setLoadingOverlay(false)
    }, 2000)
    
  }, [canvasRef, overlayRef, video]);

  const addLastTrackHint = () => {
    if (lastTrackHint) {
        lastTrackHint.timeSecs = currentVideoTime
        addFocus(lastTrackHint);
        setCanAddHint(false);
        setAddedHint(true);
    }
  };

  return (
    <div className="w-full max-w-lg">
      <label className="label">
        <span className="label-text font-bold">
          {"👇 Tap on the person that you want to be the subject"}
        </span>
      </label>
      
      <div className="relative">
        <canvas
          ref={overlayRef}
          className="absolute left-0 top-0 z-10"
        ></canvas>
        <canvas ref={canvasRef}></canvas>
      </div>
      <label className="label">
        <span className="label-text">
        💡 Tip: Scrub the video above to select a frame where the person is most visible.
        </span>
      </label>
      <button
        className="btn-secondary btn mt-2 max-w-full"
        onClick={addLastTrackHint}
        disabled={!lastTrackHint || !canAddHint}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="mr-1 h-6 w-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Confirm Subject
      </button>
      {addedHint && (
        <label className="label">
          <span className="text-green-500">Subject confirmed! 👍</span>
        </label>
      )}
    </div>
  );
}
