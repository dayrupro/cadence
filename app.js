'use strict';
/* Cadence — agenda, bilan, progression et heures. 100 % hors ligne : tout est stocké sur l'appareil. */

/* =========================================================================
   Dates
   ========================================================================= */
function pad(n) { return String(n).padStart(2, '0'); }
function dkey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
function hm(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fmtLocal(d) { return `${dkey(d)}T${hm(d)}`; }
function parseLocal(s) {
  const [date, time = '00:00'] = s.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}
function toMin(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function fromMin(m) { return `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`; }
function sod(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function today() { return sod(new Date()); }
function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes()); }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function wd(d) { return ((d.getDay() + 6) % 7) + 1; } // lundi = 1 … dimanche = 7
function startOfWeek(d) { return addDays(sod(d), 1 - wd(d)); }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function sameDay(a, b) { return dkey(a) === dkey(b); }
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
}

const DOW = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MON = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MON_S = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function fmtDayLong(d) { return cap(`${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`); }
function fmtShort(d) { return `${d.getDate()} ${MON_S[d.getMonth()]}`; }
function fmtShortYear(d) { return `${fmtShort(d)} ${d.getFullYear()}`; }
function fmtMonthYear(d) { return cap(`${MON[d.getMonth()]} ${d.getFullYear()}`); }
function relDay(d) {
  const diff = Math.round((sod(d) - today()) / 864e5);
  return diff === 0 ? "Aujourd'hui" : diff === -1 ? 'Hier' : diff === 1 ? 'Demain' : null;
}
function fmtDur(m) {
  m = Math.round(m);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${pad(r)}` : `${h} h`;
}
function pct(v) { return `${Math.round(v * 100)} %`; }
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/* =========================================================================
   Catégories
   ========================================================================= */
const CATS = [
  ['cours', 'Cours', '#5c85ff', true],
  ['revisions', 'Révisions', '#9e85ff', true],
  ['business', 'Business', '#f7a133', true],
  ['sport', 'Sport', '#42c778', true],
  ['apprentissage', 'Apprentissage', '#33c7db', true],
  ['organisation', 'Organisation', '#f061a3', true],
  ['vie', 'Vie quotidienne', '#999eae', false],
  ['sommeil', 'Sommeil', '#85a1cc', false],
].map(([id, label, color, scored]) => ({ id, label, color, scored }));
const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));
function cat(id) { return CAT[id] || CAT.organisation; }

const RULES = [
  ['sommeil', ['sleep', 'sommeil', 'dodo', 'dormir', 'sieste', 'nap', 'coucher']],
  ['vie', ['reveil', 'wake', 'morning', 'routine', 'breakfast', 'dejeuner', 'lunch', 'diner', 'dinner', 'meal', 'repas',
    'gouter', 'snack', 'brunch', 'shower', 'douche', 'skincare', 'menage', 'courses', 'trajet', 'commute', 'toilette', 'cuisine', 'rangement']],
  ['sport', ['workout', 'sport', 'gym', 'muscu', 'run', 'footing', 'jogging', 'foot', 'basket', 'tennis', 'natation', 'swim',
    'yoga', 'boxe', 'velo', 'cardio', 'stretch', 'salle', 'marche', 'padel']],
  ['revisions', ['revision', 'reviser', 'study', 'studying', 'etude', 'exam', 'fiche', 'flashcard', 'anki', 'exercice', 'devoir', 'homework', 'preparation', 'prepa']],
  ['cours', ['cours', 'class', 'lecture', 'td', 'tp', 'amphi', 'conference', 'conversation', 'anglais', 'seminaire', 'partiel', 'lesson']],
  ['business', ['resell', 'business', 'vinted', 'vente', 'client', 'shop', 'ecom', 'freelance', 'travail', 'work', 'boulot', 'job', 'prospection', 'stock']],
  ['apprentissage', ['learning', 'learn', 'skill', 'language', 'langue', 'content', 'livre', 'book', 'reading', 'lire', 'podcast',
    'formation', 'tuto', 'course', 'apprendre', 'duolingo']],
  ['organisation', ['planning', 'organisation', 'organiser', 'admin', 'bilan', 'review', 'plan', 'mail', 'email', 'todo', 'weekly', 'agenda']],
];
function norm(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
// null quand aucun mot-clé ne correspond : l'import applique alors la catégorie par défaut du calendrier.
function guessCatOrNull(title) {
  const words = norm(title).split(/[^a-z0-9]+/).filter(Boolean);
  for (const [c, kws] of RULES) if (words.some(w => kws.some(k => w.startsWith(k)))) return c;
  return null;
}
function guessCat(title) { return guessCatOrNull(title) || 'organisation'; }
function calendarCat(name) {
  const n = norm(name);
  if (/(school|ecole|fac|univ|cours|etude|college|lycee)/.test(n)) return 'cours';
  if (/(fete|ferie|holiday|anniv|birthday|perso|care)/.test(n)) return 'vie';
  return guessCatOrNull(name) || 'organisation';
}

/* =========================================================================
   Données (stockage local de l'appareil)
   ========================================================================= */
const KEY = 'cadence.v1';
function emptyState() { return { events: [], logs: {}, settings: { goal: 0.7, firstUse: dkey(new Date()) } }; }
const S = (() => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.events)) {
      const base = emptyState();
      return { events: s.events, logs: s.logs || {}, settings: { ...base.settings, ...s.settings } };
    }
  } catch (e) { /* données illisibles : on repart à vide sans écraser avant la première écriture */ }
  return emptyState();
})();
const memo = new Map();
function save() {
  memo.clear();
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Sauvegarde impossible : stockage plein'); }
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* =========================================================================
   Événements et répétitions
   Un événement : { id, title, cat, start:'AAAA-MM-JJTHH:MM', dur (min), allDay, loc, notes,
                    rec: null | { freq, interval, days[1-7], until:'AAAA-MM-JJ', count },
                    ex: { 'AAAA-MM-JJ': null (supprimée) | { start, dur, title, cat, loc, notes } } }
   ========================================================================= */
function getEv(id) { return S.events.find(e => e.id === id); }

// Jours (à minuit) où démarre une occurrence, dans l'ordre, jusqu'à `until` inclus.
function* seriesDays(ev, until) {
  const base = sod(parseLocal(ev.start));
  const r = ev.rec, iv = Math.max(1, r.interval || 1), max = r.count || Infinity;
  let end = until;
  if (r.until) { const u = parseKey(r.until); if (u < end) end = u; }
  let n = 0;
  if (r.freq === 'daily') {
    for (let d = base; d <= end && n < max; d = addDays(d, iv), n++) yield d;
  } else if (r.freq === 'weekly') {
    const days = (r.days && r.days.length ? [...r.days] : [wd(base)]).sort((a, b) => a - b);
    for (let w = startOfWeek(base); w <= end; w = addDays(w, 7 * iv)) {
      for (const k of days) {
        const d = addDays(w, k - 1);
        if (d < base) continue;
        if (d > end || n >= max) return;
        n++;
        yield d;
      }
    }
  } else if (r.freq === 'monthly' || r.freq === 'yearly') {
    const step = r.freq === 'monthly' ? iv : 12 * iv;
    for (let i = 0; n < max; i += step) {
      const d = new Date(base.getFullYear(), base.getMonth() + i, base.getDate());
      if (d > end) return;
      if (d.getDate() !== base.getDate()) continue;
      n++;
      yield d;
    }
  }
}

// Occurrences qui chevauchent [from, to[ (dates à minuit).
function occurrences(from, to) {
  const mk = `${+from}|${+to}`;
  if (memo.has(mk)) return memo.get(mk);
  const out = [];
  const push = (ev, key, s, dur, o) => {
    const e = new Date(+s + dur * 60000);
    if (!(e > from && s < to) && !(dur === 0 && s >= from && s < to)) return;
    out.push({
      id: `${ev.id}|${key}`, evId: ev.id, key, start: s, end: e, allDay: !!ev.allDay, recurring: !!ev.rec,
      title: (o && o.title) || ev.title, cat: (o && o.cat) || ev.cat,
      loc: (o && o.loc != null ? o.loc : ev.loc) || '', notes: (o && o.notes != null ? o.notes : ev.notes) || '',
    });
  };
  for (const ev of S.events) {
    const base = parseLocal(ev.start);
    if (!ev.rec) { push(ev, dkey(base), base, ev.dur, null); continue; }
    const scanFrom = addDays(from, -(Math.ceil(ev.dur / 1440) + 1));
    for (const d of seriesDays(ev, addDays(to, 1))) {
      if (d < scanFrom) continue;
      const key = dkey(d);
      const o = ev.ex && ev.ex[key];
      if (o === null) continue;
      const s = o && o.start ? parseLocal(o.start) : new Date(d.getFullYear(), d.getMonth(), d.getDate(), base.getHours(), base.getMinutes());
      push(ev, key, s, o && o.dur != null ? o.dur : ev.dur, o);
    }
  }
  out.sort((a, b) => a.start - b.start || b.end - a.end);
  memo.set(mk, out);
  return out;
}

/* =========================================================================
   Bilan et statistiques
   Une journée : { entries: { idOccurrence: { s:'done'|'partial'|'missed', m } }, extras: [{ id, title, cat, m }],
                   note, closedAt, snapshot: [{ id, title, cat, start, end }] }
   ========================================================================= */
function mins(a) { return Math.max(0, Math.round((a.end - a.start) / 60000)); }
function realized(a, e) {
  if (!e) return 0;
  const m = mins(a);
  if (e.s === 'done') return m;
  if (e.s === 'partial') return Math.min(m, e.m ?? Math.floor(m / 2));
  return 0;
}
function getLog(k) { return S.logs[k] || { entries: {}, extras: [], note: '' }; }
function editLog(k, fn) {
  const l = S.logs[k] || (S.logs[k] = { entries: {}, extras: [], note: '' });
  fn(l);
  save();
}
function isClosed(k) { return !!(S.logs[k] && S.logs[k].closedAt); }
function fromSnap(a) { return { ...a, start: parseLocal(a.start), end: parseLocal(a.end) }; }

// Activités d'une journée : figées si la journée est clôturée, sinon lues dans l'agenda.
function dayActs(day) {
  const k = dkey(day), l = S.logs[k];
  if (l && l.closedAt && l.snapshot) return l.snapshot.map(fromSnap);
  return occurrences(sod(day), addDays(sod(day), 1)).filter(o => !o.allDay && dkey(o.start) === k);
}
function actsInRange(from, to) {
  const map = new Map();
  for (let d = from; d < to; d = addDays(d, 1)) map.set(dkey(d), []);
  for (const o of occurrences(from, to)) {
    if (o.allDay) continue;
    const k = dkey(o.start);
    if (map.has(k)) map.get(k).push(o);
  }
  for (const k of map.keys()) {
    const l = S.logs[k];
    if (l && l.closedAt && l.snapshot) map.set(k, l.snapshot.map(fromSnap));
  }
  return map;
}
function summary(k, acts) {
  acts = acts || dayActs(parseKey(k));
  const l = getLog(k);
  const s = { planned: 0, realized: 0, count: 0, done: 0, filled: 0, rCount: 0, rDone: 0 };
  for (const a of acts) {
    const e = l.entries[a.id];
    if (cat(a.cat).scored) {
      s.count++;
      s.planned += mins(a);
      s.realized += realized(a, e);
      if (e) s.filled++;
      if (e && e.s === 'done') s.done++;
    } else {
      s.rCount++;
      if (e && e.s === 'done') s.rDone++;
    }
  }
  for (const x of l.extras || []) if (cat(x.cat).scored) s.realized += x.m;
  s.score = s.planned > 0 ? s.realized / s.planned : (s.realized > 0 ? 1 : null);
  s.unfilled = s.count - s.filled;
  return s;
}
function scoreColor(v) {
  const g = S.settings.goal;
  return v >= g ? 'var(--good)' : v >= g * 0.6 ? 'var(--warn)' : 'var(--bad)';
}
function isSuccess(s) { return (s.score ?? 1) >= S.settings.goal; }

// Totaux par catégorie. Le réalisé et le prévu « à date » s'arrêtent à aujourd'hui et commencent au premier jour de suivi.
function totals(from, to) {
  const t = today(), first = parseKey(S.settings.firstUse), out = {};
  const get = c => out[c] || (out[c] = { all: 0, toDate: 0, real: 0 });
  for (const [k, acts] of actsInRange(from, to)) {
    const d = parseKey(k), toDate = d <= t && d >= first, l = getLog(k);
    for (const a of acts) {
      const x = get(a.cat);
      x.all += mins(a);
      if (toDate) { x.toDate += mins(a); x.real += realized(a, l.entries[a.id]); }
    }
    if (toDate) for (const e of l.extras || []) get(e.cat).real += e.m;
  }
  return out;
}
function dailyPoints(from, to, planned) {
  const t = today(), res = [];
  for (const [k, acts] of actsInRange(from, to)) {
    const d = parseKey(k), l = getLog(k), per = {};
    for (const a of acts) per[a.cat] = (per[a.cat] || 0) + (planned ? mins(a) : (d <= t ? realized(a, l.entries[a.id]) : 0));
    if (!planned) for (const e of l.extras || []) per[e.cat] = (per[e.cat] || 0) + e.m;
    res.push({ d, per });
  }
  return res;
}
function closedDays() {
  return Object.keys(S.logs).filter(isClosed).sort().map(k => ({ k, d: parseKey(k), s: summary(k) }));
}
// Série en cours (aujourd'hui non clôturé ne la casse pas) et record.
function streaks(days) {
  if (!days.length) return { cur: 0, best: 0 };
  const ok = new Map(days.map(x => [x.k, isSuccess(x.s)]));
  const t = today();
  let run = 0, best = 0;
  for (let d = days[0].d; d <= t; d = addDays(d, 1)) {
    const k = dkey(d);
    if (ok.get(k) === true) { run++; best = Math.max(best, run); }
    else if (!(sameDay(d, t) && !ok.has(k))) run = 0;
  }
  return { cur: run, best };
}
// Journées passées (14 derniers jours max) avec des activités mais pas encore clôturées.
function pendingDays() {
  const t = today();
  let start = addDays(t, -14);
  const first = parseKey(S.settings.firstUse);
  if (first > start) start = first;
  if (start >= t) return [];
  const res = [];
  for (const [k, acts] of actsInRange(start, t)) if (!isClosed(k) && acts.some(a => cat(a.cat).scored)) res.push(k);
  return res;
}

/* =========================================================================
   Import du Calendrier Apple (.ics)
   ========================================================================= */
const tzCache = new Map();
function tzOffset(tz, t) {
  let f = tzCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    tzCache.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map(x => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - t;
}
function fromZone(Y, M, D, h, mi, tz) {
  try {
    const guess = Date.UTC(Y, M, D, h, mi);
    const off = tzOffset(tz, guess);
    let t = guess - off;
    const off2 = tzOffset(tz, t);
    if (off2 !== off) t = guess - off2;
    return new Date(t);
  } catch (e) { return null; }
}
function icsDate(v, p = {}) {
  if (p.VALUE === 'DATE' || /^\d{8}$/.test(v)) return { d: new Date(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8)), allDay: true };
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!m) return null;
  const [, Y, M, D, h, mi, s, z] = m;
  if (z) return { d: new Date(Date.UTC(+Y, +M - 1, +D, +h, +mi, +(s || 0))), allDay: false };
  if (p.TZID) { const d = fromZone(+Y, +M - 1, +D, +h, +mi, p.TZID); if (d) return { d, allDay: false }; }
  return { d: new Date(+Y, +M - 1, +D, +h, +mi), allDay: false };
}
function icsDuration(v) {
  const m = v.match(/^[+-]?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  return (+m[1] || 0) * 10080 + (+m[2] || 0) * 1440 + (+m[3] || 0) * 60 + (+m[4] || 0);
}
function icsRRule(v) {
  const r = Object.fromEntries(v.split(';').map(x => x.split('=')));
  const freq = { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly' }[r.FREQ];
  if (!freq) return null;
  const rec = { freq, interval: +r.INTERVAL || 1 };
  if (r.BYDAY && (freq === 'weekly' || freq === 'daily')) {
    const map = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 7 };
    rec.days = r.BYDAY.split(',').map(x => map[x.slice(-2)]).filter(Boolean).sort((a, b) => a - b);
    if (freq === 'daily') { rec.freq = 'weekly'; rec.interval = 1; }
  }
  if (r.UNTIL) { const u = icsDate(r.UNTIL); if (u) rec.until = dkey(u.d); }
  if (r.COUNT) rec.count = +r.COUNT;
  return rec;
}
function unescIcs(s) { return s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1'); }
function parseICS(text) {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  let calName = '', cur = null, depth = 0;
  const vevents = [];
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = { props: {}, exdates: [] }; depth = 0; continue; }
    if (line === 'END:VEVENT') { if (cur) vevents.push(cur); cur = null; continue; }
    if (cur && line.startsWith('BEGIN:')) { depth++; continue; }
    if (cur && line.startsWith('END:')) { depth--; continue; }
    const m = line.match(/^([A-Za-z0-9-]+)((?:;[^:]*)?):(.*)$/);
    if (!m) continue;
    const name = m[1].toUpperCase(), value = m[3], params = {};
    m[2].split(';').slice(1).forEach(p => { const i = p.indexOf('='); params[p.slice(0, i).toUpperCase()] = p.slice(i + 1).replace(/^"|"$/g, ''); });
    if (!cur) { if (name === 'X-WR-CALNAME') calName = unescIcs(value); continue; }
    if (depth > 0) continue;
    if (name === 'EXDATE') cur.exdates.push({ params, value });
    else if (!cur.props[name]) cur.props[name] = { params, value };
  }
  const masters = new Map(), overrides = [];
  for (const ve of vevents) {
    const P = ve.props;
    if (!P.DTSTART) continue;
    const st = icsDate(P.DTSTART.value, P.DTSTART.params);
    if (!st) continue;
    let dur = st.allDay ? 1440 : 0;
    if (P.DTEND) { const en = icsDate(P.DTEND.value, P.DTEND.params); if (en) dur = Math.round((en.d - st.d) / 60000); }
    else if (P.DURATION) dur = icsDuration(P.DURATION.value);
    if (st.allDay) dur = Math.max(1, Math.round(dur / 1440)) * 1440;
    dur = Math.max(0, dur);
    const title = unescIcs(P.SUMMARY ? P.SUMMARY.value : '').trim() || 'Sans titre';
    const fields = {
      title, start: fmtLocal(st.d), dur, allDay: st.allDay,
      loc: P.LOCATION ? unescIcs(P.LOCATION.value) : '', notes: P.DESCRIPTION ? unescIcs(P.DESCRIPTION.value) : '',
    };
    const uidv = P.UID ? P.UID.value : uid();
    const cancelled = P.STATUS && P.STATUS.value.toUpperCase() === 'CANCELLED';
    if (P['RECURRENCE-ID']) {
      const rid = icsDate(P['RECURRENCE-ID'].value, P['RECURRENCE-ID'].params);
      if (rid) overrides.push({ uid: uidv, key: dkey(rid.d), cancelled, fields });
      continue;
    }
    if (cancelled) continue;
    const ev = { id: uid(), uid: uidv, src: 'ics', ...fields, cat: guessCatOrNull(title), rec: P.RRULE ? icsRRule(P.RRULE.value) : null, ex: {} };
    for (const x of ve.exdates) for (const v of x.value.split(',')) { const d = icsDate(v.trim(), x.params); if (d) ev.ex[dkey(d.d)] = null; }
    masters.set(uidv + '|' + (ev.rec ? 'r' : ev.start), ev);
  }
  const byUid = new Map([...masters.values()].filter(e => e.rec).map(e => [e.uid, e]));
  for (const o of overrides) {
    const m = byUid.get(o.uid);
    if (m) m.ex[o.key] = o.cancelled ? null : { start: o.fields.start, dur: o.fields.dur, title: o.fields.title };
    else if (!o.cancelled) masters.set(o.uid + '|' + o.fields.start, { id: uid(), uid: o.uid + '|' + o.key, src: 'ics', ...o.fields, cat: guessCatOrNull(o.fields.title), rec: null, ex: {} });
  }
  return { calName, events: [...masters.values()] };
}
// Ne garde que ce qui a encore lieu à partir de `since`.
function filterSince(events, since) {
  return events.filter(ev => {
    if (!ev.rec) return +parseLocal(ev.start) + ev.dur * 60000 >= +since;
    if (ev.rec.until) return parseKey(ev.rec.until) >= since;
    if (ev.rec.count) { let last = null; for (const d of seriesDays(ev, addDays(since, 3660))) last = d; return last && last >= since; }
    return true;
  });
}
// Export du Mac : les occurrences supprimées d'une série sont déduites de celles qui existent encore.
function withMissingOccurrences(ev) {
  const { present, windowEnd, ...rest } = ev;
  if (!rest.rec || !present || !windowEnd) return rest;
  const have = new Set(present), ex = { ...(rest.ex || {}) };
  for (const d of seriesDays(rest, addDays(parseKey(windowEnd), -1))) {
    const k = dkey(d);
    if (!have.has(k) && !(k in ex)) ex[k] = null;
  }
  return { ...rest, ex };
}
function importEvents(list) {
  let added = 0, updated = 0;
  const byUid = new Map(S.events.filter(e => e.uid).map(e => [e.uid, e]));
  for (const ev of list) {
    const ex = ev.uid && byUid.get(ev.uid);
    if (ex) { Object.assign(ex, { ...ev, id: ex.id, cat: ex.cat }); updated++; }
    else { S.events.push({ ...ev, id: ev.id || uid(), ex: ev.ex || {} }); added++; }
  }
  save();
  return { added, updated };
}

/* =========================================================================
   Interface
   ========================================================================= */
const ui = {
  tab: 'agenda', agendaDate: today(), agendaMode: 'day', scrollHour: true, occMap: new Map(),
  bilanDate: today(), routineOpen: false,
  span: 14, hPeriod: 'week', hMode: 'done', hAnchor: today(), hRoutine: false,
  draft: null, extra: null, importData: null, sheetRender: null, chooseResolve: null, chooseOpts: [],
};
try { ui.hRoutine = localStorage.getItem('cadence.hRoutine') === '1'; } catch (e) { /* facultatif */ }

const $ = s => document.querySelector(s);
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  upload: '<path d="M12 15V3M7 8l5-5 5 5M5 21h14"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
};
function icon(n) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>`;
}
function header(title, right, extra = '') {
  return `<header class="head"><div><div class="sub">${fmtDayLong(new Date())}</div><div class="toprow"><h1>${title}</h1>` +
    `<div class="btns">${right}</div></div></div>${extra}</header>`;
}
const settingsBtn = () => `<button class="icon-btn" data-act="settings" aria-label="Réglages">${icon('sliders')}</button>`;
function catChips(selected, act) {
  return `<div class="chips">${CATS.map(c => `<button class="chip ${c.id === selected ? 'on' : ''}" style="--c:${c.color}" data-act="${act}" data-cat="${c.id}"><i></i>${c.label}</button>`).join('')}</div>`;
}
function legend() {
  return `<div class="legend">${CATS.map(c => `<span style="--c:${c.color}"><i></i>${c.label}</span>`).join('')}</div>`;
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2400);
}

function render() {
  const main = $('#main');
  const prev = main.querySelector('.scroll');
  const keep = main.dataset.tab === ui.tab && prev ? prev.scrollTop : null;
  main.innerHTML = { agenda: renderAgenda, bilan: renderBilan, progression: renderProgression, heures: renderHeures }[ui.tab]();
  main.dataset.tab = ui.tab;
  const sc = main.querySelector('.scroll');
  if (ui.tab === 'agenda' && ui.scrollHour) {
    const grid = sc.querySelector('.grid');
    const gridTop = grid.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
    sc.scrollTop = S.events.length ? Math.max(0, gridTop + ui.agendaTargetY + TOP - 4) : 0;
    ui.scrollHour = false;
  } else if (keep != null) sc.scrollTop = keep;
  const dir = ui.slide, weekDir = ui.slideWeek;
  ui.slide = 0;
  ui.slideWeek = 0;
  if (dir) main.querySelectorAll('.slidable').forEach(el => el.classList.add(dir > 0 ? 'in-next' : 'in-prev'));
  if (weekDir) main.querySelectorAll('.slidable-week').forEach(el => el.classList.add(weekDir > 0 ? 'in-next' : 'in-prev'));
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === ui.tab));
}

/* ---------- Changement de jour (avec transition) ---------- */
function dayDiff(a, b) { return Math.round((sod(b) - sod(a)) / 864e5); }
function goAgenda(date) {
  const old = ui.agendaDate, n = dayDiff(old, date);
  ui.agendaDate = sod(date);
  ui.slide = Math.sign(n);
  ui.slideWeek = dkey(startOfWeek(old)) !== dkey(startOfWeek(date)) ? Math.sign(n) : 0;
  ui.scrollHour = true;
  render();
}
function goBilan(date) {
  ui.slide = Math.sign(dayDiff(ui.bilanDate, date));
  ui.bilanDate = sod(date);
  render();
}

/* ---------- Agenda ---------- */
const H = 64, TOP = 12, MINB = 20;
function yOf(t, s0) { return TOP + (t - s0) / 3600000 * H; }

// Répartit les événements qui se chevauchent en colonnes côte à côte.
function layout(items) {
  const minMs = MINB / H * 3600000, res = [];
  items.sort((a, b) => a.ds - b.ds || b.de - a.de);
  let cluster = [], ends = [], cEnd = -Infinity;
  const flush = () => { const n = Math.max(1, ends.length); cluster.forEach(([it, c]) => res.push({ ...it, col: c, cols: n })); cluster = []; ends = []; };
  for (const it of items) {
    const end = Math.max(it.de, it.ds + minMs);
    if (it.ds >= cEnd) { flush(); cEnd = -Infinity; }
    let c = ends.findIndex(e => e <= it.ds);
    if (c < 0) { ends.push(end); c = ends.length - 1; } else ends[c] = end;
    cluster.push([it, c]);
    cEnd = Math.max(cEnd, end);
  }
  flush();
  return res;
}

/* Échelle de temps : liste de repères { t (minutes depuis minuit), y (px) }, interpolée entre deux repères. */
function linearMap() { return [{ t: 0, y: TOP }, { t: 1440, y: TOP + 24 * H }]; }
function tToY(pts, m) {
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i];
    if (m <= q.t) return q.t === p.t ? q.y : p.y + (q.y - p.y) * (m - p.t) / (q.t - p.t);
  }
  return pts[pts.length - 1].y;
}
function yToT(pts, y) {
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i];
    if (y <= q.y) return q.y === p.y ? q.t : p.t + (q.t - p.t) * (y - p.y) / (q.y - p.y);
  }
  return pts[pts.length - 1].t;
}

// Vue Jour : chaque activité occupe toute la largeur et au moins une ligne lisible (ROW).
// Les activités qui se chevauchent sont empilées l'une sous l'autre ; l'échelle s'étire localement si besoin.
const ROW = 32, GAP = 2, LINE = 20;
const measureCtx = document.createElement('canvas').getContext('2d');
function textWidth(text, font) {
  measureCtx.font = `${font} -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif`;
  return measureCtx.measureText(text).width;
}
// Hauteur minimale pour lire tout le titre : une ligne si titre + heure tiennent, sinon le titre passe à la ligne.
function bandNeed(o, stacked) {
  const avail = $('#main').clientWidth - 56 - 8 - 4 - 24 - 20;
  const time = stacked ? `${hm(o.start)} – ${hm(o.end)}` : hm(o.start);
  if (textWidth(o.title, '600 15px') + 10 + textWidth(time, '400 15px') <= avail) return { h: ROW, oneLine: true };
  const lines = Math.min(4, Math.ceil(textWidth(o.title, '600 16px') / avail));
  return { h: 14 + lines * LINE + 20, oneLine: false };
}
function dayLayout(items, s0) {
  const evs = items.map(it => {
    const a = (it.ds - s0) / 60000;
    return { o: it.o, a, b: Math.max((it.de - s0) / 60000, a) };
  }).sort((x, y) => x.a - y.a || y.b - x.b);
  const clusters = [];
  for (const e of evs) {
    const c = clusters[clusters.length - 1];
    if (c && e.a < c.b) { c.items.push(e); c.b = Math.max(c.b, e.b); }
    else clusters.push({ a: e.a, b: e.b, items: [e] });
  }
  const px = m => m / 60 * H, pts = [{ t: 0, y: TOP }], bands = [];
  let y = TOP, t = 0;
  for (const c of clusters) {
    if (c.a > t) { y += px(c.a - t); t = c.a; pts.push({ t, y }); }
    // Chaque activité garde au moins la hauteur de sa propre durée : seul le chevauchement étire l'échelle.
    const n = c.items.length, mins = c.items.map(e => { const m = bandNeed(e.o, n > 1); return { ...m, h: Math.max(m.h, px(e.b - e.a) - GAP) }; });
    const need = mins.reduce((x, m) => x + m.h, 0) + (n - 1) * GAP, h = Math.max(px(c.b - c.a), need);
    const weights = c.items.map(e => Math.max(e.b - e.a, 1)), total = weights.reduce((x, w) => x + w, 0);
    let by = y;
    c.items.forEach((e, i) => {
      const bh = mins[i].h + (h - need) * weights[i] / total;
      bands.push({ o: e.o, y: by, h: bh, stacked: n > 1, oneLine: mins[i].oneLine });
      by += bh + GAP;
    });
    y += h;
    t = c.b;
    pts.push({ t, y });
  }
  if (t < 1440) pts.push({ t: 1440, y: y + px(1440 - t) });
  return { pts, bands };
}
function bandHTML(b) {
  const o = b.o, c = cat(o.cat), h = b.h - GAP;
  const e = getLog(dkey(o.start)).entries[o.id], st = e ? e.s : '';
  const short = h < 50 && b.oneLine;
  const mark = st ? `<em class="st ${st}"></em>` : '';
  const time = short && !b.stacked ? hm(o.start) : `${hm(o.start)} – ${hm(o.end)}`;
  return `<div class="ev band ${o.cat}${short ? ' short' : ''}${st ? ' ' + st : ''}" data-act="open-occ" data-id="${esc(o.id)}" ` +
    `style="--c:${c.color};top:${b.y}px;height:${h}px"><b>${esc(o.title)}</b><span>${time}</span>${mark}</div>`;
}

function evHTML(p, s0, compact) {
  const o = p.o, c = cat(o.cat);
  const top = yOf(p.ds, s0), h = Math.max(MINB, yOf(p.de, s0) - top - 2);
  const e = getLog(dkey(o.start)).entries[o.id], st = e ? e.s : '';
  const short = !compact && h < 46;
  const mark = st ? `<em class="st ${st}"></em>` : '';
  const inner = compact ? `<b>${esc(o.title)}</b>`
    : short ? `<b>${esc(o.title)}</b><span>${hm(o.start)}</span>${mark}`
    : `<b>${esc(o.title)}</b><span>${hm(o.start)} – ${hm(o.end)}</span>${mark}`;
  return `<div class="ev ${o.cat}${compact ? ' compact' : ''}${short ? ' short' : ''}${st ? ' ' + st : ''}" data-act="open-occ" data-id="${esc(o.id)}" ` +
    `style="--c:${c.color};top:${top}px;height:${h}px;left:calc(${p.col * 100 / p.cols}% + 2px);width:calc(${100 / p.cols}% - 4px)">${inner}</div>`;
}

function renderAgenda() {
  const d = ui.agendaDate, week = ui.agendaMode === 'week', t = today();
  const days = week ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(d), i)) : [d];
  const from = days[0], to = addDays(days[days.length - 1], 1);
  const occ = occurrences(from, to);
  ui.occMap = new Map(occ.map(o => [o.id, o]));

  const right = `<button class="pill" data-act="agenda-today">Aujourd'hui</button>` +
    `<button class="icon-btn" data-act="new-event" aria-label="Nouvel événement">${icon('plus')}</button>${settingsBtn()}`;
  let nav;
  if (week) {
    nav = `<div class="weeknav"><button data-act="agenda-shift" data-n="-7" aria-label="Semaine précédente">${icon('left')}</button>` +
      `<b class="slidable">${fmtShort(days[0])} – ${fmtShort(days[6])}</b><button data-act="agenda-shift" data-n="7" aria-label="Semaine suivante">${icon('right')}</button></div>` +
      `<div class="weekhead slidable">${days.map((x, i) => `<button class="${sameDay(x, t) ? 'today' : ''}" data-act="week-day" data-day="${dkey(x)}"><small>${LETTERS[i]}</small><b>${x.getDate()}</b></button>`).join('')}</div>`;
  } else {
    const s = startOfWeek(d);
    nav = `<div class="strip" data-swipe="agenda-week"><button class="chev" data-act="agenda-shift" data-n="-7" aria-label="Semaine précédente">${icon('left')}</button><div class="slide-days slidable-week">` +
      Array.from({ length: 7 }, (_, i) => {
        const x = addDays(s, i);
        return `<button class="day${sameDay(x, t) ? ' today' : ''}${sameDay(x, d) ? ' sel' : ''}" data-act="agenda-pick" data-day="${dkey(x)}"><small>${LETTERS[i]}</small><b>${x.getDate()}</b></button>`;
      }).join('') +
      `</div><button class="chev" data-act="agenda-shift" data-n="7" aria-label="Semaine suivante">${icon('right')}</button></div>`;
  }
  const extra = `<div class="monthrow"><div class="month"><b>${fmtMonthYear(d)}</b> <span>· sem. ${isoWeek(d)}</span></div>` +
    `<div class="seg"><button class="${week ? '' : 'on'}" data-act="agenda-mode" data-mode="day">Jour</button>` +
    `<button class="${week ? 'on' : ''}" data-act="agenda-mode" data-mode="week">Semaine</button></div></div>${nav}`;

  let body = '';
  if (!S.events.length) {
    body += `<div class="card empty"><b>Ton agenda est vide</b><p class="muted">Importe ton Calendrier Apple une fois pour toutes, ou touche + pour créer ton premier événement.</p>` +
      `<button class="btn-secondary" data-act="settings">${icon('upload')} Importer mon calendrier</button></div>`;
  }
  if (!week) body += `<div class="dayhead"><b>${fmtDayLong(d)}</b>${relDay(d) ? `<span>${relDay(d)}</span>` : ''}</div>`;

  const allDay = days.map(day => occ.filter(o => o.allDay && o.end > sod(day) && o.start < addDays(sod(day), 1)));
  if (allDay.some(a => a.length)) {
    body += `<div class="allday"><span>Journée</span><div class="adcols">${allDay.map(a => `<div>${a.map(o =>
      `<button class="adev" style="--c:${cat(o.cat).color}" data-act="open-occ" data-id="${esc(o.id)}">${esc(o.title)}</button>`).join('')}</div>`).join('')}</div></div>`;
  }

  const dayItems = day => {
    const s0 = sod(day), s1 = addDays(s0, 1);
    return occ.filter(o => !o.allDay && ((o.end > s0 && o.start < s1) || (+o.start === +o.end && o.start >= s0 && o.start < s1)))
      .map(o => ({ o, ds: Math.max(+o.start, +s0), de: Math.min(+o.end, +s1) }));
  };
  const elastic = week ? null : dayLayout(dayItems(d), +sod(d));
  const pts = elastic ? elastic.pts : linearMap();
  ui.timeMap = pts;
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  let grid = `<div class="grid" style="height:${pts[pts.length - 1].y + TOP}px">`;
  for (let h = 0; h <= 24; h++) grid += `<div class="hour" style="top:${tToY(pts, h * 60) - 8}px"><span>${pad(h % 24)}:00</span><i></i></div>`;
  grid += '<div class="cols">';
  let target = 8, firstStart = null;
  days.forEach((day, i) => {
    const s0 = sod(day), items = dayItems(day);
    for (const it of items) if (it.o.start >= s0 && (!firstStart || it.o.start.getHours() < firstStart)) firstStart = it.o.start.getHours();
    grid += `<div class="col" data-act="slot" data-day="${dkey(day)}" style="left:${i * 100 / days.length}%;width:${100 / days.length}%">`;
    if (elastic) for (const b of elastic.bands) grid += bandHTML(b);
    else for (const p of layout(items)) grid += evHTML(p, s0, true);
    if (sameDay(day, t)) grid += `<div class="now" style="top:${tToY(pts, nowMin)}px"></div>`;
    grid += '</div>';
  });
  grid += '</div></div>';
  if (!S.events.length) target = 0;
  else if (days.some(x => sameDay(x, t))) target = Math.max(0, new Date().getHours() - 1);
  else if (firstStart != null) target = Math.max(0, firstStart - 1);
  ui.agendaTargetY = tToY(pts, target * 60) - TOP;

  return header('Agenda', right, extra) +
    `<div class="scroll" data-swipe="${week ? 'agenda-week' : 'agenda-day'}"><div class="slidable">${body}${grid}${legend()}</div></div>`;
}

/* ---------- Fiche événement (créer / modifier) ---------- */
const REPEATS = [
  ['none', 'Jamais'], ['daily', 'Tous les jours'], ['weekdays', 'En semaine (lun. – ven.)'], ['weekly', 'Toutes les semaines'],
  ['biweekly', 'Toutes les 2 semaines'], ['monthly', 'Tous les mois'], ['yearly', 'Tous les ans'],
  ['custom', 'Certains jours de la semaine'], ['keep', 'Personnalisée (importée)'],
];
function recToRepeat(rec, start) {
  if (!rec) return 'none';
  if (rec.count) return 'keep';
  const iv = rec.interval || 1, base = String(wd(start));
  const days = rec.days && rec.days.length ? [...rec.days].sort((a, b) => a - b).join() : base;
  if (rec.freq === 'daily' && iv === 1) return 'daily';
  if (rec.freq === 'weekly' && iv === 1 && days === '1,2,3,4,5') return 'weekdays';
  if (rec.freq === 'weekly' && iv === 1 && days === base) return 'weekly';
  if (rec.freq === 'weekly' && iv === 2 && days === base) return 'biweekly';
  if (rec.freq === 'monthly' && iv === 1) return 'monthly';
  if (rec.freq === 'yearly' && iv === 1) return 'yearly';
  if (rec.freq === 'weekly' && iv === 1) return 'custom';
  return 'keep';
}
function recSig(rec, start) {
  if (!rec) return '';
  const days = rec.freq === 'weekly' ? (rec.days && rec.days.length ? [...rec.days].sort((a, b) => a - b).join() : String(wd(parseLocal(start)))) : '';
  return [rec.freq, rec.interval || 1, days, rec.until || '', rec.count || ''].join('|');
}
function newDraft(day, minutes) {
  const date = dkey(day);
  return {
    mode: 'new', title: '', cat: 'revisions', date, t1: fromMin(minutes), t2: fromMin(Math.min(minutes + 60, 1439)),
    allDay: false, endDate: date, repeat: 'none', days: [wd(day)], untilOn: false, until: dkey(addDays(day, 30)), loc: '', notes: '',
  };
}
function draftFromOcc(o) {
  const ev = getEv(o.evId), evStart = parseLocal(ev.start);
  const repeat = recToRepeat(ev.rec, evStart);
  return {
    mode: 'edit', evId: ev.id, key: o.key, title: o.title, cat: o.cat, date: dkey(o.start), t1: hm(o.start), t2: hm(o.end),
    allDay: o.allDay, endDate: dkey(addDays(o.end, o.allDay ? -1 : 0)), repeat,
    days: ev.rec && ev.rec.days && ev.rec.days.length ? [...ev.rec.days] : [wd(evStart)], baseWd: wd(evStart),
    untilOn: !!(ev.rec && ev.rec.until), until: (ev.rec && ev.rec.until) || dkey(addDays(o.start, 30)),
    keptRec: repeat === 'keep' ? JSON.parse(JSON.stringify(ev.rec)) : null, loc: o.loc, notes: o.notes,
  };
}
function draftFields(d) {
  let start, dur;
  if (d.allDay) {
    start = d.date + 'T00:00';
    dur = Math.max(1, Math.round((parseKey(d.endDate) - parseKey(d.date)) / 864e5) + 1) * 1440;
  } else {
    start = d.date + 'T' + d.t1;
    dur = toMin(d.t2) - toMin(d.t1);
    if (dur <= 0) dur += 1440;
  }
  const baseWd = d.baseWd || wd(parseKey(d.date));
  let rec = null;
  switch (d.repeat) {
    case 'daily': rec = { freq: 'daily', interval: 1 }; break;
    case 'weekdays': rec = { freq: 'weekly', interval: 1, days: [1, 2, 3, 4, 5] }; break;
    case 'weekly': rec = { freq: 'weekly', interval: 1, days: [baseWd] }; break;
    case 'biweekly': rec = { freq: 'weekly', interval: 2, days: [baseWd] }; break;
    case 'monthly': rec = { freq: 'monthly', interval: 1 }; break;
    case 'yearly': rec = { freq: 'yearly', interval: 1 }; break;
    case 'custom': rec = { freq: 'weekly', interval: 1, days: d.days.length ? [...d.days].sort((a, b) => a - b) : [baseWd] }; break;
    case 'keep': rec = JSON.parse(JSON.stringify(d.keptRec)); delete rec.until; break;
  }
  if (rec && d.untilOn) { rec.until = d.until; delete rec.count; }
  return { title: d.title.trim() || 'Nouvel événement', cat: d.cat, start, dur, allDay: d.allDay, loc: d.loc.trim(), notes: d.notes.trim(), rec };
}

function eventSheet() {
  const d = ui.draft, isNew = d.mode === 'new';
  const nextDay = !d.allDay && toMin(d.t2) <= toMin(d.t1);
  const opts = REPEATS.filter(r => r[0] !== 'keep' || d.keptRec)
    .map(([v, l]) => `<option value="${v}"${d.repeat === v ? ' selected' : ''}>${l}</option>`).join('');
  return `<div class="grabber"></div>
    <div class="sheet-head"><h2>${isNew ? 'Nouvel événement' : "Modifier l'événement"}</h2><button class="icon-btn" data-act="close-sheet" aria-label="Fermer">${icon('x')}</button></div>
    <div class="label">Titre</div>
    <input class="input" type="text" data-input="draft" data-f="title" value="${esc(d.title)}" placeholder="Ex. Révision Fiscalité" enterkeyhint="done">
    <div class="label">Catégorie</div>${catChips(d.cat, 'draft-cat')}
    <div class="switchrow"><span>Toute la journée</span><button class="switch${d.allDay ? ' on' : ''}" data-act="draft-allday" aria-label="Toute la journée"></button></div>
    ${d.allDay
      ? `<div class="row2"><div><div class="label">Début</div><input class="input" type="date" data-change="draft" data-f="date" value="${d.date}"></div>
         <div><div class="label">Fin</div><input class="input" type="date" data-change="draft" data-f="endDate" value="${d.endDate}"></div></div>`
      : `<div class="label">Date</div><input class="input" type="date" data-change="draft" data-f="date" value="${d.date}">
         <div class="row2"><div><div class="label">Début</div><input class="input" type="time" data-change="draft" data-f="t1" value="${d.t1}"></div>
         <div><div class="label">Fin</div><input class="input" type="time" data-change="draft" data-f="t2" value="${d.t2}"></div></div>
         ${nextDay ? '<div class="hint">Se termine le lendemain.</div>' : ''}`}
    <div class="label">Répétition</div><select class="input" data-change="draft" data-f="repeat">${opts}</select>
    ${d.repeat === 'custom' ? `<div class="daychips">${LETTERS.map((l, i) => `<button class="${d.days.includes(i + 1) ? 'on' : ''}" data-act="draft-day" data-d="${i + 1}">${l}</button>`).join('')}</div>` : ''}
    ${d.repeat !== 'none' ? `<div class="switchrow"><span>Fin de la répétition</span><button class="switch${d.untilOn ? ' on' : ''}" data-act="draft-until" aria-label="Fin de la répétition"></button></div>
      ${d.untilOn ? `<input class="input" style="margin-top:10px" type="date" data-change="draft" data-f="until" value="${d.until}">` : ''}` : ''}
    <div class="label">Lieu</div><input class="input" type="text" data-input="draft" data-f="loc" value="${esc(d.loc)}" placeholder="Facultatif">
    <div class="label">Notes</div><textarea class="input" rows="3" data-input="draft" data-f="notes" placeholder="Facultatif">${esc(d.notes)}</textarea>
    <button class="btn-primary" style="margin-top:24px" data-act="draft-save">Enregistrer</button>
    ${isNew ? '' : `<button class="btn-secondary danger" style="margin-top:10px" data-act="draft-delete">${icon('trash')} Supprimer l'événement</button>`}`;
}
function openEvent(draft) { ui.draft = draft; openSheet(eventSheet); }

function splitFuture(ev, key, f) {
  const keyDate = parseKey(key);
  let remaining = null;
  if (ev.rec.count) {
    let n = 0;
    for (const x of seriesDays(ev, addDays(keyDate, -1))) n++; // eslint-disable-line no-unused-vars
    remaining = Math.max(1, ev.rec.count - n);
  }
  const newEx = {};
  for (const k of Object.keys(ev.ex || {})) if (k >= key) { newEx[k] = ev.ex[k]; delete ev.ex[k]; }
  ev.rec = { ...ev.rec, until: dkey(addDays(keyDate, -1)) };
  delete ev.rec.count;
  const nev = { id: uid(), src: 'app', ...f, ex: f.rec ? newEx : {} };
  if (nev.rec && remaining && !nev.rec.until) nev.rec.count = remaining;
  S.events.push(nev);
}
async function saveDraft() {
  const d = ui.draft, f = draftFields(d);
  if (d.mode === 'new') {
    S.events.push({ id: uid(), src: 'app', ex: {}, ...f });
  } else {
    const ev = getEv(d.evId);
    if (!ev) return closeSheet();
    if (!ev.rec) {
      Object.assign(ev, f);
    } else {
      const recChanged = recSig(f.rec, f.start) !== recSig(ev.rec, ev.start);
      const isFirst = d.key === dkey(parseLocal(ev.start));
      const opts = [];
      if (!recChanged) opts.push({ label: 'Enregistrer pour cet événement uniquement', value: 'one' });
      opts.push({ label: 'Enregistrer pour les événements futurs', value: 'future' });
      const choice = await choose('Cet événement se répète.', opts);
      if (!choice) return;
      if (choice === 'one') {
        ev.ex = ev.ex || {};
        ev.ex[d.key] = { start: f.start, dur: f.dur, title: f.title, cat: f.cat, loc: f.loc, notes: f.notes };
      } else if (isFirst) {
        Object.assign(ev, f);
      } else {
        splitFuture(ev, d.key, f);
      }
    }
  }
  save();
  closeSheet();
  render();
}
async function deleteDraft() {
  const d = ui.draft, ev = getEv(d.evId);
  if (!ev) return closeSheet();
  if (!ev.rec) {
    if (!await choose('', [{ label: "Supprimer l'événement", value: 'del', danger: true }])) return;
    S.events = S.events.filter(e => e !== ev);
  } else {
    const c = await choose('Cet événement se répète.', [
      { label: 'Supprimer cet événement uniquement', value: 'one', danger: true },
      { label: 'Supprimer les événements futurs', value: 'future', danger: true },
    ]);
    if (!c) return;
    if (c === 'one') { ev.ex = ev.ex || {}; ev.ex[d.key] = null; }
    else if (d.key === dkey(parseLocal(ev.start))) S.events = S.events.filter(e => e !== ev);
    else {
      ev.rec = { ...ev.rec, until: dkey(addDays(parseKey(d.key), -1)) };
      delete ev.rec.count;
      for (const k of Object.keys(ev.ex || {})) if (k >= d.key) delete ev.ex[k];
    }
  }
  save();
  closeSheet();
  render();
}

/* ---------- Bilan ---------- */
function ring(score, size = 84) {
  const r = 36, C = 2 * Math.PI * r, v = Math.min(Math.max(score ?? 0, 0), 1);
  return `<svg class="ring" viewBox="0 0 84 84" width="${size}" height="${size}"><circle cx="42" cy="42" r="${r}" stroke="var(--raised)" stroke-width="8" fill="none"/>` +
    `<circle cx="42" cy="42" r="${r}" stroke="${scoreColor(score ?? 0)}" stroke-width="8" fill="none" stroke-linecap="round" stroke-dasharray="${Math.max(v * C, 0.1)} ${C}" transform="rotate(-90 42 42)"/>` +
    `<text x="42" y="43" text-anchor="middle" dominant-baseline="middle">${score == null ? '–' : Math.round(score * 100) + '%'}</text></svg>`;
}
function actRow(a, e, locked) {
  const c = cat(a.cat), st = e ? e.s : '';
  const btn = (s, label) => `<button class="sbtn ${s}${st === s ? ' on' : ''}" data-act="entry" data-id="${esc(a.id)}" data-s="${s}"${locked ? ' disabled' : ''}>${label}</button>`;
  let partial = '';
  if (st === 'partial') {
    const r = realized(a, e);
    partial = `<div class="prow"><span>Réalisé</span><input type="range" min="0" max="${Math.max(mins(a), 5)}" step="5" value="${r}" ` +
      `data-input="partial" data-change="rerender" data-id="${esc(a.id)}"${locked ? ' disabled' : ''}><output>${fmtDur(r)}</output></div>`;
  }
  return `<div class="act"><div class="act-top"><div class="times"><span>${hm(a.start)}</span><span>${hm(a.end)}</span></div>` +
    `<div class="act-main"><div class="act-title" style="--c:${c.color}"><i></i>${esc(a.title)}</div><div class="act-sub">${c.label} · ${fmtDur(mins(a))}</div></div></div>` +
    `<div class="sbtns">${btn('done', 'Fait')}${btn('partial', 'Partiel')}${btn('missed', 'Pas fait')}</div>${partial}</div>`;
}
function renderBilan() {
  const day = ui.bilanDate, k = dkey(day), t = today();
  const future = day > t, log = getLog(k), closedDay = !!log.closedAt, locked = closedDay || future;
  const acts = dayActs(day);
  const scored = acts.filter(a => cat(a.cat).scored), routine = acts.filter(a => !cat(a.cat).scored);
  const s = summary(k, acts);
  const subtitle = [relDay(day), closedDay ? 'Clôturée' : null].filter(Boolean).join(' · ') || String(day.getFullYear());
  const nav = `<div class="daynav" data-swipe="bilan-day"><button data-act="bilan-shift" data-n="-1" aria-label="Jour précédent">${icon('left')}</button>` +
    `<div class="slidable" data-act="bilan-today"><b>${fmtDayLong(day)}</b><span>${subtitle}</span></div>` +
    `<button data-act="bilan-shift" data-n="1" aria-label="Jour suivant">${icon('right')}</button></div>`;

  let b = '';
  const pending = pendingDays().filter(x => x !== k);
  if (pending.length) {
    b += `<button class="card banner" data-act="bilan-goto" data-day="${pending[0]}"><span class="ic">!</span>` +
      `<b>${pending.length === 1 ? '1 journée à clôturer' : `${pending.length} journées à clôturer`}</b><span>${fmtDayLong(parseKey(pending[0]))}</span></button>`;
  }
  const badge = closedDay ? '<span class="badge good">Clôturée</span>' : future ? '<span class="badge">À venir</span>'
    : `<span class="badge">En cours · ${s.filled}/${s.count} renseignées</span>`;
  b += `<div class="card summary">${ring(s.score)}<div><div class="big">${fmtDur(s.realized)}</div>` +
    `<p>réalisées sur ${fmtDur(s.planned)} d'activités prévues · ${s.done}/${s.count} faites</p>${badge}</div></div>`;

  if (scored.length) {
    b += `<div class="section">Activités</div><div class="card">${scored.map(a => actRow(a, log.entries[a.id], locked)).join('')}</div>`;
  } else {
    b += `<p class="muted">Aucune activité prévue ce jour-là dans ton agenda.</p>`;
  }
  if ((log.extras || []).length) {
    b += `<div class="section">Hors programme</div><div class="card">${log.extras.map(x => `<div class="xrow"><span class="dot" style="--c:${cat(x.cat).color}"></span>` +
      `<div><b>${esc(x.title)}</b><span>${cat(x.cat).label} · ${fmtDur(x.m)}</span></div>` +
      `${locked ? '' : `<button data-act="extra-del" data-id="${x.id}" aria-label="Supprimer">${icon('trash')}</button>`}</div>`).join('')}</div>`;
  }
  if (routine.length) {
    b += `<div class="card"><div class="routine-head" data-act="routine-toggle"><div><b>Routine et sommeil</b><span>${s.rDone}/${s.rCount} faits · non comptés dans le score</span></div>` +
      `${!locked && s.rDone < s.rCount ? '<button class="pill" data-act="routine-all">Tout fait</button>' : ''}<span class="rchev${ui.routineOpen ? ' open' : ''}">${icon('right')}</span></div>` +
      (ui.routineOpen ? routine.map(a => {
        const done = log.entries[a.id] && log.entries[a.id].s === 'done';
        return `<div class="rrow"><span class="t">${hm(a.start)}</span><span class="dot" style="--c:${cat(a.cat).color}"></span><span class="n">${esc(a.title)}</span>` +
          `<button class="rcheck${done ? ' on' : ''}" data-act="routine-check" data-id="${esc(a.id)}"${locked ? ' disabled' : ''} aria-label="Fait"></button></div>`;
      }).join('') : '') + '</div>';
  }
  if (!locked) b += `<button class="btn-secondary" data-act="extra-new">${icon('plus')} Ajouter une activité non prévue</button>`;
  b += `<div><div class="label" style="margin-top:4px">Note du jour</div><textarea class="input" rows="4" data-input="note" ` +
    `placeholder="Ce qui a bien marché, ce qui a bloqué, à ajuster demain…">${esc(log.note || '')}</textarea></div>`;
  if (!future) {
    if (closedDay) {
      const c = new Date(log.closedAt);
      b += `<p class="muted">Journée clôturée le ${fmtShort(c)} à ${hm(c)}.</p><button class="btn-secondary" data-act="reopen">Rouvrir la journée</button>`;
    } else {
      if (s.unfilled > 0) b += `<p class="muted">${s.unfilled === 1 ? '1 activité non renseignée comptera comme non faite.' : `${s.unfilled} activités non renseignées compteront comme non faites.`}</p>`;
      b += `<button class="btn-primary" data-act="close-day">Clôturer la journée</button>`;
    }
  }
  b += `<p class="foot">Le score compare le temps réalisé au temps prévu pour tes activités (cours, révisions, business, sport, apprentissage, organisation). La routine et le sommeil n'y entrent pas.</p>`;
  return header('Bilan du jour', settingsBtn(), nav) + `<div class="scroll" data-swipe="bilan-day"><div class="pad slidable">${b}</div></div>`;
}
function extraSheet() {
  const x = ui.extra;
  return `<div class="grabber"></div><div class="sheet-head"><h2>Activité non prévue</h2><button class="icon-btn" data-act="close-sheet" aria-label="Fermer">${icon('x')}</button></div>
    <div class="label">Titre</div><input class="input" type="text" data-input="extra" value="${esc(x.title)}" placeholder="Ex. Lecture">
    <div class="label">Catégorie</div>${catChips(x.cat, 'extra-cat')}
    <div class="label">Durée</div><div class="card stepper"><button data-act="extra-step" data-n="-5" aria-label="Moins">${icon('minus')}</button><b>${fmtDur(x.m)}</b>` +
    `<button data-act="extra-step" data-n="5" aria-label="Plus">${icon('plus')}</button></div>
    <button class="btn-primary" style="margin-top:24px" data-act="extra-save">Ajouter</button>`;
}

/* ---------- Progression ---------- */
function renderProgression() {
  const days = closedDays(), t = today(), goal = S.settings.goal;
  let b = '';
  if (!days.length) {
    b = `<div class="card" style="padding:24px;text-align:center;display:flex;flex-direction:column;gap:14px;align-items:center">` +
      `<b style="font-size:20px">Ta progression commence ce soir</b><p class="muted">Chaque soir, valide ce que tu as fait dans l'onglet Bilan puis clôture la journée. Ton score, ta série et tes tendances apparaîtront ici.</p>` +
      `<button class="btn-primary" style="width:auto;padding:0 24px" data-act="go-bilan">Faire le bilan d'aujourd'hui</button></div>`;
    return header('Progression', settingsBtn()) + `<div class="scroll"><div class="pad">${b}</div></div>`;
  }
  const st = streaks(days);
  b += `<div class="card streak"><div><div class="k" style="color:${st.cur ? 'var(--warn)' : 'var(--sec)'}">${icon('flame')}<span style="color:var(--sec)">Série</span></div>` +
    `<div class="v">${st.cur}</div><div class="muted">${st.cur > 1 ? "jours d'affilée" : 'jour'}</div></div>` +
    `<div class="r"><div class="k" style="justify-content:flex-end">Record</div><div class="v">${st.best}</div><div class="foot">Objectif : ${pct(goal)} du prévu</div></div></div>`;

  const avg = list => { const sc = list.map(x => x.s.score).filter(v => v != null); return sc.length ? sc.reduce((a, b2) => a + b2, 0) / sc.length : null; };
  const a7 = avg(days.filter(x => x.d > addDays(t, -7))), a30 = avg(days.filter(x => x.d > addDays(t, -30)));
  const best = days.filter(x => x.s.score != null).sort((x, y) => y.s.score - x.s.score)[0];
  const tile = (label, value, color, small = '') => `<div class="card tile"><span>${label}</span><b style="color:${color || '#fff'}">${value}</b>${small ? `<small>${small}</small>` : ''}</div>`;
  b += `<div class="tiles">${tile('Moyenne 7 j', a7 == null ? '–' : pct(a7), a7 == null ? '' : scoreColor(a7))}${tile('Moyenne 30 j', a30 == null ? '–' : pct(a30), a30 == null ? '' : scoreColor(a30))}` +
    `${tile('Meilleur jour', best ? pct(best.s.score) : '–', '', best ? fmtShort(best.d) : '')}${tile('Jours clôturés', days.length, '', `${days.filter(x => isSuccess(x.s)).length} objectifs atteints`)}</div>`;

  const map = new Map(days.map(x => [x.k, x]));
  const pts = [];
  for (let i = ui.span - 1; i >= 0; i--) { const d = addDays(t, -i), x = map.get(dkey(d)); pts.push({ d, v: x && x.s.score != null ? Math.min(x.s.score, 1.5) : null }); }
  const maxV = Math.max(1, ...pts.map(p => p.v || 0));
  b += `<div class="card chartcard"><div class="top"><b>Score quotidien</b><div class="seg">` +
    [[14, '2 sem.'], [30, '1 mois'], [90, '3 mois']].map(([v, l]) => `<button class="${ui.span === v ? 'on' : ''}" data-act="span" data-v="${v}">${l}</button>`).join('') +
    `</div></div><div class="bars" style="--goal:${goal / maxV * 100}%">${pts.map(p => `<div class="bar"><i style="height:${(p.v || 0) / maxV * 100}%;background:${p.v == null ? 'transparent' : scoreColor(p.v)}"></i></div>`).join('')}<div class="goal"></div></div>` +
    `<div class="bars-x ends"><span>${fmtShort(pts[0].d)}</span><span>Aujourd'hui</span></div></div>`;

  const now = totals(addDays(t, -6), addDays(t, 1)), before = totals(addDays(t, -13), addDays(t, -6));
  const trend = CATS.filter(c => c.scored && ((now[c.id] && now[c.id].real) || (before[c.id] && before[c.id].real)));
  if (trend.length) {
    b += `<div class="section">7 derniers jours</div><div class="card">${trend.map(c => {
      const n = now[c.id] ? now[c.id].real : 0, p = before[c.id] ? before[c.id].real : 0, dl = n - p;
      const col = dl > 0 ? 'var(--good)' : dl < 0 ? 'var(--bad)' : 'var(--ter)';
      return `<div class="trow"><span class="dot" style="--c:${c.color}"></span><span class="n">${c.label}</span><span class="v">${fmtDur(n)}</span>` +
        `<span class="d" style="color:${col}">${dl === 0 ? 'stable' : (dl > 0 ? '↗ +' : '↘ −') + fmtDur(Math.abs(dl))}</span></div>`;
    }).join('')}</div>`;
  }
  b += `<div class="section">Historique</div><div class="card">${days.slice(-14).reverse().map(x => {
    const sc = x.s.score;
    return `<button class="hist" data-act="go-bilan" data-day="${x.k}"><div><b>${fmtDayLong(x.d)}</b><span>${fmtDur(x.s.realized)} / ${fmtDur(x.s.planned)}</span></div>` +
      (sc == null ? '<span class="p" style="color:var(--ter)">–</span>' : `<div class="pbar"><i style="width:${Math.min(sc, 1) * 100}%;--c:${scoreColor(sc)}"></i></div><span class="p">${pct(sc)}</span>`) + '</button>';
  }).join('')}</div>`;
  return header('Progression', settingsBtn()) + `<div class="scroll"><div class="pad">${b}</div></div>`;
}

/* ---------- Heures ---------- */
function hRange() {
  if (ui.hPeriod === 'week') { const s = startOfWeek(ui.hAnchor); return [s, addDays(s, 7)]; }
  if (ui.hPeriod === 'month') { const s = startOfMonth(ui.hAnchor); return [s, addMonths(s, 1)]; }
  return [parseKey(S.settings.firstUse), addDays(today(), 1)];
}
function renderHeures() {
  const [from, to] = hRange(), done = ui.hMode === 'done', tot = totals(from, to);
  const rows = CATS.filter(c => ui.hRoutine || c.scored).map(c => ({ c, x: tot[c.id] || { all: 0, toDate: 0, real: 0 } }))
    .filter(r => r.x.all > 0 || r.x.real > 0)
    .map(r => ({ ...r, ref: done ? r.x.toDate : r.x.all }))
    .sort((a, b) => b.ref - a.ref || b.x.real - a.x.real);
  const real = rows.reduce((a, r) => a + r.x.real, 0), toDate = rows.reduce((a, r) => a + r.x.toDate, 0), all = rows.reduce((a, r) => a + r.x.all, 0);
  const ref = done ? toDate : all, rate = ref > 0 ? real / ref : 0;
  const scope = ui.hRoutine ? '' : ', hors routine et sommeil';

  const title = ui.hPeriod === 'week' ? `Semaine du ${fmtShort(from)} au ${fmtShort(addDays(to, -1))}`
    : ui.hPeriod === 'month' ? fmtMonthYear(from) : `Depuis le ${fmtShortYear(from)}`;
  const seg = (items, cur, act) => `<div class="seg">${items.map(([v, l]) => `<button class="${cur === v ? 'on' : ''}" data-act="${act}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const extra = `<div class="segs">${seg([['week', 'Semaine'], ['month', 'Mois'], ['total', 'Total']], ui.hPeriod, 'h-period')}${seg([['done', 'Réalisé'], ['planned', 'Prévu']], ui.hMode, 'h-mode')}</div>` +
    `<div class="weeknav">${ui.hPeriod === 'total' ? '<span></span>' : `<button data-act="h-shift" data-n="-1" aria-label="Précédent">${icon('left')}</button>`}` +
    `<b>${title}</b>${ui.hPeriod === 'total' ? '<span></span>' : `<button data-act="h-shift" data-n="1" aria-label="Suivant">${icon('right')}</button>`}</div>`;

  let b = `<div class="card hhead"><div class="big">${fmtDur(done ? real : all)}</div>` +
    `<p>${done ? `réalisées sur ${fmtDur(toDate)} prévues jusqu'à aujourd'hui · ${pct(rate)}${scope}` : `prévues sur la période · ${fmtDur(real)} réalisées (${pct(rate)})${scope}`}</p>` +
    `<div class="pbar"><i style="width:${Math.min(rate, 1) * 100}%;--c:${scoreColor(rate)}"></i></div>` +
    `<div class="switchrow" style="margin-top:10px"><span style="font-size:15px">Inclure la routine et le sommeil</span><button class="switch${ui.hRoutine ? ' on' : ''}" data-act="h-routine" aria-label="Inclure la routine et le sommeil"></button></div></div>`;

  if (ui.hPeriod !== 'total') {
    const pts = dailyPoints(from, to, !done).map(p => ({ d: p.d, segs: CATS.filter(c => (ui.hRoutine || c.scored) && p.per[c.id]).map(c => ({ c, m: p.per[c.id] })) }));
    const maxM = Math.max(60, ...pts.map(p => p.segs.reduce((a, s) => a + s.m, 0)));
    const week = ui.hPeriod === 'week';
    b += `<div class="card chartcard"><div class="top"><b>${done ? 'Heures réalisées par jour' : 'Heures prévues par jour'}</b><span class="foot">max ${fmtDur(maxM)}</span></div>` +
      `<div class="bars stack">${pts.map(p => `<div class="bar">${p.segs.map(s => `<i style="height:${s.m / maxM * 100}%;background:${s.c.color}"></i>`).join('')}</div>`).join('')}</div>` +
      `<div class="bars-x">${pts.map((p, i) => `<span>${week ? LETTERS[i] : (p.d.getDate() === 1 || p.d.getDate() % 7 === 1 ? p.d.getDate() : '')}</span>`).join('')}</div></div>`;
  }
  b += rows.length ? `<div class="card">${rows.map(r => {
    const rr = r.ref > 0 ? r.x.real / r.ref : (r.x.real > 0 ? 1 : 0);
    return `<div class="hrow"><div class="l1"><span class="dot" style="--c:${r.c.color}"></span><b>${r.c.label}</b><span class="v">${fmtDur(r.x.real)} <small>/ ${fmtDur(r.ref)}</small></span></div>` +
      `<div class="l2"><div class="pbar"><i style="width:${Math.min(rr, 1) * 100}%;--c:${r.c.color}"></i></div><span>${pct(rr)}</span></div></div>`;
  }).join('')}</div>` : '<p class="muted">Aucune activité sur cette période.</p>';
  b += `<p class="foot">${done ? "Réalisé : ce que tu as déclaré dans tes bilans, comparé au temps prévu jusqu'à aujourd'hui." : 'Prévu : tout ce que ton agenda contient sur la période, jours à venir compris.'}</p>`;
  return header('Heures', settingsBtn(), extra) + `<div class="scroll"><div class="pad">${b}</div></div>`;
}

/* ---------- Réglages, import, sauvegarde ---------- */
function settingsSheet() {
  const nClosed = Object.keys(S.logs).filter(isClosed).length;
  return `<div class="grabber"></div><div class="sheet-head"><h2>Réglages</h2><button class="icon-btn" data-act="close-sheet" aria-label="Fermer">${icon('x')}</button></div>
    <div class="label">Importer depuis le Calendrier Apple</div>
    <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:14px">
      <ol class="steps"><li>Sur ton Mac, ouvre <b>Calendrier</b>, sélectionne un calendrier puis <b>Fichier › Exporter › Exporter…</b></li>
      <li>Envoie le fichier .ics sur ton iPhone (AirDrop ou iCloud Drive).</li><li>Choisis-le ici. Répète pour chaque calendrier.</li></ol>
      <label class="btn-secondary">${icon('upload')} Choisir un fichier .ics<input type="file" accept=".ics,text/calendar,.json,application/json" data-change="import-file" hidden></label>
      <p class="foot">Les événements déjà importés sont mis à jour, pas dupliqués. Ton Calendrier Apple n'est jamais modifié.</p>
    </div>
    <div class="label">Objectif quotidien · <span id="goal-v" style="color:#fff">${pct(S.settings.goal)}</span></div>
    <input type="range" min="0.3" max="1" step="0.05" value="${S.settings.goal}" data-input="goal">
    <p class="foot" style="margin-top:8px">Part du temps prévu à réaliser pour qu'une journée prolonge ta série.</p>
    <div class="label">Sauvegarde</div>
    <button class="btn-secondary" data-act="export">${icon('download')} Exporter une sauvegarde</button>
    <label class="btn-secondary" style="margin-top:10px">${icon('upload')} Restaurer une sauvegarde<input type="file" accept=".json,application/json" data-change="restore-file" hidden></label>
    <p class="foot" style="margin-top:10px">Tout reste sur cet iPhone, rien n'est envoyé en ligne. ${S.events.length} événement${S.events.length > 1 ? 's' : ''} · ${nClosed} journée${nClosed > 1 ? 's' : ''} clôturée${nClosed > 1 ? 's' : ''} · suivi depuis le ${fmtShortYear(parseKey(S.settings.firstUse))}.</p>
    ${S.events.length ? `<button class="btn-secondary danger" style="margin-top:18px" data-act="wipe-events">${icon('trash')} Supprimer tous les événements</button>` : ''}`;
}
function importSheet() {
  const x = ui.importData, list = filterSince(x.events, parseKey(x.since));
  const rec = list.filter(e => e.rec).length, auto = list.filter(e => !e.cat).length;
  return `<div class="grabber"></div><div class="sheet-head"><h2>Importer</h2><button class="icon-btn" data-act="close-sheet" aria-label="Fermer">${icon('x')}</button></div>
    <div class="card import-sum"><b>${esc(x.name)}</b><span>${list.length} événement${list.length > 1 ? 's' : ''} à importer${rec ? `, dont ${rec} qui se répète${rec > 1 ? 'nt' : ''}` : ''}</span></div>
    <div class="label">Importer à partir du</div>
    <input class="input" type="date" data-change="import-since" value="${x.since}">
    <p class="foot" style="margin-top:8px">Les événements terminés avant cette date sont ignorés.</p>
    <div class="label">Catégorie par défaut de ce calendrier</div>${catChips(x.defCat, 'import-cat')}
    <p class="foot" style="margin-top:8px">La catégorie est devinée d'après le titre (« Workout » → Sport…). Les ${auto} événement${auto > 1 ? 's' : ''} au titre non reconnu prendront celle-ci. Tu pourras tout changer ensuite en touchant un événement.</p>
    <button class="btn-primary" style="margin-top:24px" data-act="import-go"${list.length ? '' : ' disabled'}>Importer ${list.length} événement${list.length > 1 ? 's' : ''}</button>`;
}
async function exportData() {
  const name = `Cadence-sauvegarde-${dkey(new Date())}.json`;
  const blob = new Blob([JSON.stringify({ app: 'cadence', version: 1, exportedAt: new Date().toISOString(), ...S })], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function readFile(input) {
  return new Promise((res, rej) => {
    const f = input.files && input.files[0];
    if (!f) return rej(new Error('Aucun fichier'));
    const r = new FileReader();
    r.onload = () => res({ name: f.name, text: String(r.result) });
    r.onerror = () => rej(r.error);
    r.readAsText(f);
  });
}

/* ---------- Feuilles et choix ---------- */
function openSheet(renderFn) {
  ui.sheetRender = renderFn;
  const root = $('#sheet-root');
  root.innerHTML = `<div class="backdrop" data-act="backdrop"><div class="sheet" role="dialog" aria-modal="true">${renderFn()}</div></div>`;
  requestAnimationFrame(() => requestAnimationFrame(() => root.firstChild && root.firstChild.classList.add('open')));
}
function refreshSheet() {
  const sh = $('#sheet-root .sheet');
  if (sh && ui.sheetRender) sh.innerHTML = ui.sheetRender();
}
function closeSheet() {
  const b = $('#sheet-root').firstChild;
  ui.sheetRender = null;
  if (!b) return;
  b.classList.remove('open');
  setTimeout(() => { if (!ui.sheetRender) $('#sheet-root').innerHTML = ''; }, 300);
}
function choose(title, options) {
  return new Promise(res => {
    ui.chooseOpts = options;
    const root = $('#action-root');
    root.innerHTML = `<div class="backdrop" data-act="choose-cancel"><div class="actions">${title ? `<p>${esc(title)}</p>` : ''}` +
      options.map((o, i) => `<button class="${o.danger ? 'danger' : ''}" data-act="choose" data-i="${i}">${esc(o.label)}</button>`).join('') +
      `<button class="cancel" data-act="choose-cancel">Annuler</button></div></div>`;
    requestAnimationFrame(() => requestAnimationFrame(() => root.firstChild && root.firstChild.classList.add('open')));
    ui.chooseResolve = v => { root.innerHTML = ''; ui.chooseResolve = null; res(v); };
  });
}

/* =========================================================================
   Actions
   ========================================================================= */
const A = {
  tab: el => { ui.tab = el.dataset.tab; if (ui.tab === 'agenda') ui.scrollHour = true; render(); },
  settings: () => openSheet(settingsSheet),
  'close-sheet': () => closeSheet(),
  backdrop: (el, e) => { if (e.target === el) closeSheet(); },
  choose: el => ui.chooseResolve && ui.chooseResolve(ui.chooseOpts[+el.dataset.i].value),
  'choose-cancel': (el, e) => { if ((e.target === el || el.tagName === 'BUTTON') && ui.chooseResolve) ui.chooseResolve(null); },

  // Agenda
  'agenda-today': () => goAgenda(today()),
  'agenda-shift': el => goAgenda(addDays(ui.agendaDate, +el.dataset.n)),
  'agenda-pick': el => goAgenda(parseKey(el.dataset.day)),
  'agenda-mode': el => { ui.agendaMode = el.dataset.mode; ui.scrollHour = true; render(); },
  'week-day': el => { ui.agendaDate = parseKey(el.dataset.day); ui.agendaMode = 'day'; ui.scrollHour = true; render(); },
  'open-occ': el => { const o = ui.occMap.get(el.dataset.id); if (o) openEvent(draftFromOcc(o)); },
  'new-event': () => {
    const d = ui.agendaDate;
    const m = sameDay(d, today()) ? Math.min(23 * 60, (new Date().getHours() + 1) * 60) : 9 * 60;
    openEvent(newDraft(d, m));
  },
  slot: (el, e) => {
    const y = e.clientY - el.getBoundingClientRect().top;
    const m = Math.min(Math.max(Math.floor(yToT(ui.timeMap || linearMap(), y) / 30) * 30, 0), 23 * 60);
    openEvent(newDraft(parseKey(el.dataset.day), m));
  },
  'draft-cat': el => { ui.draft.cat = el.dataset.cat; refreshSheet(); },
  'draft-allday': () => { const d = ui.draft; d.allDay = !d.allDay; if (d.allDay && d.endDate < d.date) d.endDate = d.date; refreshSheet(); },
  'draft-until': () => { ui.draft.untilOn = !ui.draft.untilOn; refreshSheet(); },
  'draft-day': el => {
    const d = ui.draft, n = +el.dataset.d;
    d.days = d.days.includes(n) ? d.days.filter(x => x !== n) : [...d.days, n];
    refreshSheet();
  },
  'draft-save': () => saveDraft(),
  'draft-delete': () => deleteDraft(),

  // Bilan
  'bilan-shift': el => goBilan(addDays(ui.bilanDate, +el.dataset.n)),
  'bilan-today': () => goBilan(today()),
  'bilan-goto': el => goBilan(parseKey(el.dataset.day)),
  entry: el => {
    const k = dkey(ui.bilanDate), id = el.dataset.id, s = el.dataset.s;
    const a = dayActs(ui.bilanDate).find(x => x.id === id);
    if (!a) return;
    editLog(k, l => {
      const cur = l.entries[id];
      if (cur && cur.s === s) delete l.entries[id];
      else l.entries[id] = s === 'partial' ? { s, m: Math.floor(mins(a) / 10) * 5 } : { s };
    });
    render();
  },
  'routine-toggle': () => { ui.routineOpen = !ui.routineOpen; render(); },
  'routine-all': () => {
    const k = dkey(ui.bilanDate);
    const routine = dayActs(ui.bilanDate).filter(a => !cat(a.cat).scored);
    editLog(k, l => routine.forEach(a => { l.entries[a.id] = { s: 'done' }; }));
    render();
  },
  'routine-check': el => {
    const k = dkey(ui.bilanDate), id = el.dataset.id;
    editLog(k, l => { if (l.entries[id] && l.entries[id].s === 'done') delete l.entries[id]; else l.entries[id] = { s: 'done' }; });
    render();
  },
  'extra-new': () => { ui.extra = { title: '', cat: 'apprentissage', m: 30 }; openSheet(extraSheet); },
  'extra-cat': el => { ui.extra.cat = el.dataset.cat; refreshSheet(); },
  'extra-step': el => { ui.extra.m = Math.min(600, Math.max(5, ui.extra.m + +el.dataset.n)); refreshSheet(); },
  'extra-save': () => {
    const x = ui.extra;
    editLog(dkey(ui.bilanDate), l => { (l.extras = l.extras || []).push({ id: uid(), title: x.title.trim() || cat(x.cat).label, cat: x.cat, m: x.m }); });
    closeSheet();
    render();
  },
  'extra-del': el => { editLog(dkey(ui.bilanDate), l => { l.extras = (l.extras || []).filter(x => x.id !== el.dataset.id); }); render(); },
  'close-day': () => {
    const day = ui.bilanDate, acts = dayActs(day);
    editLog(dkey(day), l => {
      l.snapshot = acts.map(a => ({ id: a.id, title: a.title, cat: a.cat, start: fmtLocal(a.start), end: fmtLocal(a.end) }));
      l.closedAt = new Date().toISOString();
    });
    toast('Journée clôturée ✓');
    render();
  },
  reopen: () => { editLog(dkey(ui.bilanDate), l => { delete l.closedAt; delete l.snapshot; }); render(); },

  // Progression & Heures
  'go-bilan': el => { ui.bilanDate = el.dataset.day ? parseKey(el.dataset.day) : today(); ui.tab = 'bilan'; render(); },
  span: el => { ui.span = +el.dataset.v; render(); },
  'h-period': el => { ui.hPeriod = el.dataset.v; ui.hAnchor = today(); render(); },
  'h-mode': el => { ui.hMode = el.dataset.v; render(); },
  'h-shift': el => {
    const n = +el.dataset.n;
    ui.hAnchor = ui.hPeriod === 'week' ? addDays(ui.hAnchor, 7 * n) : addMonths(ui.hAnchor, n);
    render();
  },
  'h-routine': () => {
    ui.hRoutine = !ui.hRoutine;
    try { localStorage.setItem('cadence.hRoutine', ui.hRoutine ? '1' : '0'); } catch (e) { /* facultatif */ }
    render();
  },

  // Réglages
  export: () => exportData(),
  'import-go': () => {
    const x = ui.importData, list = filterSince(x.events, parseKey(x.since)).map(e => ({ ...e, cat: e.cat || x.defCat }));
    const r = importEvents(list);
    closeSheet();
    ui.tab = 'agenda';
    ui.scrollHour = true;
    render();
    toast(`${r.added} ajouté${r.added > 1 ? 's' : ''}${r.updated ? `, ${r.updated} mis à jour` : ''}`);
  },
  'import-cat': el => { ui.importData.defCat = el.dataset.cat; refreshSheet(); },
  'wipe-events': async () => {
    const ok = await choose("Tous les événements de l'agenda seront supprimés. Tes bilans déjà clôturés sont conservés.",
      [{ label: 'Supprimer tous les événements', value: 1, danger: true }]);
    if (!ok) return;
    S.events = [];
    save();
    closeSheet();
    render();
  },
};

const INPUT = {
  draft: el => { ui.draft[el.dataset.f] = el.value; },
  extra: el => { ui.extra.title = el.value; },
  note: el => editLog(dkey(ui.bilanDate), l => { l.note = el.value; }),
  partial: el => {
    const id = el.dataset.id, m = +el.value;
    editLog(dkey(ui.bilanDate), l => { if (l.entries[id]) l.entries[id].m = m; });
    el.nextElementSibling.textContent = fmtDur(m);
  },
  goal: el => { S.settings.goal = +el.value; save(); $('#goal-v').textContent = pct(S.settings.goal); render(); },
};

const CHANGE = {
  draft: el => {
    const d = ui.draft;
    d[el.dataset.f] = el.value;
    if (el.dataset.f === 'date' && d.endDate < d.date) d.endDate = d.date;
    if (el.dataset.f === 'date' && d.mode === 'new') { d.days = [wd(parseKey(d.date))]; }
    refreshSheet();
  },
  rerender: () => render(),
  'import-since': el => { if (el.value) { ui.importData.since = el.value; refreshSheet(); } },
  'import-file': async el => {
    try {
      const f = await readFile(el);
      let events, name;
      if (/\.json$/i.test(f.name) || f.text.trim().startsWith('{')) {
        const data = JSON.parse(f.text);
        events = (data.events || []).map(e => withMissingOccurrences({ ...e, cat: e.cat || guessCatOrNull(e.title || '') }));
        name = data.calName || f.name;
      } else {
        const p = parseICS(f.text);
        events = p.events;
        name = p.calName || f.name.replace(/\.ics$/i, '');
      }
      if (!events.length) return toast('Aucun événement trouvé dans ce fichier');
      ui.importData = { name, events, since: dkey(addDays(today(), -7)), defCat: calendarCat(name) };
      openSheet(importSheet);
    } catch (e) {
      toast('Fichier illisible');
    } finally { el.value = ''; }
  },
  'restore-file': async el => {
    try {
      const f = await readFile(el);
      const data = JSON.parse(f.text);
      if (!data || !Array.isArray(data.events) || typeof data.logs !== 'object') throw new Error('format');
      const ok = await choose(`Remplacer toutes les données actuelles par cette sauvegarde (${data.events.length} événements) ?`,
        [{ label: 'Restaurer', value: 1, danger: true }]);
      if (!ok) return;
      S.events = data.events;
      S.logs = data.logs;
      S.settings = { ...emptyState().settings, ...data.settings };
      save();
      closeSheet();
      render();
      toast('Sauvegarde restaurée');
    } catch (e) {
      toast("Ce fichier n'est pas une sauvegarde Cadence");
    } finally { el.value = ''; }
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = A[el.dataset.act];
  if (fn) fn(el, e);
});
document.addEventListener('input', e => { const el = e.target; if (el.dataset && el.dataset.input && INPUT[el.dataset.input]) INPUT[el.dataset.input](el, e); });
document.addEventListener('change', e => { const el = e.target; if (el.dataset && el.dataset.change && CHANGE[el.dataset.change]) CHANGE[el.dataset.change](el, e); });

// Balayage horizontal : semaine (bandeau), jour (agenda) ou jour (bilan). Le contenu suit le doigt.
let swipe = null;
function swipeTargets(kind) {
  const main = $('#main'), t = [...main.querySelectorAll('.slidable')];
  if (kind === 'agenda-week') t.push(...main.querySelectorAll('.slidable-week'));
  return t;
}
document.addEventListener('touchstart', e => {
  const el = e.target.closest('[data-swipe]');
  swipe = el && e.touches.length === 1 && !ui.sheetRender && !e.target.closest('input, textarea, select')
    ? { kind: el.dataset.swipe, x: e.touches[0].clientX, y: e.touches[0].clientY, lock: null, dx: 0, targets: [] } : null;
}, { passive: true });
document.addEventListener('touchmove', e => {
  if (!swipe) return;
  const dx = e.touches[0].clientX - swipe.x, dy = e.touches[0].clientY - swipe.y;
  if (!swipe.lock) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    swipe.lock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (swipe.lock === 'x') swipe.targets = swipeTargets(swipe.kind);
  }
  if (swipe.lock !== 'x') return;
  e.preventDefault();
  swipe.dx = dx;
  for (const t of swipe.targets) {
    t.style.transition = 'none';
    t.style.transform = `translateX(${dx}px)`;
    t.style.opacity = String(1 - Math.min(Math.abs(dx) / innerWidth, 1) * 0.6);
  }
}, { passive: false });
function endSwipe() {
  const s = swipe;
  swipe = null;
  if (!s || s.lock !== 'x') return;
  const done = Math.abs(s.dx) > 60, dir = s.dx < 0 ? 1 : -1;
  for (const t of s.targets) {
    t.style.transition = 'transform .15s ease-out, opacity .15s ease-out';
    t.style.transform = done ? `translateX(${-dir * innerWidth * 0.5}px)` : '';
    t.style.opacity = done ? '0' : '';
  }
  if (!done) return;
  setTimeout(() => {
    if (s.kind === 'agenda-week') goAgenda(addDays(ui.agendaDate, 7 * dir));
    else if (s.kind === 'agenda-day') goAgenda(addDays(ui.agendaDate, dir));
    else if (s.kind === 'bilan-day') goBilan(addDays(ui.bilanDate, dir));
  }, 140);
}
document.addEventListener('touchend', endSwipe, { passive: true });
document.addEventListener('touchcancel', endSwipe, { passive: true });

// Ligne de l'heure actuelle et changement de jour.
let lastDay = dkey(new Date());
setInterval(() => {
  if (dkey(new Date()) !== lastDay) { lastDay = dkey(new Date()); if (!ui.sheetRender) render(); return; }
  const now = document.querySelector('.now');
  if (now) { const n = new Date(); now.style.top = `${tToY(ui.timeMap || linearMap(), n.getHours() * 60 + n.getMinutes())}px`; }
}, 60000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && dkey(new Date()) !== lastDay) {
    lastDay = dkey(new Date());
    ui.agendaDate = today();
    ui.bilanDate = today();
    if (!ui.sheetRender) render();
  }
});

// Lancée depuis l'écran d'accueil, l'app prend toute la hauteur réelle de l'écran.
function fitScreen() {
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const h = standalone && Math.abs(screen.width - innerWidth) < 2 ? screen.height : innerHeight;
  document.documentElement.style.setProperty('--app-h', `${h}px`);
}
fitScreen();
addEventListener('resize', fitScreen);
// La page elle-même ne défile pas, sauf pendant la saisie (iOS remonte le champ au-dessus du clavier).
const typing = () => document.activeElement && document.activeElement.matches('input, textarea, select');
addEventListener('scroll', () => { if ((scrollX || scrollY) && !typing()) scrollTo(0, 0); });
document.addEventListener('focusout', () => setTimeout(() => { if (!typing()) scrollTo(0, 0); }, 100));
addEventListener('orientationchange', fitScreen);

if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
render();
