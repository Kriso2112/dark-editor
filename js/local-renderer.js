(() => {
  "use strict";

  const MIME_CANDIDATES = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4"
  ];

  function waitEvent(target, success, failure, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      let timer;
      const clean = () => {
        target.removeEventListener(success, ok);
        if (failure) target.removeEventListener(failure, bad);
        clearTimeout(timer);
      };
      const ok = () => { clean(); resolve(); };
      const bad = () => { clean(); reject(new Error("Nie udało się wczytać materiału.")); };
      target.addEventListener(success, ok, { once: true });
      if (failure) target.addEventListener(failure, bad, { once: true });
      timer = setTimeout(() => { clean(); reject(new Error("Przekroczono czas wczytywania materiału.")); }, timeoutMs);
    });
  }

  function drawCover(ctx, source, width, height) {
    const sw = source.videoWidth || source.naturalWidth || width;
    const sh = source.videoHeight || source.naturalHeight || height;
    if (!sw || !sh) return;
    const scale = Math.min(width / sw, height / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source, (width - dw) / 2, (height - dh) / 2, dw, dh);
  }

  function drawSubtitles(ctx, subtitles, time, width, height) {
    const item = subtitles.find(s => time >= Number(s.start) && time < Number(s.end));
    if (!item) return;
    const text = String(item.text || "");
    const maxWidth = width * 0.88;
    const fontSize = 42;
    ctx.save();
    ctx.font = "bold " + fontSize + "px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const words = text.split(/\s+/);
    const lines = [];
    let line = "";
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    if (line) lines.push(line);
    const lineHeight = fontSize * 1.2;
    const blockHeight = lines.length * lineHeight;
    let centerY = height * 0.86;
    if (item.position === "top") centerY = height * 0.14;
    if (item.position === "middle") centerY = height * 0.5;
    const startY = centerY - blockHeight / 2 + lineHeight / 2;
    ctx.lineJoin = "round";
    lines.forEach((lineText, index) => {
      const y = startY + index * lineHeight;
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(0,0,0,.92)";
      ctx.strokeText(lineText, width / 2, y, maxWidth);
      ctx.fillStyle = "#fff";
      ctx.fillText(lineText, width / 2, y, maxWidth);
    });
    ctx.restore();
  }

  async function render(options) {
    const clips = options.clips || [];
    const subtitles = options.subtitles || [];
    const audioElement = options.audioElement;
    const volume = Math.max(0, Math.min(1, Number(options.audioVolume ?? 0.5)));
    const width = Number(options.width) || 1280;
    const height = Number(options.height) || 720;
    const fps = Number(options.fps) || 30;
    const maxDurationSec = Number(options.maxDurationSec) || 60;
    const onProgress = typeof options.onProgress === "function" ? options.onProgress : () => {};

    if (!clips.length) throw new Error("Dodaj przynajmniej jedną scenę.");
    if (clips.some(c => !c.url)) throw new Error("Brakuje plików. Przywróć materiały z galerii.");
    const total = clips.reduce((sum, c) => sum + Math.max(1, Number(c.duration) || 5), 0);
    if (total > maxDurationSec) throw new Error("Wersja testowa obsługuje maksymalnie " + maxDurationSec + " sekund filmu. Obecny projekt ma " + Math.ceil(total) + " s.");

    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      throw new Error("Ta przeglądarka nie obsługuje nagrywania obrazu z Canvas.");
    }
    const mimeType = MIME_CANDIDATES.find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error("Ta przeglądarka nie obsługuje eksportu MP4. Plik WebM nie zostanie podstawiony zamiast MP4.");

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Nie można uruchomić Canvas.");
    const canvasStream = canvas.captureStream(fps);
    let combinedStream = canvasStream;
    let audioTracks = [];

    if (audioElement && audioElement.src) {
      const capture = audioElement.captureStream || audioElement.mozCaptureStream;
      if (!capture) {
        canvasStream.getTracks().forEach(track => track.stop());
        throw new Error("Przeglądarka nie udostępnia przechwytywania muzyki. Usuń muzykę lub użyj innej przeglądarki do testu.");
      }
      const audioStream = capture.call(audioElement);
      audioTracks = audioStream.getAudioTracks();
      audioTracks.forEach(track => combinedStream.addTrack(track));
    }

    const chunks = [];
    let recorder;
    let stopped = false;
    const video = document.createElement("video");
    video.playsInline = true;
    video.muted = true;
    video.preload = "auto";
    video.setAttribute("playsinline", "");
    let startTime = 0;
    let timelineStart = 0;

    const stopTracks = () => {
      combinedStream.getTracks().forEach(track => { try { track.stop(); } catch (_) {} });
    };

    try {
      recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 2500000 });
      const stoppedPromise = new Promise((resolve, reject) => {
        recorder.ondataavailable = event => { if (event.data && event.data.size) chunks.push(event.data); };
        recorder.onerror = () => reject(new Error("Wystąpił błąd podczas nagrywania MP4."));
        recorder.onstop = resolve;
      });
      recorder.start(1000);

      if (audioElement && audioElement.src) {
        audioElement.pause();
        audioElement.currentTime = 0;
        audioElement.volume = volume;
        await audioElement.play().catch(() => {
          throw new Error("Nie udało się uruchomić muzyki. Sprawdź plik audio.");
        });
      }

      startTime = performance.now();
      let elapsedTotal = 0;

      for (let index = 0; index < clips.length; index++) {
        const clip = clips[index];
        const duration = Math.max(1, Number(clip.duration) || 5);
        let source = null;

        if (clip.type === "video") {
          video.pause();
          video.removeAttribute("src");
          video.load();
          video.src = clip.url;
          await waitEvent(video, "loadeddata", "error");
          video.currentTime = 0;
          await video.play();
          source = video;
        } else {
          const img = new Image();
          img.src = clip.url;
          await waitEvent(img, "load", "error");
          source = img;
        }

        const clipStart = performance.now();
        while (performance.now() - clipStart < duration * 1000) {
          const localElapsed = (performance.now() - clipStart) / 1000;
          const globalElapsed = elapsedTotal + localElapsed;
          drawCover(ctx, source, width, height);
          drawSubtitles(ctx, subtitles, globalElapsed, width, height);
          const progress = Math.min(99, Math.round(globalElapsed / total * 100));
          onProgress(progress, globalElapsed, total);
          await new Promise(resolve => requestAnimationFrame(resolve));
          if (stopped) throw new Error("Renderowanie anulowane.");
        }
        if (clip.type === "video") video.pause();
        elapsedTotal += duration;
      }

      if (audioElement) audioElement.pause();
      if (recorder.state !== "inactive") recorder.stop();
      await stoppedPromise;
      stopTracks();
      onProgress(100, total, total);
      const blob = new Blob(chunks, { type: mimeType });
      if (!blob.size) throw new Error("Powstał pusty plik MP4.");
      return { blob, filename: "dark-editor-export.mp4", mimeType, duration: total };
    } catch (error) {
      if (audioElement) audioElement.pause();
      if (recorder && recorder.state !== "inactive") {
        try { recorder.stop(); } catch (_) {}
      }
      stopTracks();
      throw error;
    } finally {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
  }

  window.DarkLocalRenderer = { render };
})();