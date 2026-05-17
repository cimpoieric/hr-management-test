"use client";

import { DashboardDemoPreview } from "@/components/DashboardDemoPreview";
import { Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface VideoPlayerProps {
  /** Optional MP4 � mockup preview is shown when missing or unavailable */
  src?: string;
  poster?: string;
}

export default function VideoPlayer({ src, poster }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [hasVideo, setHasVideo] = useState(Boolean(src));
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    setHasVideo(Boolean(src));
    setVideoReady(false);
    setIsPlaying(false);
  }, [src]);

  const useMockupOnly = !hasVideo || !videoReady;

  const togglePlay = useCallback(() => {
    if (useMockupOnly) {
      setIsPlaying((prev) => !prev);
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      void video.play();
    }
  }, [isPlaying, useMockupOnly]);

  const toggleMute = () => {
    if (useMockupOnly) {
      setIsMuted((m) => !m);
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    const target = containerRef.current;
    if (!target) return;
    void target.requestFullscreen?.();
  };

  const handleVideoError = () => {
    setHasVideo(false);
    setVideoReady(false);
    setIsPlaying(false);
  };

  const showVideoLayer = hasVideo && videoReady && isPlaying;

  return (
    <div
      ref={containerRef}
      className="group relative mx-auto w-full max-w-5xl overflow-hidden rounded-2xl"
      style={{
        background: "rgba(11, 17, 32, 0.8)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow:
          "0 20px 60px rgba(0, 0, 0, 0.4), 0 0 40px rgba(45, 98, 255, 0.1)",
      }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(isPlaying)}
    >
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-2xl"
        style={{
          padding: "1px",
          background:
            "linear-gradient(135deg, rgba(45,98,255,0.4), rgba(123,97,255,0.2), rgba(0,201,167,0.3))",
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />

      <div
        className="relative z-20 flex items-center gap-2 border-b px-4 py-3"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-500/70" />
          <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
          <span className="h-3 w-3 rounded-full bg-green-500/70" />
        </div>
        <span
          className="ml-4 flex-1 rounded-md px-3 py-1 text-center font-mono text-xs"
          style={{
            background: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.4)",
          }}
        >
          vecto.ro/dashboard
        </span>
      </div>

      <div className="relative z-20 aspect-video overflow-hidden bg-[#0B1120]">
        {/* App dashboard mockup � always visible as product thumbnail */}
        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{ opacity: showVideoLayer ? 0 : 1 }}
        >
          <DashboardDemoPreview isPlaying={useMockupOnly && isPlaying} />
        </div>

        {hasVideo && src ? (
          <video
            ref={videoRef}
            src={src}
            poster={poster}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
            style={{ opacity: showVideoLayer ? 1 : 0 }}
            loop
            muted={isMuted}
            playsInline
            preload="metadata"
            onClick={togglePlay}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onLoadedData={() => setVideoReady(true)}
            onCanPlay={() => setVideoReady(true)}
            onError={handleVideoError}
          />
        ) : null}

        {/* Subtle vignette + scan line when "playing" mockup */}
        {useMockupOnly && isPlaying ? (
          <div
            className="demo-scan-line pointer-events-none absolute inset-0 z-[5]"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(45,98,255,0.06) 50%, transparent 100%)",
            }}
          />
        ) : null}

        <div
          className="pointer-events-none absolute inset-0 z-[6]"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 40%, transparent 70%, rgba(0,0,0,0.2) 100%)",
          }}
        />

        {!isPlaying && (
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
              style={{
                background: "linear-gradient(135deg, #2D62FF, #7B61FF)",
                boxShadow: "0 8px 32px rgba(45, 98, 255, 0.5)",
              }}
              aria-label="Play product demo"
            >
              <Play className="ml-1 h-8 w-8 fill-white text-white" />
            </button>
          </div>
        )}

        {isPlaying && useMockupOnly ? (
          <div className="absolute left-4 top-4 z-20">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white"
              style={{ background: "rgba(220, 38, 38, 0.85)" }}
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              Live preview
            </span>
          </div>
        ) : null}

        <div
          className="absolute bottom-0 left-0 right-0 z-20 flex items-center gap-3 px-4 py-3 transition-opacity duration-300"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)",
            opacity: showControls || !isPlaying ? 1 : 0,
          }}
        >
          <button
            type="button"
            onClick={togglePlay}
            className="text-white/80 transition-colors hover:text-white"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </button>

          <button
            type="button"
            onClick={toggleMute}
            className="text-white/80 transition-colors hover:text-white"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </button>

          {useMockupOnly && isPlaying ? (
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="demo-progress-bar h-full w-full rounded-full bg-gradient-to-r from-[#2D62FF] to-[#7B61FF]"
              />
            </div>
          ) : (
            <span className="ml-auto font-mono text-xs text-white/50">
              VECTO HR Dashboard Preview
            </span>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            className="ml-2 shrink-0 text-white/80 transition-colors hover:text-white"
            aria-label="Fullscreen"
          >
            <Maximize className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
