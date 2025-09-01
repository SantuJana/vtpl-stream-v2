import React, { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { v4 } from "uuid";

export interface ConnOption {
  siteId: number;
  channelId: number;
  timestamp?: number;
  endTimestamp?: number;
  jobId?: number;
  eventId?: number;
  streamType?: 0 | 1;
  retry?: boolean;
  smallClip?: boolean;
  seekTimestamp?: number;
  wsUrl?: string;
}

type UseStreamReturn = {
  start: (option: ConnOption) => void;
  stop: () => void;
  loading: boolean;
};

export function useStreamT1(videoRef: RefObject<HTMLVideoElement | null>): UseStreamReturn {
    const wsRef = useRef<WebSocket | null>(null);
    const sourceBufferRef = useRef<SourceBuffer | null>(null);
    const frameQueueRef = useRef<Array<BufferSource>>([]);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const runtimeCheckingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const optionRef = useRef<ConnOption>({ siteId: 0, channelId: 0 });
    const lastFrameTimeRef = useRef<number | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

  const app = 0;
  const cloudIp = "<videoneticsAddr>";
  const bufferThreshold = 30;

  function processQueue() {
    if (!sourceBufferRef.current || sourceBufferRef.current.updating) return;
    const nextFrame = frameQueueRef.current.shift();
    if (nextFrame) {
      if (nextFrame instanceof Blob) {
        nextFrame.arrayBuffer().then((arrayBuffer) => {
          if (sourceBufferRef.current) {
            try { 
              sourceBufferRef.current.appendBuffer(arrayBuffer);
            } catch (err) {
              console.log("$$$$$ Error appending buffer:", err);
            }
          }
        });
      } else {
        if (sourceBufferRef.current) {
          try {
            sourceBufferRef.current.appendBuffer(nextFrame);// resolve when all frame pushed
          } catch (err) {
            console.log("$$$$$ Error appending buffer:", err);
          }
        }
      }
    }
  }


  function monitorBuffUsage() {
    if (sourceBufferRef.current?.updating) return;
    const buffered = sourceBufferRef.current?.buffered;
    const video = videoRef.current;
    if (buffered && video && buffered.length > 0) {
      const start = buffered.start(0);
      const current = video.currentTime;

      if (sourceBufferRef.current && current - start > bufferThreshold) {
        try {
          sourceBufferRef.current.remove(
            start,
            current - (bufferThreshold * 2) / 3
          );
        } catch (error) {
          console.error("$$$$==== Failed to remove used buffer");
        }
      }
    }
  }

  const reconnect = useCallback(() => {
    start(optionRef.current);
  }, [])

  const clearTimeoutCheck = useCallback(() => {
    if (timeoutRef.current){
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [])

  const clearRuntimeCheck = useCallback(() => {
    if (runtimeCheckingIntervalRef.current){
      clearInterval(runtimeCheckingIntervalRef.current);
      runtimeCheckingIntervalRef.current = null;
    }
  }, [])

  const addRuntimeChecking = useCallback(() => {
    clearRuntimeCheck();
    runtimeCheckingIntervalRef.current = setInterval(() =>{
      const video = videoRef.current;
      if (video){
        const currentTime = video.currentTime;
        if (lastFrameTimeRef.current && lastFrameTimeRef.current >= currentTime){
          reconnect();
          return;
        }
        lastFrameTimeRef.current = currentTime;
        const buffered = sourceBufferRef.current?.buffered;
        if (buffered && buffered.length > 0){
          const end = buffered.end(buffered.length - 1);
          if (end - currentTime > 3){
            video.currentTime = end;
          }
        }
      }
    }, 3000);
  }, [clearRuntimeCheck])

  const handleOnLoadedData = useCallback(() => {
    setLoading(false);
    lastFrameTimeRef.current = null;
    clearTimeoutCheck();
    addRuntimeChecking();
  }, [cleanupRefs, clearRuntimeCheck])

  function cleanupWebSocket() {
    if (wsRef.current) {
      wsRef.current.close(4000, "closed from client");
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.onopen = null;
    }
  }

  function cleanupVideo() {
    if (videoRef.current) {
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
  }

  function cleanupSourceBuffer() {
    if (sourceBufferRef.current) {
      sourceBufferRef.current = null;
    }
  }

  function cleanupRefs() {
    frameQueueRef.current = [];
  }

  const stop = useCallback(() => {
    clearRuntimeCheck();
    clearTimeoutCheck();
    cleanupWebSocket();
    cleanupVideo();
    cleanupSourceBuffer();
    cleanupRefs();
  }, []);

  const prepareConnectionString = useCallback((option: ConnOption) => {
    const BASE_STREAM_URL = option.wsUrl;
    // const BASE_STREAM_URL = "ws://172.16.1.16:8083";
    // const BASE_STREAM_URL = "wss://vsaasstreaming1.videonetics.com";

    let isLive = 1;

    const {
      siteId,
      channelId,
      timestamp,
      jobId,
      eventId,
      streamType: stream,
    } = option;

    if (timestamp && timestamp > 0) {
      isLive = 0;
    }

    let name =
      siteId +
      "/" +
      channelId +
      "/" +
      app +
      "/" +
      isLive +
      "/" +
      (stream || 0) +
      "/" +
      (timestamp || 0) +
      "/" +
      v4();

    if (jobId && eventId) {
      name = name + "/" + jobId + "/" + eventId;
    }

    const src = "videonetics://" + cloudIp + "/" + name;
    let wsUrl =
      "/v3/api/ws?name=" +
      encodeURIComponent(name) +
      "&src=" +
      encodeURIComponent(src);

    wsUrl = `${BASE_STREAM_URL}` + wsUrl;
    return wsUrl;
  }, []);

  const start = useCallback((option: ConnOption) => {
    stop();
    setLoading(true);
    optionRef.current = option;
    const wsUrl = prepareConnectionString(option);

    const mediaSource = new MediaSource();

    if (videoRef.current) {
      videoRef.current.src = URL.createObjectURL(mediaSource);
    }

    let codec: string | null = null;
    let sourceBuffer: SourceBuffer | null = null;

    // check for timeout
    clearTimeoutCheck();
    timeoutRef.current = setTimeout(() => {
      reconnect();
    }, 15000);

    wsRef.current = new WebSocket(wsUrl);
    wsRef.current.binaryType = "arraybuffer";

    wsRef.current.onopen = () => {
      wsRef.current?.send(JSON.stringify({ type: "mse", value: "" }));
    };

    wsRef.current.onmessage = (event) => {
      if (!event.data || typeof event.data === "string") {
        const message = event.data as string;
        const data: any = JSON.parse(message);
        if (data.type === "mse" && typeof data.value === "string" && !codec) {
          codec = data.value;
          if (
            mediaSource.readyState === "open" &&
            typeof codec === "string"
          ) {
            try {
              sourceBuffer = mediaSource.addSourceBuffer(codec);
              sourceBufferRef.current = sourceBuffer;
              sourceBuffer.addEventListener("updateend", () => {
                processQueue();
                monitorBuffUsage();
              });
            } catch (err) {
              console.log(
                "Error creating SourceBuffer with codec:",
                codec,
                err
              );
            }
          }
          return;
        } else if (data.type === 'error'){
          stop();
          return;
        }
        return;
      }
        if (!sourceBuffer) return;
        if (event.data instanceof ArrayBuffer) {
          frameQueueRef.current.push(event.data);
          processQueue();
          return;
        }
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.addEventListener("loadeddata", handleOnLoadedData);
    }

    return () => {
      if (video) {
        video.removeEventListener("loadeddata", handleOnLoadedData);
      }
    };
  }, [])

  return { stop, start, loading };
}
