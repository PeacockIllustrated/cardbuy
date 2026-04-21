"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { uploadGradedScan } from "@/app/_actions/graded-scan";
import type { GradingCompany, Grade } from "@/lib/supabase/types";

/* ─────────────────────────────────────────────────────────────────
 * GradedCardScanner — full-screen capture modal for the Phase 6
 * Slice D framed-camera graded-card add flow.
 *
 * Three stages:
 *   1. `camera`  — live stream + PSA-slab frame overlay + capture btn
 *   2. `review`  — still preview + retry / confirm
 *   3. `confirm` — grading company + grade pickers → upload
 *
 * Canvas crop math: the frame overlay is an SVG rect positioned by a
 * fixed aspect ratio over the video element. On capture we measure
 * the displayed video rect, compute the crop box in video-coordinates,
 * draw that region to an offscreen canvas, export as a JPEG Blob.
 *
 * Graceful fallback — if getUserMedia is unavailable or denied, the
 * modal swaps to a plain file-upload input. Same canvas pipeline runs
 * on the uploaded image so the output shape is consistent.
 *
 * OCR is intentionally out of scope. The user confirms company + grade.
 * ───────────────────────────────────────────────────────────────── */

// PSA slab aspect (~65 × 108 mm). Frame is a portrait rectangle —
// slightly taller than a raw card (5:7 = 0.714) to account for the
// plastic shoulder + label area on top.
const FRAME_ASPECT = 65 / 108; // ≈ 0.60, width/height
const FRAME_WIDTH_PCT = 0.72; // of the video container's short edge

type Stage = "camera" | "review" | "confirm";

type Props = {
  cardId: string;
  cardName: string;
  /** Called after a successful upload so the parent can refresh. */
  onSuccess?: () => void;
  onClose: () => void;
};

const GRADING_COMPANIES: GradingCompany[] = [
  "PSA",
  "CGC",
  "BGS",
  "SGC",
  "ACE",
];
const GRADES: Grade[] = ["10", "9.5", "9", "8.5", "8", "7"];

export function GradedCardScanner({
  cardId,
  cardName,
  onSuccess,
  onClose,
}: Props) {
  const [stage, setStage] = useState<Stage>("camera");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [gradingCompany, setGradingCompany] = useState<GradingCompany>("PSA");
  const [grade, setGrade] = useState<Grade>("9");
  const [pending, start] = useTransition();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /* ── Start camera on mount, stop on unmount ─────────────────── */
  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setCameraError("Camera not available on this device.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          try {
            await video.play();
          } catch {
            // Some browsers need a user-gesture replay — ignore here,
            // the viewfinder still renders and the user can tap Capture.
          }
        }
      } catch (e) {
        const name = e instanceof Error ? e.name : "Error";
        setCameraError(
          name === "NotAllowedError"
            ? "Camera permission denied. Use file upload instead."
            : "Couldn't start the camera. Use file upload instead.",
        );
      }
    };

    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  /* ── Esc closes the modal ──────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, onClose]);

  /* ── Revoke object URL on unmount/retry ────────────────────── */
  useEffect(() => {
    return () => {
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    };
  }, [capturedUrl]);

  /* ── Capture ───────────────────────────────────────────────── */
  const capture = useCallback(async () => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container || video.readyState < 2) return;

    const blob = await cropVideoToFrame(video, container);
    if (!blob) return;
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedBlob(blob);
    setCapturedUrl(URL.createObjectURL(blob));
    setStage("review");
  }, [capturedUrl]);

  /* ── File-upload fallback ──────────────────────────────────── */
  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setUploadError("That doesn't look like an image file.");
        return;
      }
      setUploadError(null);
      // No crop on the fallback — the user picked the image so we
      // trust them to have framed it.
      const blob = file;
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
      setCapturedBlob(blob);
      setCapturedUrl(URL.createObjectURL(blob));
      setStage("review");
    },
    [capturedUrl],
  );

  /* ── Retry / confirm / upload ──────────────────────────────── */
  const retry = () => {
    setCapturedBlob(null);
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    setStage(cameraError ? "camera" : "camera");
  };

  const proceedToConfirm = () => setStage("confirm");

  const upload = () => {
    if (!capturedBlob) return;
    setUploadError(null);
    start(async () => {
      try {
        const fd = new FormData();
        fd.append(
          "file",
          new File([capturedBlob], `scan.jpg`, {
            type: capturedBlob.type || "image/jpeg",
          }),
        );
        fd.append("cardId", cardId);
        fd.append("gradingCompany", gradingCompany);
        fd.append("grade", grade);
        await uploadGradedScan(fd);
        onSuccess?.();
        onClose();
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : "Upload failed.");
      }
    });
  };

  /* ── Render ───────────────────────────────────────────────── */

  return (
    <div
      className="fixed inset-0 z-[100] bg-ink/90 flex items-center justify-center p-4 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`Scan graded ${cardName}`}
    >
      <div className="pop-static bg-paper-strong rounded-md w-full max-w-[640px] max-h-full overflow-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-[3px] border-ink">
          <div className="flex flex-col">
            <span className="font-display text-[10px] tracking-[0.25em] text-muted">
              Scan graded · {stage.toUpperCase()}
            </span>
            <span className="font-display text-[14px] tracking-wider text-ink truncate">
              {cardName}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="pop-card rounded-sm bg-paper-strong px-2 py-1 font-display text-[11px] tracking-wider text-ink disabled:opacity-50"
            aria-label="Close scanner"
          >
            ✕
          </button>
        </div>

        {/* Stage body */}
        {stage === "camera" ? (
          <CameraStage
            videoRef={videoRef}
            containerRef={containerRef}
            cameraError={cameraError}
            onCapture={capture}
            onFile={handleFile}
            uploadError={uploadError}
          />
        ) : null}

        {stage === "review" && capturedUrl ? (
          <ReviewStage
            url={capturedUrl}
            onRetry={retry}
            onConfirm={proceedToConfirm}
          />
        ) : null}

        {stage === "confirm" && capturedUrl ? (
          <ConfirmStage
            url={capturedUrl}
            gradingCompany={gradingCompany}
            grade={grade}
            pending={pending}
            onChangeCompany={setGradingCompany}
            onChangeGrade={setGrade}
            onBack={() => setStage("review")}
            onUpload={upload}
            uploadError={uploadError}
          />
        ) : null}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * Stages
 * ───────────────────────────────────────────────────────────────── */

function CameraStage({
  videoRef,
  containerRef,
  cameraError,
  onCapture,
  onFile,
  uploadError,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  cameraError: string | null;
  onCapture: () => void;
  onFile: (f: File) => void;
  uploadError: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-[11px] text-secondary leading-snug">
        Align the slab inside the frame. Fill as much of the guides as
        you can — we&rsquo;ll crop to the frame when you capture.
      </p>

      {cameraError ? (
        <div
          role="alert"
          className="pop-card rounded-sm bg-warn/10 border-warn text-warn p-3 text-[11px]"
        >
          {cameraError}
        </div>
      ) : null}

      <div
        ref={containerRef}
        className="relative w-full bg-ink rounded-sm overflow-hidden aspect-[4/3] border-[3px] border-ink"
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Frame overlay — a centred portrait rectangle with 4 corner brackets. */}
        <FrameOverlay />
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={onCapture}
          disabled={Boolean(cameraError)}
          className="pop-block rounded-sm bg-pink px-4 py-2 font-display text-[13px] tracking-wider text-ink disabled:opacity-50 flex-1 min-w-[140px]"
        >
          ◉ Capture
        </button>
        <label className="pop-card rounded-sm bg-paper-strong px-4 py-2 font-display text-[11px] tracking-wider text-ink cursor-pointer flex items-center gap-2">
          <span>Upload file</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              // Reset so the same file can be picked again.
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {uploadError ? (
        <div
          role="alert"
          className="text-[11px] text-warn bg-warn/10 border-2 border-warn rounded-sm px-2 py-1"
        >
          {uploadError}
        </div>
      ) : null}
    </div>
  );
}

function ReviewStage({
  url,
  onRetry,
  onConfirm,
}: {
  url: string;
  onRetry: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-[11px] text-secondary">Happy with the crop?</p>
      <div className="relative w-full bg-ink rounded-sm overflow-hidden aspect-[4/5] border-[3px] border-ink max-h-[60vh]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Captured slab"
          className="absolute inset-0 w-full h-full object-contain"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="pop-card rounded-sm bg-paper-strong px-3 py-1.5 font-display text-[11px] tracking-wider text-ink"
        >
          ← Retry
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="pop-block rounded-sm bg-teal px-4 py-2 font-display text-[12px] tracking-wider text-ink ml-auto"
        >
          Use this photo →
        </button>
      </div>
    </div>
  );
}

function ConfirmStage({
  url,
  gradingCompany,
  grade,
  pending,
  onChangeCompany,
  onChangeGrade,
  onBack,
  onUpload,
  uploadError,
}: {
  url: string;
  gradingCompany: GradingCompany;
  grade: Grade;
  pending: boolean;
  onChangeCompany: (g: GradingCompany) => void;
  onChangeGrade: (g: Grade) => void;
  onBack: () => void;
  onUpload: () => void;
  uploadError: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="grid grid-cols-[96px_1fr] gap-3">
        <div className="relative bg-ink rounded-sm overflow-hidden aspect-[65/108] border-2 border-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
        <div className="flex flex-col gap-2 min-w-0">
          <p className="text-[11px] text-secondary leading-snug">
            Confirm the grade on the slab label. OCR is coming later —
            for now, please type it in.
          </p>
        </div>
      </div>

      <label className="flex items-center gap-2 flex-wrap">
        <span className="font-display text-[10px] tracking-[0.2em] text-muted shrink-0">
          Company
        </span>
        <select
          value={gradingCompany}
          onChange={(e) =>
            onChangeCompany(e.target.value as GradingCompany)
          }
          disabled={pending}
          className="font-display text-[12px] tracking-wider bg-paper-strong border-2 border-ink rounded-sm px-2 py-1 disabled:opacity-50"
        >
          {GRADING_COMPANIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 flex-wrap">
        <span className="font-display text-[10px] tracking-[0.2em] text-muted shrink-0">
          Grade
        </span>
        <select
          value={grade}
          onChange={(e) => onChangeGrade(e.target.value as Grade)}
          disabled={pending}
          className="font-display text-[12px] tracking-wider bg-paper-strong border-2 border-ink rounded-sm px-2 py-1 disabled:opacity-50"
        >
          {GRADES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </label>

      {uploadError ? (
        <div
          role="alert"
          className="text-[11px] text-warn bg-warn/10 border-2 border-warn rounded-sm px-2 py-1"
        >
          {uploadError}
        </div>
      ) : null}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className="pop-card rounded-sm bg-paper-strong px-3 py-1.5 font-display text-[11px] tracking-wider text-ink disabled:opacity-50"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onUpload}
          disabled={pending}
          className="pop-block rounded-sm bg-teal px-4 py-2 font-display text-[12px] tracking-wider text-ink ml-auto disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save to binder"}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * Frame overlay — centred portrait slab rectangle with 4 corner
 * brackets. Aspect is tied to FRAME_ASPECT so the crop math stays in
 * lock-step with what the user sees.
 * ───────────────────────────────────────────────────────────────── */

function FrameOverlay() {
  // Use CSS to size: portrait rect centred, width = FRAME_WIDTH_PCT of
  // the container's shortest edge. We approximate "shortest edge" with
  // CSS min() and the known aspect ratio of the video container (4:3).
  const widthCss = `min(${FRAME_WIDTH_PCT * 100}%, ${
    FRAME_WIDTH_PCT * 100 * (3 / 4)
  }vh)`;

  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none flex items-center justify-center"
    >
      <div
        className="relative"
        style={{
          width: widthCss,
          aspectRatio: `${FRAME_ASPECT}`,
        }}
      >
        {/* 4 corner brackets */}
        <Corner position="tl" />
        <Corner position="tr" />
        <Corner position="bl" />
        <Corner position="br" />
        {/* Dashed midline hint */}
        <div className="absolute inset-x-0 top-[18%] h-px bg-paper-strong/30" />
        <div className="absolute inset-x-0 bottom-[14%] h-px bg-paper-strong/30" />
        {/* Label guide */}
        <span className="absolute left-1/2 -translate-x-1/2 top-[4%] font-display text-[9px] tracking-[0.25em] text-paper-strong/60">
          LABEL
        </span>
      </div>
    </div>
  );
}

function Corner({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const pos =
    position === "tl"
      ? "top-0 left-0 border-t-[3px] border-l-[3px]"
      : position === "tr"
        ? "top-0 right-0 border-t-[3px] border-r-[3px]"
        : position === "bl"
          ? "bottom-0 left-0 border-b-[3px] border-l-[3px]"
          : "bottom-0 right-0 border-b-[3px] border-r-[3px]";
  return (
    <span
      aria-hidden
      className={`absolute w-6 h-6 border-paper-strong ${pos}`}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────
 * Crop — derive the on-screen frame rect, map it into video-space,
 * draw that region to a canvas, export JPEG.
 * ───────────────────────────────────────────────────────────────── */

async function cropVideoToFrame(
  video: HTMLVideoElement,
  container: HTMLElement,
): Promise<Blob | null> {
  const { videoWidth: vw, videoHeight: vh } = video;
  if (!vw || !vh) return null;

  // Container dimensions in CSS pixels.
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  if (!cw || !ch) return null;

  // object-cover math — the video fills the container, cropping to the
  // container's aspect. Compute the visible-video rect inside the
  // `video` element, then map the frame overlay back into
  // video-coordinates.
  const videoAspect = vw / vh;
  const containerAspect = cw / ch;

  // Scale factor applied to the video to cover the container.
  let drawnVideoW = cw;
  let drawnVideoH = ch;
  let offsetX = 0;
  let offsetY = 0;
  if (videoAspect > containerAspect) {
    // Video is wider than container → scaled to height; horizontally centred
    drawnVideoH = ch;
    drawnVideoW = ch * videoAspect;
    offsetX = (cw - drawnVideoW) / 2;
  } else {
    drawnVideoW = cw;
    drawnVideoH = cw / videoAspect;
    offsetY = (ch - drawnVideoH) / 2;
  }

  // Frame overlay in CSS px.
  const frameShort = Math.min(cw, ch) * FRAME_WIDTH_PCT;
  const frameW = frameShort;
  const frameH = frameShort / FRAME_ASPECT;
  const frameX = (cw - frameW) / 2;
  const frameY = (ch - frameH) / 2;

  // Map frame rect into video's native pixels. First convert to the
  // drawn-video coordinate space (drawnVideoW × drawnVideoH), then
  // multiply by (vw / drawnVideoW).
  const scale = vw / drawnVideoW; // same as vh / drawnVideoH
  const cropX = Math.max(0, Math.round((frameX - offsetX) * scale));
  const cropY = Math.max(0, Math.round((frameY - offsetY) * scale));
  const cropW = Math.min(vw - cropX, Math.round(frameW * scale));
  const cropH = Math.min(vh - cropY, Math.round(frameH * scale));

  if (cropW <= 0 || cropH <= 0) return null;

  const canvas = document.createElement("canvas");
  canvas.width = cropW;
  canvas.height = cropH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9);
  });
}
