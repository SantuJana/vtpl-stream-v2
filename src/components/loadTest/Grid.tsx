import { FormData } from '@/app/load-test/page';
import { useStream } from '@/hooks/useStream';
import { useStreamT1 } from '@/hooks/useStreamT1';
import React, { useEffect, useRef, useState } from 'react'

interface FormDataLoc {
  siteIdLoc: number;
  channelIdLoc: number;
}

const initData = {
  siteIdLoc: 1,
  channelIdLoc: 16,
}

export default function Grid({ formData, startStream }: { formData: FormData, startStream: boolean }) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const { start, stop, loading } = useStreamT1(videoRef);
    const [formDataLoc, setFormDataLoc] = useState<FormDataLoc>(initData);

    const handleFormDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setFormDataLoc((prevData) => ({
        ...prevData,
        [name]: parseInt(value) || 0,
      }));
    };

    useEffect(() => {
      if (formData && startStream) {
          const option: any = {
              siteId: formDataLoc.siteIdLoc || formData.siteId,
              channelId: formDataLoc.channelIdLoc || formData.channelId,
              timestamp: formData.timestamp,
              streamType: 0,
              wsUrl: formData.wsUrl,
          }

          start(option);
      } else {
        stop();
      }
      return () => stop();
    }, [formData, startStream, formDataLoc])

  return (
    <div className='bg-red-100 absolute top-0 start-0 end-0 bottom-0 h-full w-full flex flex-col'>
      <div className='bg-green-200 h-7 w-full shrink-0 flex flex-row items-center px-1 gap-1'>
        site: <input value={formDataLoc.siteIdLoc} onChange={handleFormDataChange} type="number" name="siteIdLoc" id="siteIdLoc" placeholder='Site ID' className='border w-12' />
        channel: <input value={formDataLoc.channelIdLoc} onChange={handleFormDataChange} type="number" name="channelIdLoc" id="channelIdLoc" placeholder='Channel ID' className='border w-12' />
      </div>
      <video ref={videoRef} autoPlay muted controls={false} className="grow object-contain"/>
      {
        loading &&
        <div className='absolute inset-0 top-7 flex justify-center items-center'>
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    </div>

  )
}
