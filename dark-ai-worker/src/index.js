const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
const CATEGORIES = new Set(["wiedza", "dokument", "historia", "reklama", "bajka"]);
const DURATIONS = new Set([30, 60, 180, 300, 600]);
const FORMATS = new Set(["16:9", "9:16", "1:1"]);
const TONES = new Set(["mroczny", "dynamiczny", "spokojny", "cieply"]);
const TEMPLATES = {
  wiedza: [["Mocne otwarcie", "Postaw pytanie, które zaciekawi widza."], ["Kontekst", "Wyjaśnij tło i znaczenie tematu."], ["Najważniejsze tropy", "Przedstaw fakty i wyraźnie oznacz hipotezy."], ["Co wiemy naprawdę?", "Oddziel potwierdzone informacje od spekulacji."], ["Finał", "Podsumuj i zostaw widza z pytaniem."]],
  dokument: [["Wprowadzenie", "Przedstaw bohatera lub zjawisko."], ["Tło wydarzeń", "Wyjaśnij miejsce, czas i okoliczności."], ["Świadectwa i fakty", "Pokaż dowody i dostępne relacje."], ["Punkt zwrotny", "Zmień perspektywę opowieści."], ["Podsumowanie", "Zbierz wnioski i otwarte pytania."]],
  historia: [["Zagadkowy ślad", "Zacznij od tajemniczego artefaktu lub wydarzenia."], ["Świat epoki", "Przenieś widza w realia historyczne."], ["Dostępne wyjaśnienia", "Przedstaw interpretacje i ich źródła."], ["Ukryty kontekst", "Dodaj szczegół zmieniający perspektywę."], ["Dziedzictwo tajemnicy", "Zakończ refleksją o historii."]],
  reklama: [["Problem klienta", "Pokaż potrzebę odbiorcy."], ["Rozwiązanie", "Przedstaw produkt lub usługę."], ["Korzyści", "Pokaż konkretne zastosowania."], ["Dowód jakości", "Dodaj demonstrację lub przykład."], ["Wezwanie do działania", "Wskaż następny krok."]],
  bajka: [["Początek przygody", "Poznaj bohatera i jego świat."], ["Wezwanie", "Pojawia się problem do rozwiązania."], ["Próby", "Bohater pokonuje przeszkody."], ["Wielkie rozwiązanie", "Odwaga lub przyjaźń pomaga rozwiązać problem."], ["Dobre zakończenie", "Zakończ ciepłą puentą."]]
};
const TONES = { mroczny: "Nie wszystko jest takie, jakim się wydaje. Im głębiej zaglądamy, tym więcej pojawia się pytań.", dynamiczny: "Przygotuj się na szybkie tempo, mocne fakty i zaskakujące zwroty.", spokojny: "Przyjrzyjmy się temu krok po kroku, bez pośpiechu i z dbałością o szczegóły.", cieply: "To opowieść, którą warto poznać. Usiądź wygodnie i ruszajmy razem w tę podróż." };
const VISUALS = ["Ciemne ujęcie otwierające, zbliżenie na detal i mocny tytuł.", "Mapa, archiwalne fotografie lub animowana oś czasu.", "Detale, grafiki objaśniające i krótkie plansze z faktami.", "Porównanie źródeł lub dwóch ujęć na ekranie.", "Powolne oddalenie kamery i pytanie końcowe."];
function json(data, status = 200, headers = {}) { return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } }); }
function cors(origin, env) {
  if (!origin) return {};
  const allowed = env.ALLOWED_ORIGIN;
  if (allowed && origin !== allowed) return null;
  if (!allowed && env.OPENAI_API_KEY) return null;
  return { "Access-Control-Allow-Origin": allowed || "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Vary": "Origin" };
}
function validate(input) {
  if (!input || typeof input !== "object" || typeof input.topic !== "string" || input.topic.trim().length < 4 || input.topic.length > 240) return "Temat musi mieć od 4 do 240 znaków.";
  if (!CATEGORIES.has(input.category)) return "Nieobsługiwany rodzaj filmu.";
  if (!DURATIONS.has(Number(input.duration))) return "Nieobsługiwana długość filmu.";
  if (!FORMATS.has(input.format)) return "Nieobsługiwany format obrazu.";
  if (!TONES.has(input.tone)) return "Nieobsługiwany klimat.";
  if (!["auto", "manual"].includes(input.mode)) return "Nieobsługiwany tryb pracy.";
  return null;
}
function makeMockProject(input) {
  const duration = Number(input.duration), plan = TEMPLATES[input.category], count = duration <= 60 ? 4 : duration <= 180 ? 5 : duration <= 300 ? 6 : 8;
  const scenes = Array.from({ length: count }, (_, i) => {
    const item = plan[i % plan.length];
    return { id: "scene-" + (i + 1), title: i === 0 ? "Otwarcie: " + item[0] : item[0], narration: (i === 0 ? "Wyobraź sobie, że " + input.topic + ". " + TONES[input.tone] : item[1] + " Temat tej sceny: " + input.topic), visual: VISUALS[i % VISUALS.length], seconds: Math.max(5, Math.round(duration / count)), approved: false };
  });
  return { version: 1, title: input.topic.trim(), category: input.category, duration, format: input.format, tone: input.tone, mode: input.mode, createdAt: new Date().toISOString(), script: scenes.map((s, i) => (i + 1) + ". " + s.title + "\n" + s.narration).join("\n\n"), scenes, provider: "mock", disclaimer: "To szkic demonstracyjny, nie scenariusz wygenerowany przez model AI." };
}
async function generateWithOpenAI(input, env) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": "Bearer " + env.OPENAI_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Jesteś polskim scenarzystą i producentem filmów. Zwróć wyłącznie poprawny JSON: {title,script,scenes:[{title,narration,visual,seconds}]}. Sceny muszą być rzeczowe, narracja po polsku, odróżniaj fakty od hipotez, nie wymyślaj źródeł. Dopasuj 4-8 scen do czasu filmu." },
        { role: "user", content: JSON.stringify({ topic: input.topic, category: input.category, durationSeconds: input.duration, format: input.format, tone: input.tone }) }
      ]
    }),
    signal: AbortSignal.timeout(45000)
  });
  if (!response.ok) throw new Error("Dostawca AI zwrócił błąd HTTP " + response.status + ".");
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Dostawca AI zwrócił pustą odpowiedź.");
  const data = JSON.parse(content);
  if (typeof data.script !== "string" || !Array.isArray(data.scenes) || data.scenes.length < 1 || data.scenes.length > 12) throw new Error("Dostawca AI zwrócił nieprawidłowy format scenariusza.");
  const scenes = data.scenes.map((scene, i) => ({
    id: "scene-" + (i + 1), title: String(scene.title || "Scena " + (i + 1)).slice(0, 160),
    narration: String(scene.narration || "").slice(0, 5000), visual: String(scene.visual || "").slice(0, 1000),
    seconds: Math.max(1, Math.min(600, Number(scene.seconds) || 5)), approved: false
  }));
  return { ...makeMockProject(input), title: String(data.title || input.topic).slice(0, 240), script: data.script.slice(0, 30000), scenes, provider: "openai", disclaimer: "Scenariusz wygenerowany przez skonfigurowanego dostawcę AI. Sprawdź fakty przed publikacją." };
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url), origin = request.headers.get("Origin"), corsHeaders = cors(origin, env);
    if (corsHeaders === null) return json({ error: "Origin nie jest dozwolony. Ustaw ALLOWED_ORIGIN w konfiguracji Worker." }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...corsHeaders, "Access-Control-Max-Age": "86400" } });
    if (url.pathname === "/api/health" && request.method === "GET") return json({ ok: true, service: "DARK AI", mode: env.OPENAI_API_KEY && env.OPENAI_MODEL && env.ENABLE_PAID_AI === "true" ? "provider-ready" : "mock", paidProviderConfigured: !!(env.OPENAI_API_KEY && env.OPENAI_MODEL), paidProviderEnabled: env.ENABLE_PAID_AI === "true" }, 200, corsHeaders);
    if (url.pathname !== "/api/generate" || request.method !== "POST") return json({ error: "Nie znaleziono endpointu." }, 404, corsHeaders);
    const length = Number(request.headers.get("Content-Length") || 0);
    if (length > 12000) return json({ error: "Żądanie jest zbyt duże." }, 413, corsHeaders);
    let input;
    try { input = await request.json(); } catch { return json({ error: "Nieprawidłowy JSON." }, 400, corsHeaders); }
    const invalid = validate(input);
    if (invalid) return json({ error: invalid }, 400, corsHeaders);
    const providerReady = !!(env.OPENAI_API_KEY && env.OPENAI_MODEL && env.ENABLE_PAID_AI === "true");
    if (!providerReady) return json({ project: makeMockProject(input), mode: "mock", paid: false }, 200, corsHeaders);
    const auth = request.headers.get("Authorization") || "";
    if (!env.DARK_AI_ACCESS_TOKEN || auth !== "Bearer " + env.DARK_AI_ACCESS_TOKEN) return json({ error: "Brak autoryzacji do płatnego dostawcy AI." }, 401, corsHeaders);
    if (input.confirmPaid !== true || input.costAcknowledged !== true) return json({ error: "Płatna generacja wymaga osobnego potwierdzenia kosztów dla tego zadania." }, 402, corsHeaders);
    try {
      const project = await generateWithOpenAI(input, env);
      return json({ project, mode: "provider", paid: true, costNotice: "Koszt zależy od wybranego modelu i użycia tokenów. Sprawdź cennik dostawcy przed uruchomieniem." }, 200, corsHeaders);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Nie udało się wygenerować scenariusza." }, 502, corsHeaders);
    }
  }
};
