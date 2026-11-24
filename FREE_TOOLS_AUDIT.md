# DARK EDITOR — audyt darmowych narzędzi (2026-11-24)

## Zasada audytu

Audyt był wyłącznie odczytowy. Nie uruchomiono generowania, eksportu w chmurze, uploadów ani zakupów. Salda i limity mogą się zmieniać; ponownie sprawdzamy je bezpośrednio przed każdym użyciem.

## Stan połączonych kont

| Usługa | Odczyt konta | Wniosek dla wariantu 0 PLN |
|---|---|---|
| fal.ai | Konto zwróciło `blocked`, przyczyną jest wyczerpane saldo. Katalog modeli i ceny pozostają dostępne; upload i generowanie są zablokowane. | Nie używać do generowania. Można czytać katalog/schematy/ceny, ale nie jest to darmowy silnik. |
| Runway | Połączony workspace pokazuje plan Free i 500 kredytów, 0 zakupionych. | Zachować jako ograniczony darmowy zasób do ewentualnego, świadomie zatwierdzonego testu. Nie zużywać na ślepo. Dokumentacja Runway opisuje standardową pulę Free jako jednorazowe 125 kredytów; saldo 500 widoczne w tym workspace jest obserwacją konta i może wynikać ze szczególnej alokacji. Nie zakładać miesięcznego odnowienia. |
| HeyGen | Konto pokazuje plan Free; odpowiedź konta nie ujawnia liczby pozostałych kredytów (pola premium/add-on mają `remaining: null`). | Oficjalna dokumentacja opisuje 1–3 darmowe filmy zależnie od regionu, do 1 minuty i 720p. Traktować jako ograniczoną pulę; nie generować bez świadomego wyboru materiału testowego. |
| VideoGen | Połączenie API jest aktywne i konto zostało rozpoznane. Dostępne narzędzia tworzenia wideo deklarują użycie kredytów zespołu. Odczyt salda/pozostałych darmowych kredytów nie był dostępny w sprawdzonych narzędziach. | Koszt i darmowy limit niezweryfikowane. Nie używać do generacji, dopóki panel konta lub oficjalna dokumentacja nie potwierdzi darmowego limitu. |

## Darmowy montaż i render lokalny — kandydaci

### 1. ffmpeg.wasm — kandydat do silnika eksportu

- FFmpeg działa w przeglądarce przez WebAssembly; pliki mogą pozostać na urządzeniu użytkownika.
- Dostępne są rdzenie single-thread i multi-thread; transkodowanie jest zasobożerne i działa w Web Workerze.
- Może posłużyć do łączenia klipów, miksowania audio, konwersji i wypalania napisów bez płatnego serwera.
- Ryzyka: duży pobierany rdzeń, zużycie RAM/CPU, wolniejszy render na telefonie i ograniczenia przeglądarki. Zacząć od małego testu na Androidzie, nie od razu od 10-minutowego filmu.
- Dokumentacja: https://github.com/ffmpegwasm/ffmpeg.wasm

### 2. Reframe — referencja do prostego montażu w przeglądarce

- Otwarty projekt MIT, edycja lokalna przez FFmpeg.wasm; przycinanie, zmiana proporcji, obrót, prędkość, audio i nakładki tekst/obraz, eksport MP4/WebM/MKV/GIF.
- Dobre źródło pomysłów na lekkie funkcje eksportu, ale nie zastępujemy nim DARK EDITOR.
- Repozytorium: https://github.com/reframe-oss/reframe

### 3. FreeCut — zaawansowany projekt referencyjny

- Otwarty edytor wielościeżkowy; używa WebGPU, WebCodecs, Web Workers i OPFS. Opisuje lokalną transkrypcję, lokalny TTS Kokoro, MusicGen oraz eksport.
- Wymaga nowoczesnych API przeglądarki i jest pełnym, rozbudowanym projektem. Nie kopiować bezpośrednio do obecnego jednoplikowego `index.html`; na Androidzie trzeba najpierw zweryfikować kompatybilność i wydajność.
- Repozytorium: https://github.com/walterlow/freecut

### 4. Vikado — kolejny kandydat do testu

- Projekt opisuje lokalny montaż i eksport MP4 przez WebCodecs/GPU, z opcjonalnym serwisem FFmpeg.
- Potencjalnie przydatny do porównania, ale przed integracją trzeba zweryfikować licencję, wymagania przeglądarki i działanie na urządzeniu użytkownika.
- Repozytorium: https://github.com/koneb71/vikado

## Rekomendacja techniczna dla DARK EDITOR

Przeglądarka użytkownika zgłasza Chrome na Androidzie w wersji 157. Tabele zgodności wskazują WebCodecs/VideoEncoder jako obsługiwane w Chrome Android 157, ale dostępność konkretnego kodeka i sprzętowego enkodera zależy od urządzenia. WebCodecs nie odczytuje ani nie zapisuje samodzielnie kontenerów MP4 — potrzebny jest osobny muxer/demuxer. Dlatego dodano stronę diagnostyczną `diagnostics/export-check.html`, która lokalnie sprawdza dostępność API i konfiguracje H.264/AAC; nie wykonuje renderu.

1. Nie zmieniać obecnego edytora ani nie zastępować go inną aplikacją.
2. Zachować manifest projektu i obecny ręczny montaż.
3. Dodać osobny moduł eksportu lokalnego. Najpierw sprawdzić dostępność WebCodecs; jeśli nie działa, użyć kontrolowanego fallbacku FFmpeg.wasm single-thread.
4. W pierwszej próbie eksportować krótki, 5–10-sekundowy projekt testowy 720p z jednym klipem, jednym napisem i audio. Sprawdzić MP4 na Androidzie, zużycie pamięci, temperaturę i czas renderu.
5. Dopiero po udanym teście podnieść jakość i długość. Nie obiecywać 1080p/10 minut, zanim urządzenie tego nie potwierdzi.
6. Dla lektora najpierw obsłużyć własne nagranie i lokalny TTS. Dla muzyki najpierw używać plików użytkownika lub zasobów z licencją pozwalającą na publikację.
7. Darmowe limity AI traktować jako okazjonalne narzędzie do wybranych ujęć, nie jako gwarantowany backend produkcyjny.

## Kolejność kolejnych prac

- [x] Dodać bezpłatną stronę diagnostyczną WebCodecs/MediaRecorder: `diagnostics/export-check.html`.
- [ ] Użytkownik uruchamia test na swoim telefonie i odsyła wynik.
- [ ] Test kompatybilności WebCodecs w Android Chrome.
- [ ] Dodać testowy renderer lokalny, bez płatnych API.
- [ ] Przetestować MP4 720p na krótkim materiale.
- [ ] Zmierzyć wydajność na telefonie i ustawić bezpieczne limity.
- [ ] Dopiero później wybrać darmowe źródła TTS, muzyki i materiałów wizualnych z weryfikacją licencji.
- [ ] Płatne API pozostają wyłączone domyślnie i wymagają osobnej zgody dla konkretnego projektu.

## Źródła sprawdzone

- WebCodecs (MDN): https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API
- WebCodecs compatibility: https://caniuse.com/webcodecs
- FFmpeg.wasm: https://github.com/ffmpegwasm/ffmpeg.wasm
- Reframe: https://github.com/reframe-oss/reframe
- FreeCut: https://github.com/walterlow/freecut
- Vikado: https://github.com/koneb71/vikado
- Runway — credits: https://help.runwayml.com/hc/en-us/articles/15124877443219-How-do-credits-work
- HeyGen — credit-based plans: https://help.heygen.com/en/articles/15125761-heygen-credit-based-pricing-plans-subscriptions-explained
