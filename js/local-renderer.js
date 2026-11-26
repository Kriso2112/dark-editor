(() => {
  "use strict";

  const MIME_CANDIDATES = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4"
  ];
  const audioSources = new WeakMap();

  function waitEvent(target, success, failure, timeoutMs = 20000) {
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
      timer = setTimeout(() => {
        clean();
        reject(new Error("Przekroczono czas wczytywania materiału."));
      }, timeoutMs);
    });
  }

  function drawCover(ctx, source, width, height) {
    const sw = source.videoWidth || source.naturalWidth || width;
    const sh = source.videoHeight || source.naturalHeight || height;
    if (!sw || !sh) return;
    const scale = Math.max(width / sw, height / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    const sx = (dw - width) / 2;
    const sy = (dh - height) / 2;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source, -sx, -sy, dw, dh);
  }

  function drawSubtitles(ctx, subtitles, time, width, height) {
    const item = subtitles.find(s =>
      time >= Number(s.start) && time < Number(s.end)
    );
    if (!item) return;
    const text = String(item.text || "");
    const maxWidth = width * 0.88;
    const fontSize = 42;
    ctx.save();
    ctx.font = "bold " + fontSize + "px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = [];
    let line = "";
    for (const word of text.split(/\s+/)) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
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

  function durationOf(clip) {
    return Math.max(1, Math.min(600, Number(clip.duration) || 5));
  }

  async function render(options) {
    const clips = (options.clips || []).map(clip => ({ ...clip }));
    const subtitles = (options.subtitles || []).map(item => ({ ...item }));
    const audioElement = options.audioElement || null;
    const volume = Math.max(0, Math.min(1, Number(options.audioVolume ?? 0.5)));
    const width = Number(options.width) || 1280;
    const height = Number(options.height) || 720;
    const fps = Number(options.fps) || 30;
    const maxDurationSec = Number(options.maxDurationSec) || 60;
    const onProgress = typeof options.onProgress === "function" ? options.onProgress : () => {};
    const total = clips.reduce((sum, clip) => sum + durationOf(clip), 0);

    if (!clips.length) throw new Error("Dodaj przynajmniej jedną scenę.");
    if (clips.some(clip => !clip.url)) throw new Error("Brakuje plików. Przywróć materiały z galerii.");
    if (total > maxDurationSec) {
      throw new Error("Wersja testowa obsługuje maksymalnie " + maxDurationSec +
        " sekund filmu. Obecny projekt ma " + Math.ceil(total) + " s.");
    }
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      throw new Error("Ta przeglądarka nie obsługuje nagrywania obrazu z Canvas.");
    }
    if (typeof MediaRecorder.isTypeSupported !== "function") {
      throw new Error("Przeglądarka nie potrafi potwierdzić obsługi formatu MP4.");
    }
    const mimeType = MIME_CANDIDATES.find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) {
      throw new Error("Ta przeglądarka nie obsługuje eksportu MP4. Plik WebM nie zostanie podstawiony zamiast MP4.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Nie można uruchomić Canvas.");

    const canvasStream = canvas.captureStream(fps);
    const video = document.createElement("video");
    video.playsInline = true;
    video.preload = "auto";
    video.loop = true;
    video.muted = false;
    video.volume = 1;
    video.setAttribute("playsinline", "");

    let audioContext = null;
    let audioDestination = null;
    let videoGain = null;
    let musicGain = null;
    let videoSource = null;
    let musicSource = null;
    const hasVideoAudio = clips.some(clip => clip.type === "video");
    const hasMusic = !!(audioElement && (audioElement.currentSrc || audioElement.src));
    let recorder = null;
    let stoppedPromise = null;
    let completed = false;
    const previousAudioVolume = audioElement ? audioElement.volume : null;

    const stopTracks = () => {
      canvasStream.getTracks().forEach(track => {
        try { track.stop(); } catch (_) {}
      });
    };
    const cleanupAudio = async () => {
      try { if (videoSource) videoSource.disconnect(); } catch (_) {}
      try { if (videoGain) videoGain.disconnect(); } catch (_) {}
      try { if (musicGain) musicGain.disconnect(); } catch (_) {}
      try {
        if (audioContext && !hasMusic && audioContext.state !== "closed") await audioContext.close();
      } catch (_) {}
    };

    try {
      if (hasVideoAudio || hasMusic) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          throw new Error("Ta przeglądarka nie obsługuje miksowania dźwięku. Eksport z audio został zatrzymany.");
        }
        musicSource = hasMusic ? audioSources.get(audioElement) : null;
        audioContext = musicSource ? musicSource.context : new AudioContextClass();
        audioDestination = audioContext.createMediaStreamDestination();

        if (hasVideoAudio) {
          videoSource = audioContext.createMediaElementSource(video);
          videoGain = audioContext.createGain();
          videoGain.gain.value = 1;
          videoSource.connect(videoGain);
          videoGain.connect(audioDestination);
        }
        if (hasMusic) {
          if (!musicSource) {
            musicSource = audioContext.createMediaElementSource(audioElement);
            audioSources.set(audioElement, musicSource);
            musicSource.connect(audioContext.destination);
          }
          musicGain = audioContext.createGain();
          musicGain.gain.value = volume;
          musicSource.connect(musicGain);
          musicGain.connect(audioDestination);
        }
        if (audioContext.state === "suspended") await audioContext.resume();
        audioDestination.stream.getAudioTracks().forEach(track => canvasStream.addTrack(track));
      }

      const chunks = [];
      recorder = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: 2500000
      });
      if (!String(recorder.mimeType || mimeType).toLowerCase().startsWith("video/mp4")) {
        throw new Error("Przeglądarka utworzyła inny format niż MP4. Plik nie zostanie zapisany.");
      }

      stoppedPromise = new Promise((resolve, reject) => {
        recorder.ondataavailable = event => {
          if (event.data && event.data.size) chunks.push(event.data);
        };
        recorder.onerror = () => reject(new Error("Wystąpił błąd podczas nagrywania MP4."));
        recorder.onstop = resolve;
      });
      recorder.start(1000);

      if (hasMusic) {
        audioElement.pause();
        audioElement.volume = 1;
        audioElement.currentTime = 0;
        await audioElement.play().catch(() => {
          throw new Error("Nie udało się uruchomić muzyki. Sprawdź plik audio.");
        });
      }

      let elapsedTotal = 0;
      for (let index = 0; index < clips.length; index++) {
        const clip = clips[index];
        const duration = durationOf(clip);
        let source;

        if (clip.type === "video") {
          video.pause();
          video.removeAttribute("src");
          video.load();
          const loaded = waitEvent(video, "loadeddata", "error");
          video.src = clip.url;
          await loaded;
          video.currentTime = 0;
          await video.play().catch(() => {
            throw new Error("Nie udało się odtworzyć filmu w scenie " + (index + 1) + ".");
          });
          source = video;
        } else {
          const img = new Image();
          const loaded = waitEvent(img, "load", "error");
          img.src = clip.url;
          await loaded;
          source = img;
        }

        const clipStart = performance.now();
        while (performance.now() - clipStart < duration * 1000) {
          const localElapsed = (performance.now() - clipStart) / 1000;
          const globalElapsed = elapsedTotal + localElapsed;
          drawCover(ctx, source, width, height);
          drawSubtitles(ctx, subtitles, globalElapsed, width, height);
          const progress = Math.min(99, Math.floor(globalElapsed / total * 100));
          onProgress(progress, globalElapsed, total);
          await new Promise(resolve => requestAnimationFrame(resolve));
        }
        if (clip.type === "video") video.pause();
        elapsedTotal += duration;
      }

      if (hasMusic) audioElement.pause();
      if (recorder.state !== "inactive") recorder.stop();
      await stoppedPromise;
      completed = true;

      const blob = new Blob(chunks, { type: mimeType });
      if (!blob.size) throw new Error("Powstał pusty plik MP4.");
      if (!blob.type.toLowerCase().startsWith("video/mp4")) {
        throw new Error("Wynik nie ma prawidłowego typu MIME MP4.");
      }
      onProgress(100, total, total);
      return {
        blob,
        filename: "dark-editor-export.mp4",
        mimeType: blob.type,
        duration: total
      };
    } catch (error) {
      if (audioElement) audioElement.pause();
      if (recorder && recorder.state !== "inactive") {
        try { recorder.stop(); } catch (_) {}
      }
      if (stoppedPromise) {
        try { await stoppedPromise; } catch (_) {}
      }
      throw error;
    } finally {
      if (audioElement) {
        audioElement.pause();
        if (previousAudioVolume !== null) audioElement.volume = previousAudioVolume;
      }
      video.pause();
      video.removeAttribute("src");
      video.load();
      stopTracks();
      await cleanupAudio();
      if (!completed && recorder && recorder.state !== "inactive") {
        try { recorder.stop(); } catch (_) {}
      }
    }
  }

  window.DarkLocalRenderer = { render };
})();