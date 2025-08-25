"use client";

import Grid from "@/components/loadTest/Grid";
import React, { useCallback, useEffect, useRef, useState } from "react";

export type FormData = {
  siteId: number;
  channelId: number;
  timestamp: number;
  grid: number;
};

const initFormData = {
  siteId: 16,
  channelId: 35,
  timestamp: 0,
  grid: 1,
};

export default function LoadTest() {
  const [formData, setFormData] = useState<FormData>(initFormData);
  const [start, setStart] = useState<boolean>(false);
  const [throttleValue, setThrottleValue] = useState<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFormDataChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
    },
    []
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setStart(true);
    },
    [formData]
  );

  const clearTimeoutOrInterval = useCallback(() => {
    if (intervalRef.current){
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current){
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [])

  const handleStop = () => {
    clearTimeoutOrInterval();
    setStart(false);
  };

  const handleStartThrottling = useCallback(() => {
    if (throttleValue < 5) {
      alert("Throttle value should be greater than 5");
      return;
    };
    if (intervalRef.current || timeoutRef.current) return;
    clearTimeoutOrInterval();
    intervalRef.current = setInterval(() => {
      setStart(false);
      timeoutRef.current = setTimeout(() => setStart(true), 2000);
    }, throttleValue * 1000)
  }, [throttleValue])

  return (
    <div className="bg-red-100 h-screen flex flex-col">
      <form method="post" onSubmit={handleSubmit} className="shrink-0">
        <div className="flex flex-row items-center gap-5 p-3 w-full bg-slate-200">
          <div className="flex flex-row items-center gap-1">
            <label htmlFor="siteId">Site Id:</label>
            <input
              type="number"
              name="siteId"
              id="siteId"
              value={formData.siteId}
              onChange={handleFormDataChange}
              className="border p-1 rounded"
            />
          </div>
          <div className="flex flex-row items-center gap-1">
            <label htmlFor="channelId">Channel Id:</label>
            <input
              type="number"
              name="channelId"
              id="channelId"
              value={formData.channelId}
              onChange={handleFormDataChange}
              className="border p-1 rounded"
            />
          </div>
          <div className="flex flex-row items-center gap-1">
            <label htmlFor="timestamp">Start Timestamp:</label>
            <input
              type="number"
              name="timestamp"
              id="timestamp"
              value={formData.timestamp}
              onChange={handleFormDataChange}
              className="border p-1 rounded"
            />
          </div>
          <div className="flex flex-row items-center gap-1">
            <label htmlFor="grid">Grid:</label>
            <select
              name="grid"
              id="grid"
              value={formData.grid}
              onChange={handleFormDataChange}
              className="rounded border-1 px-1 py-1.5"
            >
              <option value={1}>1 x 1</option>
              <option value={2}>2 x 2</option>
              <option value={3}>3 x 3</option>
              <option value={4}>4 x 4</option>
              <option value={5}>5 x 5</option>
              <option value={6}>6 x 6</option>
              <option value={7}>7 x 7</option>
              <option value={8}>8 x 8</option>
              <option value={9}>9 x 9</option>
              <option value={10}>10 x 10</option>
            </select>
          </div>
          <button
            type="submit"
            className="bg-slate-500 hover:bg-slate-600 px-3 py-1 rounded-2xl text-slate-50 cursor-pointer"
          >
            Start
          </button>
          <button
            type="button"
            className="bg-sky-500 hover:bg-sky-600 px-3 py-1 rounded-2xl text-slate-50 cursor-pointer"
            onClick={handleStop}
          >
            Stop
          </button>
        </div>
        <div className="flex flex-row items-center gap-5 p-3 w-full bg-slate-200">
          <div className="flex flex-row items-center gap-1">
            <label htmlFor="timestamp">Throttle Time In Seconds:</label>
            <input
              type="number"
              name="timestamp"
              id="timestamp"
              value={throttleValue}
              onChange={(e: any) => setThrottleValue(e.target.value)}
              className="border p-1 rounded"
            />
          </div>
          <button
            type="button"
            className="bg-sky-500 hover:bg-sky-600 px-3 py-1 rounded-2xl text-slate-50 cursor-pointer"
            onClick={handleStartThrottling}
          >
            Start Throttling
          </button>
        </div>
      </form>
      <div className="bg-amber-100 h-full">
        {
          <div
            className="grid h-full p-4 gap-4"
            style={{
              gridTemplateColumns: `repeat(${formData.grid}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${formData.grid}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: formData.grid * formData.grid }, (_, i) => (
              <div
                key={i}
                className="bg-white rounded-lg shadow-md flex items-center justify-center overflow-hidden relative"
              >
                <Grid formData={formData} startStream={start} />
              </div>
            ))}
          </div>
        }
      </div>
    </div>
  );
}
