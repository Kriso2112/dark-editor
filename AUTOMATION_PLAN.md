# DARK EDITOR — plan automatyzacji „free-first, automat z kontrolą”

## Cel produktu

Użytkownik podaje temat, język, format i długość filmu. DARK EDITOR przygotowuje kompletny projekt: scenariusz, plan scen, narrację, napisy, propozycję muzyki, materiały wizualne i montaż. Użytkownik sprawdza i poprawia projekt, a dopiero potem może zatwierdzić renderowanie. Tryb ręczny pozostaje dostępny.

**Strategia kosztów: najpierw wykorzystujemy legalne, dostępne bezpłatnie możliwości. Nie kupujemy abonamentów, kredytów ani programów, dopóki darmowe rozwiązania nie okażą się niewystarczające i użytkownik nie podejmie osobnej decyzji.**

## Zasady, których nie łamiemy

- Nie usuwamy ani nie nadpisujemy działającej wersji bez kopii. Pracujemy na gałęzi `dark-auto-foundation`; `main` pozostaje nietknięta do czasu testów.
- Klucze API przechowujemy wyłącznie po stronie serwera jako sekrety. Nigdy w `index.html`, localStorage ani repozytorium.
- **Domyślny budżet na narzędzia i generowanie wynosi 0 PLN.** Nie kupujemy planów, doładowań ani licencji automatycznie.
- Najpierw sprawdzamy darmowe plany, limity, okresy próbne, otwarte modele, lokalne narzędzia i legalne biblioteki darmowych materiałów. Darmowy plan może mieć limity, znak wodny, ograniczenia komercyjne lub wymagać atrybucji — trzeba je sprawdzić.
- „Darmowe” nie oznacza „bez limitu”. Przed użyciem sprawdzamy pozostały limit, zasady wykorzystania i możliwość eksportu.
- Jeżeli usługa może naliczyć opłatę, jest traktowana jako płatna nawet wtedy, gdy konto ma promocyjne kredyty. Nie uruchamiamy jej bez wyraźnej zgody dla konkretnego projektu.
- Nieznana cena, nieznany limit ani brak danych o rozliczeniu oznaczają **STOP**, a nie zero złotych.
- Każdy projekt przechodzi przez przygotowanie i przegląd. **Żadna płatna generacja nie może wystartować przed zatwierdzeniem konkretnej wersji projektu i kosztu przez użytkownika.**
- Zatwierdzenie wygasa po każdej zmianie projektu, dostawcy, parametrów lub kosztorysu.
- Budżet użytkownika 200 PLN/miesiąc jest wyłącznie awaryjnym pułapem do ewentualnego rozważenia w przyszłości — nie jest zgodą na wydawanie pieniędzy. Do czasu osobnej decyzji obowiązuje 0 PLN.
- Każdy projekt zachowuje scenariusz, sceny, kolejność, czasy, napisy, ustawienia audio, użyte źródła, statusy i historię kosztów.

## Priorytetowa strategia darmowa

1. **Planowanie i tekst** — najpierw tworzymy scenariusz, strukturę scen, listę ujęć, napisy i instrukcje montażu bez generowania płatnych mediów. Korzystamy z dostępnych bezpłatnych możliwości tekstowych.
2. **Materiały wizualne** — najpierw legalne darmowe zdjęcia i klipy stockowe, własne pliki użytkownika, proste animacje i grafiki tworzone lokalnie. Generowanie AI tylko w ramach potwierdzonego darmowego limitu.
3. **Lektor** — najpierw lokalne/offline TTS lub rzeczywiste bezpłatne limity usług. Użytkownik może też dodać własne nagranie.
4. **Napisy** — generowanie i synchronizacja darmowymi narzędziami lub lokalnie; napisy pozostają edytowalne.
5. **Muzyka i efekty** — najpierw własne pliki oraz biblioteki z jasną licencją pozwalającą na planowane użycie, w tym komercyjne, jeśli dotyczy.
6. **Montaż i eksport** — priorytet dla darmowego montażu lokalnego/przeglądarkowego i otwartych narzędzi. Eksport MP4 musi być realny, sprawdzony i bez nieoczekiwanego znaku wodnego.
7. **AI video/image** — dopiero gdy bezpłatne źródła nie wystarczają. Najpierw porównujemy faktyczne darmowe limity i jakość; nie zakładamy, że podłączone konto w ChatGPT oznacza darmowe API dla aplikacji.

## Dostawcy i konta — zasady weryfikacji

- **fal.ai** — może służyć do modeli obraz/wideo, ale dostępność modeli i cennik nie oznaczają darmowego generowania. Ostatni znany odczyt konta wskazywał brak środków; nie uruchamiać generacji, dopóki użytkownik sam nie zdecyduje inaczej. Odczyty modeli i cen są dozwolone bez wysyłania zadań.
- **Runway** — sprawdzać aktualny darmowy limit i warunki. Nie zakładać, że plan Free obejmuje generowanie wideo bez ograniczeń.
- **HeyGen** — sprawdzać darmowy zakres lektora/wideo, limity i warunki komercyjne; nie uruchamiać płatnych zadań.
- **VideoGen** — przed użyciem ustalić, czy dostępne są darmowe kredyty, jakie czynności je zużywają i czy eksport jest objęty limitem. Nieznane saldo traktować jako niezweryfikowane.
- **Otwarte/lokalne rozwiązania** — aktywnie rozważać modele i narzędzia open-source, jeśli działają na urządzeniu lub darmowym środowisku bez ukrytych opłat. Nie zakładać, że telefon użytkownika ma moc do lokalnego renderowania AI.
- Połączenie aplikacji w ChatGPT nie oznacza, że te same credentials można wykorzystać w zewnętrznym Workerze. Integracja backendowa wymaga oficjalnego API i osobnych sekretów.

## Przepływ „automat z kontrolą”

### Faza A — przygotowanie (bez płatnych generacji)

1. Użytkownik podaje temat, język, długość, format i styl.
2. System przygotowuje scenariusz, rozdziały, sceny, opisy ujęć, tekst lektora, napisy i plan audio.
3. System proponuje darmowe źródła materiałów i oznacza elementy, które wymagają pliku użytkownika lub dodatkowej generacji.
4. Projekt otrzymuje status `draft` / `ready_for_review`. Ta faza nie może uruchamiać płatnych generacji ani zadań zużywających płatne kredyty.

### Faza B — przegląd i zatwierdzenie

5. Użytkownik widzi cały projekt: scenariusz, listę scen, czasy, materiały, lektora, muzykę, napisy i kolejność.
6. Użytkownik może edytować każdy element przed renderem.
7. System pokazuje źródła i licencje materiałów oraz rozróżnia:
   - darmowe i zweryfikowane,
   - darmowe, ale z ograniczeniami,
   - wymagające ręcznego pliku,
   - płatne,
   - o nieznanym koszcie lub statusie.
8. Domyślnie wybierane są wyłącznie opcje potwierdzone jako bezpłatne. Elementy płatne lub niezweryfikowane są pomijane albo blokują render do czasu decyzji.
9. Ekran podsumowania pokazuje koszt całkowity, zużycie darmowych limitów, ewentualne znaki wodne i ograniczenia licencji. Jeśli choć jedna pozycja ma nieznany koszt — nie można zatwierdzić płatnego renderu.
10. Użytkownik zatwierdza dokładny snapshot projektu. Dla wariantu 0 PLN potwierdza użycie wskazanych darmowych zasobów; każda płatna pozycja wymaga osobnej, wyraźnej zgody.

### Faza C — render i dostarczenie

11. Dopiero po zatwierdzeniu system tworzy zadania. Domyślnie wybiera darmowe zasoby; nie może samoczynnie przełączyć się na płatnego dostawcę.
12. Idempotencja zapobiega podwójnemu uruchomieniu tego samego renderu.
13. Interfejs pokazuje postęp, zużycie limitów, błędy i możliwość anulowania/wznowienia, jeśli dostawca to wspiera.
14. Po zakończeniu system waliduje MP4, synchronizację, napisy, audio i kompletność scen.
15. Użytkownik otrzymuje MP4 oraz edytowalny projekt. W razie błędu projekt pozostaje możliwy do poprawienia i ponowienia bez utraty pracy.

## Stany projektu i zadań

Projekt: `draft`, `ready_for_review`, `approved`, `approval_expired`.

Render: `queued`, `generating`, `assembling`, `validating`, `exporting`, `succeeded`, `failed`, `cancelled`, `blocked_cost`, `blocked_unknown_cost`, `blocked_free_limit`.

Każda zgoda zapisuje identyfikator/wersję snapshotu, wybranych dostawców, limit kosztu i datę. Zmiana któregokolwiek z tych elementów unieważnia zgodę.

## Architektura docelowa

1. **DARK EDITOR PWA** — interfejs, ustawienia filmu, lista projektów, podgląd i ręczna korekta.
2. **Backend API (Cloudflare Worker)** — walidacja, autoryzacja, kontrola limitów, kosztorys, zgody i statusy zadań. Sekrety wyłącznie po stronie serwera.
3. **Orkiestrator** — planowanie → przegląd → zatwierdzenie → pobranie/utworzenie materiałów → montaż → kontrola jakości → MP4.
4. **Adaptery dostawców** — wymienne moduły dla usług AI i lokalnych/darmowych źródeł. Adapter musi deklarować cenę, jednostkę rozliczenia, limit i warunki; brak danych oznacza blokadę.
5. **Magazyn projektu i plików** — wersjonowany manifest, stany zadań i bezpieczne odnośniki do materiałów.

## Etapy wdrożenia

### Etap 0 — zabezpieczenie
- Zachować kopię wersji 0.9.0.
- Pracować na osobnej gałęzi `dark-auto-foundation`.
- Nie modyfikować głównej gałęzi, dopóki zmiany nie przejdą testów.

### Etap 1 — darmowy fundament
- Utrzymać działający edytor i naprawić/zweryfikować zapis oraz przywracanie projektu.
- Zdefiniować manifest projektu i ekran przygotowania/przeglądu.
- Przygotować lokalny montaż/eksport i integracje darmowych zasobów bez kluczy płatnych usług.
- Dodać mechanizm blokady płatnych operacji domyślnie.

### Etap 2 — backend i bezpieczeństwo
- Utworzyć Worker API, endpoint zdrowia, walidację i CORS ograniczony do domeny aplikacji.
- Dodać rejestr zgód, snapshotów, zadań i kosztów.
- Sekrety dostawców jako ustawienia serwerowe; nie umieszczać kluczy w kodzie frontendu.
- Nie wdrażać adaptera dostawcy bez potwierdzonego API, limitu i modelu rozliczeń.

### Etap 3 — kontrakt projektu i orkiestrator
- Zdefiniować wersjonowany format projektu JSON.
- Wdrożyć statusy projektu i renderu opisane wyżej.
- Dodać idempotencję, wygasanie zgody po zmianie snapshotu i blokadę nieznanego kosztu.

### Etap 4 — darmowe źródła i eksport
- Dodać obsługę własnych plików, licencjonowanych darmowych mediów, napisów, lektora i muzyki.
- Zweryfikować eksport MP4 H.264/AAC i odtwarzanie na Androidzie.
- Nie dodawać płatnego fallbacku automatycznego.

### Etap 5 — opcjonalne integracje AI
- Najpierw testować tylko darmowe limity potwierdzone dla konkretnego konta i operacji.
- Przed każdą operacją sprawdzać, czy mieści się w bezpłatnym limicie i czy nie naliczy opłaty.
- Płatne integracje pozostają wyłączone do czasu odrębnej zgody użytkownika.

### Etap 6 — testy i publikacja
- Testy bez płatnych generacji na syntetycznych plikach.
- Testy zapisu/odtwarzania projektu i ponownego otwierania na Androidzie.
- Testy braku zgody, zmiany snapshotu, nieznanego kosztu, limitów, błędów i ponowienia.
- Dopiero po przejściu testów połączenie gałęzi z główną.

## Stan wyjściowy

- Frontend w repozytorium: pojedynczy `index.html`, wersja 0.9.0.
- Obecne funkcje: podgląd, ręczne dodawanie mediów, prosta oś czasu, napisy, plan scen i zapis części danych w localStorage.
- Brak backendu, bezpośrednich adapterów AI i potwierdzonego eksportu MP4 w aktualnym froncie.
- Kopia źródłowego pliku: `backups/index-0.9.0.html`.
- Prace rozwojowe: gałąź `dark-auto-foundation`.

## Kryterium ukończenia

Użytkownik może na telefonie wpisać temat, otrzymać kompletny projekt do sprawdzenia, poprawić go, zatwierdzić i wyeksportować działający MP4 z edytowalnym projektem. Domyślnie cały przepływ korzysta z darmowych, zweryfikowanych zasobów. Żadna płatna operacja nie uruchamia się bez osobnej, konkretnej zgody użytkownika.
