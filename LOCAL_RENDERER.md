# DARK EDITOR — lokalny renderer MP4 (eksperymentalny)

## Cel
Izolowany moduł js/local-renderer.js realizuje render w czasie rzeczywistym przez Canvas + MediaRecorder. Nie korzysta z sieci, serwera, API ani płatnych kredytów.

## Interfejs
Załaduj plik jako skrypt, a następnie wywołaj po świadomym kliknięciu użytkownika:

    const result = await DarkLocalRenderer.render({
      clips, subtitles, audioElement, audioVolume: 0.5,
      width: 1280, height: 720, fps: 30,
      onProgress(progress) {}
    });
    const url = URL.createObjectURL(result.blob);

## Ograniczenia i bramki
- Wersja eksperymentalna; nie jest jeszcze podłączona do głównego interfejsu.
- Wymaga ponownego wskazania lokalnych plików po wczytaniu projektu.
- MP4 jest wymagane; brak cichego przejścia na WebM.
- Audio przechwytuje element HTMLAudioElement tylko wtedy, gdy captureStream() jest dostępne.
- Render odbywa się w czasie rzeczywistym; karta musi pozostać aktywna.
- Wynik jest przechowywany jako Blob w RAM. Na telefonie z 4 GB RAM nie uruchamiać od razu długich projektów.
- Brak miksowania wielu ścieżek audio, przejść, korekcji barw, strumieniowego zapisu i obsługi wszystkich nietypowych kodeków.
- Przed integracją potrzebne są testy na telefonie: zdjęcie, film, napisy, audio, anulowanie i dłuższe sceny.

## Plan
1. Krótki projekt z jednym zdjęciem.
2. Jeden film.
3. Kilka scen i napisy.
4. Audio.
5. Integracja z UI i approval gate dopiero po testach.
