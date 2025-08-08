import axios from "axios";
import {
  useRef,
  useCallback,
  useEffect,
  RefObject,
  useState,
  useMemo,
} from "react";
import { v4 as uuidv4 } from "uuid";

type UseStreamReturn = {
  start: (option: ConnOption) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  goLive: () => void;
  frameByFrame: (direction: Direction) => void;
  setVideoStates: (vState: VideoStates) => void;
  changePlaybackRate: (rate: number, direction?: Direction) => void;
  skip10Sec: (direction: Direction) => void;
  seek: (timestamp: number) => void;
  startTimeRef: RefObject<number>;
  metaDataRef: RefObject<FrameMetaData[]>;
  videoStates: VideoStates;
  currentFrameMetadata: FrameMetaData | null;
};

type SiteStreamUrls = { siteId: number; host: string; port: number };

type Direction = "forward" | "backward";

export interface ConnOption {
  siteId: number;
  channelId: number;
  timestamp?: number;
  endTimestamp?: number;
  jobId?: number;
  eventId?: number;
  streamType?: 0 | 1;
  retry?: boolean;
}

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

interface FrameMetaData {
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
  index?: number;
}

export interface VideoStates {
  isLive: boolean;
  isPlaying: boolean;
  direction: Direction;
  playbackRate: number;
  isFrameByFrame: boolean;
  loading: boolean;
  statusText: string | null;
}

const initVideoState = {
  isLive: true,
  isPlaying: true,
  direction: "forward" as Direction,
  playbackRate: 1,
  isFrameByFrame: false,
  loading: false,
  statusText: null,
};

export function useStream(
  videoRef: RefObject<HTMLVideoElement | null>
): UseStreamReturn {
  // Queue for incoming video frames
  const frameQueueRef = useRef<Array<BufferSource>>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const sourceOpenHandlerRef = useRef<
    ((this: MediaSource, ev: Event) => any) | null
  >(null);
  const startTimeRef = useRef<number>(0);
  const metaDataRef = useRef<FrameMetaData[]>([]);
  const heartBeatIntervalIdRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const commandIdRef = useRef<string | null>(null);
  const sessionId = useMemo(() => uuidv4(), []);
  const [videoStates, setVideoStates] = useState<VideoStates>(initVideoState);
  const videoStateRef = useRef<VideoStates>(initVideoState);
  const optionRef = useRef<ConnOption>({ siteId: 0, channelId: 0 });
  const [currentFrameMetadata, setCurrentFrameMetadata] =
    useState<FrameMetaData | null>(null);
  const lastPlayTimeRef = useRef<number>(0);
  const retryingRef = useRef<boolean>(false);
  const retryCountRef = useRef<number>(0);
  const retryIntervalIdRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const app = 0;
  const cloudIp = "<videoneticsAddr>";
  const bufferThreshold = 30;
  const fps = 10;

  useEffect(() => {
    videoStateRef.current = videoStates;
  }, [videoStates]);

  function genCommandId() {
    commandIdRef.current = uuidv4();
    return commandIdRef.current;
  }

  function pauseStream() {
    const payload = {
      type: "command",
      value: "pause",
      id: genCommandId(),
    };

    wsRef.current && wsRef.current.send(JSON.stringify(payload));
  }

  function resumeStream() {
    const payload = {
      type: "command",
      value: "resume",
      id: genCommandId(),
    };

    wsRef.current && wsRef.current.send(JSON.stringify(payload));
  }

  function monitorBuffUsage() {
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
          // console.error("$$$$==== Failed to remove used buffer");
        }
      }
    }
  }

  // seek to time handler for live
  function seekVideoToCurrentTime() {
    try {
      const video = videoRef.current;
      const buffered = sourceBufferRef.current?.buffered;
      if (video && buffered && buffered.length > 0) {
        const end = buffered.end(buffered.length - 1);
        const currentTime = video.currentTime;
        if (currentTime && end > currentTime && end - currentTime >= 3.0) {
          video.currentTime = end;
        }
      }
    } catch (error) {}
  }

  function cleanupWebSocket() {
    if (wsRef.current) {
      wsRef.current.close(4000, "closed from client");
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.onopen = null;
      // wsRef.current will be set to null in the onclose handler
    }
  }

  function cleanupVideo() {
    if (videoRef.current) {
      // videoRef.current.removeAttribute("src");
      // videoRef.current.load();
    }
  }

  function cleanupMediaSource() {
    if (mediaSourceRef.current) {
      if (sourceOpenHandlerRef.current) {
        mediaSourceRef.current.removeEventListener(
          "sourceopen",
          sourceOpenHandlerRef.current
        );
        sourceOpenHandlerRef.current = null;
      }
      mediaSourceRef.current = null;
    }
  }

  function cleanupSourceBuffer() {
    if (sourceBufferRef.current) {
      sourceBufferRef.current = null;
    }
  }

  function cleanupRefs() {
    frameQueueRef.current = [];
    startTimeRef.current = 0;
    metaDataRef.current = [];
  }

  // playback rate change handler
  const changePlaybackRate = useCallback(
    (rate: number, direction?: Direction) => {
      if (videoStateRef.current.isLive) return;
      setVideoStates((prevState) => ({
        ...prevState,
        playbackRate: rate,
        direction: direction || videoStateRef.current.direction,
      }));
    },
    []
  );

  // skip 10 sec
  const skip10Sec = useCallback((direction: Direction) => {
    if (videoStateRef.current.isLive) return;
    const video = videoRef.current;
    if (video) {
      const offset = 10;
      let currentTime = video.currentTime;
      currentTime =
        direction === "forward" ? currentTime + offset : currentTime - offset;
      video.currentTime = Math.max(0, currentTime);
    }
  }, []);

  // frame by frame handler
  const frameByFrame = useCallback((direction: Direction) => {
    if (videoStateRef.current.isLive) return;
    videoStateRef.current.isPlaying &&
      setVideoStates((prevState) => ({ ...prevState, isPlaying: false }));
    const video = videoRef.current;
    if (video) {
      const offset = 1 / fps;
      let currentTime = video.currentTime;
      currentTime =
        direction === "forward" ? currentTime + offset : currentTime - offset;
      video.currentTime = Math.max(0, currentTime);
    }
  }, []);

  // video pause handler
  const pause = useCallback(() => {
    if (videoStateRef.current.isLive) {
      const option: ConnOption = {
        siteId: optionRef.current.siteId,
        channelId: optionRef.current.channelId,
        timestamp: Date.now(),
        streamType: optionRef.current.streamType || 0,
      };
      start(option);
    }
    setVideoStates((prevState) => ({ ...prevState, isPlaying: false }));
  }, []);

  // video resume handler
  const resume = useCallback(() => {
    setVideoStates((prevState) => ({ ...prevState, isPlaying: true }));
  }, []);

  // seek handler
  const seek = useCallback((timestamp: number) => {
    const option: ConnOption = {
      siteId: optionRef.current.siteId,
      channelId: optionRef.current.channelId,
      timestamp,
      streamType: optionRef.current.streamType,
    };
    start(option);
  }, []);

  // go live handler
  const goLive = useCallback(() => {
    const option: ConnOption = {
      siteId: optionRef.current.siteId,
      channelId: optionRef.current.channelId,
      timestamp: 0,
      streamType: optionRef.current.streamType || 0,
    };
    start(option);
  }, []);

  // stop heart bit interval
  const stopHeartBit = () => {
    if (heartBeatIntervalIdRef.current) {
      clearInterval(heartBeatIntervalIdRef.current);
      heartBeatIntervalIdRef.current = null;
    }
  };

  // send socket heart bit on 30 sec of interval
  const sendHeartBit = (ws: WebSocket) => {
    stopHeartBit();
    const payload = { type: "heartBit", sessionId: sessionId };
    heartBeatIntervalIdRef.current = setInterval(
      () => ws?.send(JSON.stringify(payload)),
      30000
    );
  };

  // handle resume pause
  let autoPaused = useRef<boolean>(false);
  const handleAutoPause = useCallback(() => {
    const buffered = sourceBufferRef.current?.buffered;
    const video = videoRef.current;
    if (buffered && video && buffered.length > 0) {
      const current = video.currentTime;
      const end = buffered.end(buffered.length - 1);
      if (end - current > bufferThreshold) {
        !autoPaused.current && ((autoPaused.current = true), pauseStream());
      } else if (end - current < bufferThreshold * (2 / 3)) {
        autoPaused.current && ((autoPaused.current = false), resumeStream());
      }
    }
  }, []);

  const handleAutoResume = useCallback(() => {
    const buffered = sourceBufferRef.current?.buffered;
    const video = videoRef.current;
    if (buffered && video && buffered.length > 0) {
      const current = video.currentTime;
      const end = buffered.end(buffered.length - 1);
      if (end - current < bufferThreshold * (2 / 3)) {
        autoPaused.current && ((autoPaused.current = false), resumeStream());
      }
    }
  }, []);

  // update current frame metadata handler
  const updateFrameMeta = useCallback(
    (now: DOMHighResTimeStamp, meta: VideoFrameCallbackMetadata) => {
      const currentVideoTime = Math.ceil(meta.mediaTime * 1000);
      const currentPlayTime = startTimeRef.current + currentVideoTime;
      const metaData = metaDataRef.current.reduce(
        (nearest, item, index) => {
          return Math.abs(item.timeStamp - currentPlayTime) >
            Math.abs(nearest.timeStamp - currentPlayTime)
            ? nearest
            : { ...item, index };
        },
        { ...(metaDataRef.current[0] || {}), index: 0 }
      );
      setCurrentFrameMetadata(metaData);
      lastPlayTimeRef.current = metaData.timeStamp;
      const diff = metaData.timeStamp - currentPlayTime;
      if (diff > 100) {
        console.log("$$$$$===== meta diff: ", diff);
      }
      videoRef.current?.requestVideoFrameCallback(updateFrameMeta);
      if (metaData)
        metaDataRef.current = metaDataRef.current.slice(
          Math.max(0, (metaData.index || 0) - 50)
        );
    },
    []
  );

  // handle video on loaded
  const handleVideoLoaded = useCallback(() => {
    clrRetryInterval();
    clrTimeout();
    retryCountRef.current = 0;
    retryingRef.current = false;

    setVideoStates((prevState) => ({
      ...prevState,
      loading: false,
      statusText: null,
    }));
    videoRef.current &&
      (videoRef.current.playbackRate = videoStateRef.current.playbackRate);
    videoRef.current &&
      videoRef.current.requestVideoFrameCallback(updateFrameMeta);
    !videoStateRef.current.isPlaying && videoRef.current?.pause();
  }, [updateFrameMeta]);

  // video error handler function
  const handleError = useCallback(() => {
    if (retryCountRef.current === 3)
      setVideoStates((prevState) => ({ ...prevState, statusText: "failed" }));
    if (retryingRef.current || retryCountRef.current >= 3) return;
    retryingRef.current = true;
    console.log("$$$$$===== video error occurred");
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    const option: ConnOption = {
      siteId: optionRef.current.siteId,
      channelId: optionRef.current.channelId,
      streamType: optionRef.current.streamType || 0,
      timestamp: videoStateRef.current.isLive ? 0 : lastPlayTimeRef.current,
      retry: true,
    };
    retryIntervalIdRef.current = setInterval(() => start(option), 5000);
  }, []);

  // timeout error handler function
  const handleTimeOut = useCallback(() => {
    setVideoStates((prevState) => ({
      ...prevState,
      statusText: "failed",
      loading: false,
    }));
    stop();
  }, []);

  // clear timeout
  const clrTimeout = useCallback(() => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
  }, []);

  // clear retry interval
  const clrRetryInterval = useCallback(() => {
    if (retryIntervalIdRef.current) {
      clearInterval(retryIntervalIdRef.current);
      retryIntervalIdRef.current = null;
    }
  }, []);

  // create connection string
  const prepareConnectionString = useCallback(async (option: ConnOption) => {
    // const BASE_STREAM_URL = "ws://172.16.1.16:8083";
    // const BASE_STREAM_URL = "wss://vsaasstreaming1.videonetics.com";
    // const BASE_STREAM_URL = "ws://172.16.2.143:8083";
    // const BASE_STREAM_URL = "ws://172.16.1.144:8083";
    const BASE_STREAM_URL = "ws://127.0.0.1:8083";

    let baseWsURL: string = "";
    let isLive = 1;

    const {
      siteId,
      channelId,
      timestamp,
      jobId,
      eventId,
      streamType: stream,
    } = option;

    const payload: any = {
      channelid: channelId,
      resolutionheight: 1080,
      resolutionwidth: 1920,
      withaudio: true,
    };
    const protocol = window.location.protocol;
    // const protocol = `https:`;
    const wsProtocol = protocol === "https:" ? "wss" : "ws";

    let siteStreamUrls = [];
    let siteStreamUrlsData: string | null =
      localStorage.getItem("siteStreamUrls");
    if (siteStreamUrlsData && siteStreamUrlsData !== "") {
      siteStreamUrls = JSON.parse(siteStreamUrlsData);
    }

    const streamUrl: SiteStreamUrls | undefined = siteStreamUrls.find(
      (site: SiteStreamUrls) => site.siteId == siteId
    );
    try {
      let response: any;
      if (!streamUrl) {
        if (timestamp === 0) {
          const apiURL: string = `/v-apiserver/REST/${siteId}/startlive`;
          // response = await axios.post(apiURL, payload);
        } else if (timestamp && timestamp > 0) {
          const apiURL: string = `/v-apiserver/REST/${siteId}/startarchive`;
          payload.starttimestamp = timestamp;
          // response = await axios.post(apiURL, payload);
        }
      }
      const host =
        streamUrl?.host ||
        response?.data?.result?.[0]?.streamingserveraddresspublic;
      const port =
        wsProtocol === "wss"
          ? 443
          : streamUrl?.port || response?.data?.result?.[0]?.streamingserverport;
      baseWsURL = `${wsProtocol}://${host}:${port}`;
      // set the fetched stream urls to local storage
      if (!streamUrl) {
        siteStreamUrls.push({ siteId: siteId, host, port });
        localStorage.setItem("siteStreamUrls", JSON.stringify(siteStreamUrls));
      }
    } catch (error: any) {
      handleError();
      return;
    }

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
      sessionId;

    if (jobId && eventId) {
      name = name + "/" + jobId + "/" + eventId;
    }

    const src = "videonetics://" + cloudIp + "/" + name;
    let wsUrl =
      "/api/ws?name=" +
      encodeURIComponent(name) +
      "&src=" +
      encodeURIComponent(src);

    // wsUrl = `${baseWsURL}` + wsUrl;
    wsUrl = `${BASE_STREAM_URL}` + wsUrl;
    return wsUrl;
  }, []);

  // handle start function
  const start = useCallback(
    async (option: ConnOption) => {
      optionRef.current = option;
      if (option.retry) {
        retryCountRef.current++;
      } else {
        retryCountRef.current = 0;
        retryingRef.current = false;
      }

      if (retryCountRef.current >= 3) clrRetryInterval();

      // add listener for timeout
      clrTimeout();
      timeoutIdRef.current = setTimeout(handleTimeOut, 20000);

      let isLive = !((option.timestamp || 0) > 0);
      setVideoStates((prevState) => ({
        ...prevState,
        loading: true,
        isPlaying: true,
        isLive,
        isFrameByFrame: false,
        direction: "forward",
        playbackRate: isLive ? 1 : videoStateRef.current.playbackRate,
        statusText: "loading",
      }));
      stop();
      startTimeRef.current = 0;
      metaDataRef.current = [];
      const connectionString = await prepareConnectionString(option);
      if (!connectionString) {
        handleError();
        return;
      }
      // if (wsRef.current) return; // Already started
      const mediaSource = new MediaSource();
      mediaSourceRef.current = mediaSource;
      if (videoRef.current) {
        videoRef.current.src = URL.createObjectURL(mediaSource);
      }

      let codec: string | null = null;
      let sourceBuffer: SourceBuffer | null = null;

      function processQueue() {
        if (!sourceBuffer || sourceBuffer.updating) return;
        const nextFrame = frameQueueRef.current.shift();
        if (nextFrame) {
          if (nextFrame instanceof Blob) {
            nextFrame.arrayBuffer().then((arrayBuffer) => {
              if (sourceBuffer) {
                try {
                  sourceBuffer.appendBuffer(arrayBuffer);
                } catch (err) {
                  console.log("$$$$$ Error appending buffer:", err);
                }
              }
            });
          } else {
            if (sourceBuffer) {
              try {
                sourceBuffer.appendBuffer(nextFrame);
              } catch (err) {
                console.log("$$$$$ Error appending buffer:", err);
              }
            }
          }
        }
      }

      mediaSource.addEventListener("sourceopen", () => {
        // Wait for codec info from WebSocket before creating SourceBuffer
      });

      wsRef.current = new WebSocket(connectionString);
      wsRef.current.binaryType = "arraybuffer";

      wsRef.current.onopen = () => {
        wsRef.current?.send(JSON.stringify({ type: "mse", value: "" }));
        wsRef.current && sendHeartBit(wsRef.current);
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
                  !isLive && handleAutoPause();
                  processQueue();
                  // cleanupBuffer();
                  isLive && seekVideoToCurrentTime();
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
            setVideoStates(prevState => ({...prevState, statusText: "failed", loading: false}));
            stop();
            return;
          } else if (data instanceof Array) {
            !!!startTimeRef.current &&
              (startTimeRef.current = data[0].timeStamp);
            metaDataRef.current = [...metaDataRef.current, ...data];
            // if (metaDataRef.current.length > 50){
            //   metaDataRef.current = metaDataRef.current.slice(-50);
            // }
            // data.map(element => console.log("$$$$$=====", element.timeStamp))
          }
          return;
        }
        if (!sourceBuffer) return;
        if (event.data instanceof ArrayBuffer) {
          frameQueueRef.current.push(event.data);
          processQueue();
          return;
        } else if (event.data instanceof Uint8Array) {
          frameQueueRef.current.push(event.data.slice().buffer);
          return;
        } else if (event.data instanceof Blob) {
          event.data.arrayBuffer().then((arrayBuffer) => {
            frameQueueRef.current.push(arrayBuffer);
            processQueue();
            return;
          });
        }
      };

      wsRef.current.onclose = function (e) {
        if (wsRef.current === this) {
          wsRef.current = null;
          stopHeartBit();
          if (e.code !== 4000) handleError();
          console.log("$$$$$ WebSocket connection closed");
        }
      };

      wsRef.current.onerror = handleError;
    },
    [prepareConnectionString]
  );

  // handle stop functionality
  const stop = useCallback(() => {
    cleanupWebSocket();
    cleanupVideo();
    cleanupMediaSource();
    cleanupSourceBuffer();
    cleanupRefs();
  }, []);

  // stop connection on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  // set time update event listener on archive play
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.addEventListener("timeupdate", handleAutoResume);
      video.addEventListener("loadeddata", handleVideoLoaded);
      video.addEventListener("error", handleError);
    }

    return () => {
      video?.removeEventListener("timeupdate", handleAutoResume);
      video?.removeEventListener("loadeddata", handleVideoLoaded);
      video?.removeEventListener("error", handleError);
    };
  }, [videoStates.isLive, handleAutoResume, handleVideoLoaded, handleError]);

  // control play pause of video player based on state value
  useEffect(() => {
    if (videoStates.isPlaying) {
      videoRef.current?.play();
    } else {
      videoRef.current?.pause();
    }
  }, [videoStates.isPlaying]);

  // handle playback rate change and on backward also
  useEffect(() => {
    let intervalId: any = null;
    const isForward = videoStates.direction === "forward";
    function reversePlay() {
      if (videoRef.current && videoRef.current.currentTime > 0)
        videoRef.current.currentTime -= 1 / fps;
      else {
        clearInterval(intervalId);
        intervalId = null;
      }
    }
    if (videoRef.current && !isForward) {
      videoRef.current.pause();
      intervalId = setInterval(
        reversePlay,
        1000 / (fps * videoStates.playbackRate)
      );
    } else {
      if (videoRef.current) {
        videoRef.current.play();
        videoRef.current.playbackRate = videoStates.playbackRate;
        setVideoStates({ ...videoStates, isPlaying: true });
      }
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  }, [videoStates.playbackRate, videoStates.direction]);

  // clear retry handler interval on unmount
  useEffect(() => {
    return () => {
      console.log("$$$$$===== removed");
      clrRetryInterval();
      clrTimeout();
    };
  }, []);

  return {
    start,
    stop,
    pause,
    resume,
    goLive,
    frameByFrame,
    setVideoStates,
    changePlaybackRate,
    skip10Sec,
    seek,
    startTimeRef,
    metaDataRef,
    videoStates,
    currentFrameMetadata,
  };
}
