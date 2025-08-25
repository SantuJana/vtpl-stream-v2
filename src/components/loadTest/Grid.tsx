import { FormData } from '@/app/load-test/page';
import { useStream } from '@/hooks/useStream';
import { useStreamT1 } from '@/hooks/useStreamT1';
import React, { useEffect, useRef } from 'react'

export default function Grid({ formData, startStream }: { formData: FormData, startStream: boolean }) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const { start, stop } = useStreamT1(videoRef);

    useEffect(() => {
      if (formData && startStream) {
          const option: any = {
              siteId: formData.siteId,
              channelId: formData.channelId,
              timestamp: formData.timestamp,
              streamType: 0
          }

          start(option);
      } else {
        stop();
      }
      return () => stop();
    }, [formData, startStream])

  return (
    <video ref={videoRef} autoPlay muted controls={false} className="bg-red-100 left-0 absolute top-0 start-0 end-0 bottom-0 h-full w-full object-contain"/>
  )
}
