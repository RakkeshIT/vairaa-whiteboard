// Lesson recording: the board canvas (ink, laser, spotlight) + optional microphone → a video file.

const TYPES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];

export const canRecord = () => typeof MediaRecorder !== "undefined" && !!HTMLCanvasElement.prototype.captureStream;

/**
 * Start recording `canvas`. Resolves to { stop(): Promise<{ blob, ext }>, mic: boolean }.
 * The microphone is optional: if it's denied, recording continues without sound.
 */
export async function startRecording(canvas, { mic = true } = {}) {
  const video = canvas.captureStream(30);
  let audio = null;
  if (mic && navigator.mediaDevices?.getUserMedia) {
    try {
      audio = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      audio = null;
    }
  }
  const stream = new MediaStream([...video.getVideoTracks(), ...(audio ? audio.getAudioTracks() : [])]);
  const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t)) || "";
  const rec = new MediaRecorder(stream, { ...(mimeType && { mimeType }), videoBitsPerSecond: 6_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start(1000);

  const release = () => stream.getTracks().forEach((t) => t.stop());
  return {
    mic: !!audio,
    stop: () =>
      new Promise((resolve) => {
        rec.onstop = () => {
          release();
          const type = rec.mimeType || mimeType || "video/webm";
          resolve({ blob: new Blob(chunks, { type }), ext: type.includes("mp4") ? "mp4" : "webm" });
        };
        if (rec.state === "inactive") rec.onstop();
        else rec.stop();
      }),
  };
}
