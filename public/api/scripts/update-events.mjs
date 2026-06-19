// scripts/update-events.mjs
// Jala datos reales de la API pública de ESPN y guarda el resultado en public/api/events.json
// Este script lo ejecuta GitHub Actions automáticamente cada día (ver .github/workflows/update.yml)

import { writeFileSync, mkdirSync } from 'fs';

const LIGAS = [
  { nombre: "MLB",              sport: "beisbol",    url: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard" },
  { nombre: "NBA",              sport: "basquetbol", url: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard" },
  { nombre: "NFL",              sport: "americano",  url: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard" },
  { nombre: "NHL",              sport: "hockey",     url: "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard" },
  { nombre: "MLS",              sport: "futbol",     url: "https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard" },
  { nombre: "Liga MX",          sport: "futbol",     url: "https://site.api.espn.com/apis/site/v2/sports/soccer/mex.1/scoreboard" },
  { nombre: "Premier League",   sport: "futbol",     url: "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard" },
  { nombre: "La Liga",          sport: "futbol",     url: "https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard" },
  { nombre: "Champions League", sport: "futbol",     url: "https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard" },
  { nombre: "ATP Tenis",        sport: "tenis",      url: "https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard" },
  { nombre: "WTA Tenis",        sport: "tenis",      url: "https://site.api.espn.com/apis/site/v2/sports/tennis/wta/scoreboard" },
];

function mapStatus(espnState) {
  if (espnState === 'in') return 'live';
  if (espnState === 'post') return 'done';
  return 'scheduled';
}

function fmtTimeCT(isoDate) {
  try {
    return new Date(isoDate).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago' }) + ' CT';
  } catch (e) { return ''; }
}

async function fetchLiga(liga) {
  const out = [];
  try {
    const resp = await fetch(liga.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!resp.ok) {
      console.error(`[${liga.nombre}] HTTP ${resp.status}`);
      return out;
    }
    const data = await resp.json();
    const events = data.events || [];

    events.forEach(ev => {
      const comp = ev.competitions && ev.competitions[0];
      if (!comp) return;
      const competitors = comp.competitors || [];
      const home = competitors.find(c => c.homeAway === 'home') || competitors[0] || {};
      const away = competitors.find(c => c.homeAway === 'away') || competitors[1] || {};
      const state = comp.status?.type?.state || 'pre';
      const status = mapStatus(state);

      const homeNm = home.team?.shortDisplayName || home.team?.displayName || home.athlete?.displayName || '—';
      const awayNm = away.team?.shortDisplayName || away.team?.displayName || away.athlete?.displayName || '—';

      let score = '';
      if (status !== 'scheduled') {
        score = `${awayNm} ${away.score ?? 0} - ${home.score ?? 0} ${homeNm}`;
      }

      let channel = '—';
      if (comp.broadcasts && comp.broadcasts.length) {
        channel = comp.broadcasts.map(b => (b.names || []).join(', ')).filter(Boolean).join(' / ') || '—';
      }

      out.push({
        id: `${liga.nombre.replace(/\s+/g, '')}-${ev.id}`,
        sport: liga.sport,
        liga: liga.nombre,
        teams: `${awayNm} vs ${homeNm}`,
        time: fmtTimeCT(ev.date),
        status,
        score,
        channel,
      });
    });
  } catch (err) {
    console.error(`[${liga.nombre}] Error:`, err.message);
  }
  return out;
}

async function main() {
  console.log('Actualizando eventos deportivos…');
  const results = await Promise.all(LIGAS.map(fetchLiga));
  const allEvents = results.flat();

  const now = new Date();
  const dateLabel = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Chicago' });
  const updatedAt = now.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Chicago' });

  const payload = {
    date_label: dateLabel,
    updated_at: updatedAt + ' CT',
    total: allEvents.length,
    live: allEvents.filter(e => e.status === 'live').length,
    events: allEvents,
  };

  mkdirSync('public/api', { recursive: true });
  writeFileSync('public/api/events.json', JSON.stringify(payload, null, 2));

  console.log(`Listo: ${allEvents.length} eventos guardados (${payload.live} en vivo).`);
}

main();
