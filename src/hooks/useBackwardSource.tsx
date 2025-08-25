import axios from "axios";
import React, { useCallback, useRef } from "react";
import { uuid } from "uuidv4";

type UseBackwardSourceReturn = {
  loadPrevData: (toTime: number, option: ConnOption) => Promise<any>;
};

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

type SiteStreamUrls = { siteId: number; host: string; port: number };

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
}

export default function useBackwardSource(): UseBackwardSourceReturn {
  const frameQueueRef = useRef<Array<BufferSource>>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const startTimeRef = useRef<number>(0);
  const metaDataRef = useRef<FrameMetaData[]>([]);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);

  const app = 0;
  const cloudIp = "<videoneticsAddr>";
  const sessionId = uuid();

  // soft stop
  const softStop = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(4000, "soft close from client");
    }
  }, []);

  // create connection string
  const prepareConnectionString = useCallback(async (option: ConnOption) => {
    const BASE_STREAM_URL = "ws://172.16.1.16:8083";
    // const BASE_STREAM_URL = "wss://vsaasstreaming4.videonetics.com";
    // const BASE_STREAM_URL = "ws://172.16.2.143:8083";
    // const BASE_STREAM_URL = "ws://172.16.1.144:8083";
    // const BASE_STREAM_URL = "ws://127.0.0.1:8083";
    // const BASE_STREAM_URL = "wss://vsaasstreaming1.videonetics.com";

    const TEST_MODE = true;

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
      "/v3/api/ws?name=" +
      encodeURIComponent(name) +
      "&src=" +
      encodeURIComponent(src);

    wsUrl = `${TEST_MODE ? BASE_STREAM_URL : baseWsURL}` + wsUrl;
    return wsUrl;
  }, []);

  const loadPrevData = useCallback(
    async (toTime: number, option: ConnOption) => {
      let resolve: (arg0: {
        frameQueue: Array<BufferSource>,
        startTime: number;
        metaData: FrameMetaData[];
      }) => void = () => {};
      let reject: (reason?: any) => void = () => {};
      const promise = new Promise<{
        frameQueue: Array<BufferSource>;
        startTime: number;
        metaData: FrameMetaData[];
      }>((res, rej) => {
        resolve = res;
        reject = rej;
      });

      const start = toTime - 1 * 60 * 1000;
      const option1 = { ...option, timestamp: start, endTimestamp: toTime };
                console.log("$$$$$===== 1 =====$$$$$", option1);

      const connString = await prepareConnectionString(option1);
      if (!connString) {
        reject();
        return;
      }

      wsRef.current = new WebSocket(connString);
      wsRef.current.binaryType = "arraybuffer";

      wsRef.current.onopen = () => {
        wsRef.current?.send(JSON.stringify({ type: "mse", value: "" }));
      };

      wsRef.current.onmessage = (event) => {
        if (!event.data || typeof event.data === "string") {
          const message = event.data as string;
          const data: any = JSON.parse(message);
           if (data.type === "error") {
            stop();
            return;
          } else if (data instanceof Array) {
            // close the socket on end time reach
            if (data[data.length - 1].timeStamp >= (option1.endTimestamp || 0)) {
              softStop();
              // Wait for all buffered data before resolving
            //   if (sourceBuffer && !sourceBuffer.updating) {
                // mediaSource.endOfStream(); // Signal that no more data will be added
                const promiseData = {
                    startTime: startTimeRef.current,
                    metaData: metaDataRef.current,
                    frameQueue: frameQueueRef.current,
                };
                resolve(promiseData);
            } 
            // else {
            //       console.log("$$$$$===== 2 =====$$$$$", sourceBuffer , sourceBufferRef.current, );

            //   }
            // }

            !!!startTimeRef.current &&
              (startTimeRef.current = data[0].timeStamp);
            metaDataRef.current = [...metaDataRef.current, ...data];
          }
          return;
        }
        if (event.data instanceof ArrayBuffer) {
          frameQueueRef.current.push(event.data);
          return;
        } else if (event.data instanceof Uint8Array) {
          frameQueueRef.current.push(event.data.slice().buffer);
          return;
        } else if (event.data instanceof Blob) {
          event.data.arrayBuffer().then((arrayBuffer) => {
            frameQueueRef.current.push(arrayBuffer);
            return;
          });
        }
      };

      wsRef.current.onclose = () => {
        reject();
      };

      return promise;
    },
    []
  );
  return { loadPrevData };
}
