"use client";

import { use } from "react";
import VideoCallRoom from "@/components/VideoCallRoom";

export default function CallPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);

  return (
    <section className="card">
      <VideoCallRoom roomId={roomId} title={`Call · ${roomId.slice(0, 8)}`} />
    </section>
  );
}
