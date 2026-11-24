# DARK EDITOR — plan pełnej automatyzacji

## Cel produktu

Użytkownik podaje temat, format i długość filmu. DARK EDITOR automatycznie przygotowuje scenariusz, plan ujęć, materiały wizualne, narrację, napisy, muzykę, montaż i eksport MP4. Tryb ręczny pozostaje dostępny do poprawek.

## Zasady, których nie łamiemy

- Nie usuwamy ani nie nadpisujemy działającej wersji bez kopii.
- Klucze API przechowujemy wyłącznie po stronie serwera jako sekrety. Nigdy w `index.html`, localStorage ani repozytorium.
- Przed każdą płatną generacją obliczamy szacowany koszt i sprawdzamy limit użytkownika.
- Budżet docelowy użytkownika: maksymalnie 200 PLN miesięcznie. System ma zatrzymać generację przed przekroczeniem ustawionego limitu; nie wolno traktować nieznanej ceny jako zera.
- Zadania generowania są asynchroniczne: interfejs pokazuje stan, postęp, błędy i możliwość wznowienia.
- Każdy projekt zachowuje scenariusz, sceny, kolejność, czasy, napisy, ustawienia audio, użyte modele, koszty i odnośniki do materiałów.
- Zachowujemy tryb ręczny i dotychczasowy styl Black & Gold.

## Architektura docelowa

1. **DARK EDITOR PWA** — interfejs, ustawienia filmu, lista projektów, podgląd i ręczna korekta.
2. **Backend API (Cloudflare Worker)** — uwierzytelnianie żądań, walidacja, limity, estymacja kosztów, tworzenie i monitorowanie zadań. Żadnych sekretów po stronie przeglądarki.
3. **Orkiestrator** — scenariusz → plan scen → lektor → obraz/wideo → napisy → montaż → kontrola jakości → MP4.
4. **Adaptery dostawców** — niezależne moduły dla VideoGen, fal.ai i HeyGen. Można wymieniać dostawcę bez przebudowy interfejsu.
5. **Magazyn projektu i plików** — manifest projektu, stany zadań i bezpieczne odnośniki do gotowych plików.

## Preferowany przebieg automatyczny

1. Użytkownik wpisuje temat, język, długość, format (domyślnie 16:9), styl i limit kosztu.
2. Model tekstowy przygotowuje scenariusz z podziałem na rozdziały i sceny.
3. Orkiestrator tworzy listę ujęć z opisem obrazu, ruchem kamery, długością i przypisaniem do fragmentu narracji.
4. System tworzy narrację i materiały wizualne. Preferuje materiały wielokrotnego użycia i tańsze generowanie tam, gdzie nie obniża to istotnie jakości.
5. Montaż łączy sceny, narrację, muzykę, efekty i napisy na jednej osi czasu.
6. Walidacja sprawdza długość, brakujące pliki, synchronizację, czytelność napisów, poziomy audio i poprawność eksportu.
7. System zapisuje projekt oraz udostępnia MP4. Użytkownik może otworzyć projekt w trybie ręcznym.

## Strategia dostawców

- **VideoGen** — kandydat do szybkiego tworzenia pełnych filmów ze scenariusza i eksportu projektu. Przed wyborem jako głównego silnika trzeba potwierdzić dokładne ceny, limity i możliwość bezpiecznej integracji API.
- **fal.ai** — kandydat do generowania wybranych ujęć, obrazów i sekwencji. W ostatnim sprawdzeniu połączenie było aktywne, ale saldo nie pozwalało na generowanie. Nie uruchamiać płatnych zadań bez zgody i budżetu.
- **HeyGen** — kandydat do narracji/lektora lub awatara, z uwzględnieniem ograniczeń planu.
- **Runway** — opcjonalny dostawca; obecny plan Free nie wystarczał do generowania wideo.
- Dostawca nie jest wybierany na stałe. Orkiestrator ma kierować zadanie do najkorzystniejszego obsługiwanego adaptera na podstawie jakości, kosztu, dostępności i wymagań sceny.

## Etapy wdrożenia

### Etap 0 — zabezpieczenie
- Zachować kopię wersji 0.9.0.
- Pracować na osobnej gałęzi `dark-auto-foundation`.
- Nie modyfikować głównej gałęzi, dopóki zmiany nie przejdą testów.

### Etap 1 — fundament backendu
- Utworzyć Worker API i konfigurację wdrożenia.
- Dodać endpoint zdrowia, walidację, CORS ograniczony do domeny aplikacji i obsługę błędów.
- Przygotować sekrety dostawców jako ustawienia serwerowe.
- Dodać limity kosztów i rejestr zadań.

### Etap 2 — kontrakt projektu i orkiestrator
- Zdefiniować wersjonowany format projektu JSON.
- Zaimplementować stany: queued, planning, generating, assembling, validating, exporting, succeeded, failed, cancelled.
- Dodać wznowienie po błędzie i idempotencję, aby ponowne kliknięcie nie tworzyło podwójnych płatnych zadań.

### Etap 3 — integracje dostawców
- Najpierw jeden pełny przepływ end-to-end przez dostawcę, którego API, cena i eksport zostały potwierdzone.
- Następnie adaptery alternatywne i fallbacki.
- Nie zakładać, że połączenie aplikacji w ChatGPT automatycznie oznacza, że można użyć tych samych poświadczeń w zewnętrznym Workerze. Integracja wymaga oficjalnego API i osobnego sekretu.

### Etap 4 — montaż i eksport
- Generować oś czasu z dokładnymi punktami wejścia/wyjścia.
- Zachować narrację w naturalnym tempie i synchronizować napisy z rzeczywistym audio.
- Eksportować MP4 H.264/AAC z walidacją pliku końcowego.
- Zapisywać edytowalny manifest projektu.

### Etap 5 — interfejs automatyczny
- Pole tematu i ustawienia podstawowe.
- Przycisk „Utwórz film”.
- Ekran postępu, szacowany koszt, historia zadań i pobranie MP4.
- Przycisk „Otwórz w edytorze ręcznym”.

### Etap 6 — testy i publikacja
- Testy bez płatnych generacji na syntetycznych plikach.
- Testy zapisu/odtwarzania projektu i ponownego otwierania na Androidzie.
- Testy limitów, błędów dostawcy, wznowienia i eksportu.
- Dopiero po przejściu testów połączenie gałęzi z główną.

## Stan wyjściowy

- Frontend w repozytorium: pojedynczy `index.html`, wersja 0.9.0.
- Obecne funkcje: podgląd, ręczne dodawanie mediów, prosta oś czasu, napisy, plan scen i zapis części danych w localStorage.
- Brak backendu, bezpośrednich adapterów AI i eksportu MP4 w aktualnym froncie.
- Kopia źródłowego pliku: `backups/index-0.9.0.html`.
- Prace rozwojowe: gałąź `dark-auto-foundation`.

## Kryterium ukończenia

Użytkownik może na telefonie wpisać temat, uruchomić automat i otrzymać rzeczywisty, poprawnie odtwarzany plik MP4 oraz zapisany projekt, bez ręcznego wyszukiwania i dodawania scen. Koszt każdej generacji jest widoczny i kontrolowany przed jej uruchomieniem.
