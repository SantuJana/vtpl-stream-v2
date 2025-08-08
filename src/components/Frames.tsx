import { SvgIcon } from "@mui/material";
import React, {
  memo,
  MutableRefObject,
  useEffect,
  useRef,
  useState,
} from "react";


interface ObjectInfo {
  x: number;
  y: number;
  w: number;
  h: number;
  t: number;
  c: number;
  i: number;
  e: boolean;
}

interface FrameInfo {
  channelId: number;
  frameId: number;
  objectList: ObjectInfo[];
  peopleCount: number;
  refHeight: number;
  refWidth: number;
  siteId: number;
  timeStamp: number;
  timeStampEncoded: number;
  timeStampEnd: number;
  vehicleCount: number;
}

type FramesProps = {
  frameInfo: FrameInfo | null;
  svgRef: React.RefObject<SVGSVGElement | null>;
  isEvent: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
};

function Frames({ frameInfo, svgRef, isEvent, videoRef }: FramesProps) {
  const [strokeWidth, setStrokeWidth] = useState(4);
  const prevWidth = useRef<number>(0);
  const prevHeight = useRef<number>(0);
  const cornerSizeRef = useRef<number>(10);

  useEffect(() => {
    const baseWidth = 1920; // Reference width
    const baseHeight = 1080; // Reference height
    const frameWidth = frameInfo?.refWidth;
    const frameHeight = frameInfo?.refHeight;

    if (
      frameWidth &&
      frameWidth != 0 &&
      frameHeight &&
      frameHeight != 0 &&
      frameWidth != prevWidth.current &&
      frameHeight != prevHeight.current &&
      videoRef.current?.videoWidth &&
      videoRef.current?.videoHeight
    ) {
      prevWidth.current = frameWidth;
      prevHeight.current = frameHeight;

      const widthScale = videoRef.current.videoWidth / baseWidth;
      const heightScale = videoRef.current.videoHeight / baseHeight;

      // Use the smaller scale to maintain aspect ratio
      const scale = Math.min(widthScale, heightScale);

      // Adjust stroke width proportionally
      const adjustedStrokeWidth = 3 * scale;
      setStrokeWidth(adjustedStrokeWidth);
    }
    // Calculate scaling factors
  }, [frameInfo?.refWidth, frameInfo?.refHeight]);

  return (
    <SvgIcon
      ref={svgRef}
      style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        zIndex: 1,
        // top: "50%",
        // left: "50%",
        // transform: "translate(-50%, -50%)",
      }}
      viewBox={`0 0 ${videoRef.current?.videoWidth || 1920} ${
        videoRef.current?.videoHeight || 1080
      }`}
      // viewBox={`0 0 1920 1080`}
    >
    {
      frameInfo?.refWidth && frameInfo?.refHeight &&
      <g>
        {frameInfo?.objectList?.map((obj: any, index: any) => {
          if (obj.t === 1 || obj.t === 2) {
            const x = 
            (obj.x * (videoRef.current?.videoWidth || 1920)) /
            (frameInfo?.refWidth || 1920);
            const y = 
            (obj.y * (videoRef.current?.videoHeight || 1080)) /
            (frameInfo?.refHeight || 1080);
            const width =
              x +
              (obj.w * (videoRef.current?.videoWidth || 1920)) /
                (frameInfo?.refWidth || 1920);
            const height =
              y +
              (obj.h * (videoRef.current?.videoHeight || 1080)) /
                (frameInfo?.refHeight || 1080);
            const cornerWidthSize = (strokeWidth * 10) > (width - x) / 3 ?  (width - x) / 3 : strokeWidth * 10;
            const cornerHeightSize = (strokeWidth * 10) > (height - y) / 3 ?  (height - y) / 3 : strokeWidth * 10;
            // const cornerHeightSize = Math.min((height - y) * 0.66, strokeWidth * 10);
            const stroke =
              obj.t == 1
                ? obj.e && isEvent
                  ? "red"
                  : "#1F87FC"
                : obj.t == 2
                ? obj.e && isEvent
                  ? "red"
                  : "#FFB900"
                : "transparent";
            return (
              // <rect
              //   key={index}
              //   x={
              //     (obj.x * (frameInfo?.refWidth || 1920)) /
              //     (frameInfo?.refWidth || 1)
              //   }
              //   y={
              //     (obj.y * (frameInfo?.refHeight || 1080)) /
              //     (frameInfo?.refHeight || 1)
              //   }
              //   width={
              //     (obj.w * (frameInfo?.refWidth || 1920)) /
              //     (frameInfo?.refWidth || 1)
              //   }
              //   height={
              //     (obj.h * (frameInfo?.refHeight || 1080)) /
              //     (frameInfo?.refHeight || 1)
              //   }
              //   fillOpacity={0}
              //   stroke={
              //     obj.t == 1
              //       ? (obj.e && isEvent ? "red" : "#1F87FC")
              //       : obj.t == 2
              //       ? (obj.e && isEvent ? "red" : "#FFB900")
              //       : "transparent"
              //   }
              //   strokeWidth={strokeWidth}
              //   opacity={1}
              // />
              <g key={index}>
                {/* Top-left corner */}
                <line
                  x1={x}
                  y1={y}
                  x2={x + cornerWidthSize}
                  y2={y}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                />
                <line
                  x1={x}
                  y1={y}
                  x2={x}
                  y2={y + cornerHeightSize}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                />

                {/* Top-right corner */}
                <line
                  x1={width}
                  y1={y}
                  x2={width - cornerWidthSize}
                  y2={y}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                />
                <line
                  x1={width}
                  y1={y}
                  x2={width}
                  y2={y + cornerHeightSize}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                />

                {/* Bottom-left corner */}
                <line
                  x1={x}
                  y1={height}
                  x2={x + cornerWidthSize}
                  y2={height}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                />
                <line
                  x1={x}
                  y1={height}
                  x2={x}
                  y2={height - cornerHeightSize}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                />

                {/* Bottom-right corner */}
                <line
                  x1={width}
                  y1={height}
                  x2={width - cornerWidthSize}
                  y2={height}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                />
                <line
                  x1={width}
                  y1={height}
                  x2={width}
                  y2={height - cornerHeightSize}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                />
              </g>
            );
          }
        })}
      </g>
    }
    </SvgIcon>
  );
}

export default memo(Frames);
