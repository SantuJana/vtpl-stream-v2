'use client'
import Frames from "@/components/Frames";
import { useStream, VideoStates } from "@/hooks/useStream";
import moment from "moment";
import Image from "next/image";
import { use, useCallback, useEffect, useRef, useState } from "react";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [option, setOption] = useState({
    siteId: 1,
    channelId: 16,
    timestamp: 0,
    streamType: 1 as 0 | 1,
  });
  const svgRef = useRef<SVGSVGElement>(null);

  const { start, stop, pause, resume, goLive, frameByFrame, changePlaybackRate, metaDataRef, startTimeRef, videoStates, currentFrameMetadata } = useStream(videoRef);

  // Modularized Handlers
  const handleStart = useCallback(() => {
    start(option);
  }, [option, start, stop]);

  const handleStop = useCallback(() => {
    stop();
  }, [stop]);

  function handleOptionChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setOption((prev) => ({
      ...prev,
      [name]: value ? Number(value) : 0,
    }));
  }

  useEffect(() => {
    handleStop();
  }, [handleStop])

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-gray-100">
      <div className="w-1/2 h-1/2 bg-slate-400 relative">
        <div className={`absolute flex flex-row items-center gap-2 ms-2 mt-2 bg-white px-2 rounded z-50 ${videoStates.isLive ? "" : "cursor-pointer"}`} onClick={!videoStates.isLive ? goLive : undefined}>
          <div className={`w-1.5 h-1.5 rounded-full animate-ping ${videoStates.isLive ? 'bg-green-700' : "bg-red-600"}`}/>
          <p className="text-sm">{videoStates.isLive ? "Live" : "Go Live"}</p>
        </div>
        {
          videoStates.loading &&
          <div className="flex items-center justify-center h-full w-full absolute top-0">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        }
        <Frames frameInfo={currentFrameMetadata} isEvent={false} svgRef={svgRef} videoRef={videoRef} />
        <video ref={videoRef} className="absolute top-0 right-0 bottom-0 left-0 object-contain h-full w-full" autoPlay muted />
      </div>
      <div>
        <p>{currentFrameMetadata?.timeStamp ? moment(currentFrameMetadata?.timeStamp).format("YYYY-MM-DD HH:mm:ss") : ""}</p>
        {
          videoStates.statusText === "failed" &&
          <p className="bg-red-700 text-sm text-white">Failed</p>
        }
      </div>
      <div className="mt-4 flex flex-row w-1/2">
        <div className="w-1/2 bg-green-200 flex-1/2 flex flex-col align-middle p-2">
          <label htmlFor="videoStates.playbackRate" className="mr-2">Playback Rate :</label>
          <select name="videoStates.playbackRate" id="videoStates.playbackRate" value={videoStates.playbackRate} onChange={(e) => changePlaybackRate(Number(e.target.value))}>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="4">4</option>
            <option value="8">8</option>
          </select>
          <div className="flex flex-row align-middle gap-4 justify-center mt-3">
            <button className="bg-fuchsia-500 w-10 cursor-pointer" onClick={() => frameByFrame("backward")}>&#x23EE;</button>
            <button className="bg-fuchsia-500 w-10 cursor-pointer" onClick={() => frameByFrame("forward")}>&#x23ED;</button>
          </div>
          <div className="flex flex-row align-middle gap-4 justify-center mt-3">
            {
              videoStates.isPlaying ? (
                <button className="bg-amber-500 w-10 cursor-pointer" onClick={pause}>&#x23F8;</button>
              ) : (
                <button className="bg-green-500 w-10 cursor-pointer" onClick={resume}>&#9654;</button>
              )
            }
          </div>
          <div className="flex flex-row align-middle gap-4 justify-center mt-3">
            {
              videoStates.direction === "forward" ? (
                <button className=" w-10 cursor-pointer" onClick={() => changePlaybackRate(videoStates.playbackRate, "backward")}>&#x23EA;</button>
              ) : (
                <button className=" w-10 cursor-pointer" onClick={() => changePlaybackRate(videoStates.playbackRate, "forward")}>&#x23E9;</button>
              )
            }
          </div>
          {/* <div className="text-center mt-2">
            <button className="bg-red-300 w-24 cursor-pointer" onClick={handleClearQueue}>Clear Queue</button>
            <button className="bg-red-300 w-24 cursor-pointer" onClick={handle2sCut}>Cut 2s</button>
          </div> */}
        </div>
        <div className="w-1/2 bg-blue-200 flex-1/2 flex flex-col align-middle p-2">
          <label htmlFor="site">Site:</label>
          <input type="number" name="siteId" id="" value={option.siteId} className="ring-1" onChange={handleOptionChange} />
          <label htmlFor="channel">Channel:</label>
          <input type="number" name="channelId" id="" value={option.channelId} className="ring-1" onChange={handleOptionChange} />
          <label htmlFor="channel">Timestamp:</label>
          <input type="number" name="timestamp" id="" value={option.timestamp} className="ring-1" onChange={handleOptionChange} />
          <button className="bg-sky-400 mt-2 cursor-pointer" onClick={handleStart}>Start</button>
          <button className="bg-slate-400 mt-2 cursor-pointer" onClick={handleStop}>Stop</button>
        </div>
      </div>
    </div>
  );
}
