const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ReviewPlan = require('../review-plan.js');
const DAY = '2026-10-11';
const cards = (n, due = DAY, prefix = 'c') => Array.from({ length: n }, (_, i) => ({ id: prefix + String(i).padStart(3, '0'), due, stage: 1 }));
const counts = dates => Array.from(dates.values()).reduce((all, d) => { all[d] = (all[d] || 0) + 1; return all; }, {});

test('50 overdue reviews become 30 today and 20 tomorrow without mutating cards', () => {
  const all = cards(50, '2026-10-01');
  const before = JSON.stringify(all);
  assert.deepEqual(counts(ReviewPlan.plan(all, DAY, 0)), { '2026-10-11': 30, '2026-10-12': 20 });
  assert.equal(JSON.stringify(all), before);
});

test('completed reviews consume today capacity and overflow shares future slots', () => {
  const all = [...cards(50, DAY), ...cards(25, '2026-10-12', 'future')];
  assert.deepEqual(counts(ReviewPlan.plan(all, DAY, 20)), { '2026-10-11': 10, '2026-10-12': 30, '2026-10-13': 30, '2026-10-14': 5 });
});

test('at or above the daily limit nothing else is assigned today', () => {
  for (const completed of [30, 50]) {
    assert.deepEqual(counts(ReviewPlan.plan(cards(31), DAY, completed)), { '2026-10-12': 30, '2026-10-13': 1 });
  }
});

test('missed days roll forward and future reviews are never brought forward', () => {
  assert.deepEqual(counts(ReviewPlan.plan(cards(61), '2026-10-14', 0)), { '2026-10-14': 30, '2026-10-15': 30, '2026-10-16': 1 });
  assert.deepEqual(counts(ReviewPlan.plan(cards(2, '2026-11-01'), DAY, 0)), { '2026-11-01': 2 });
});

test('oldest due date has priority; same-day plans are stable across snapshot ordering', () => {
  const all = [...cards(30, DAY), ...cards(2, '2026-10-01', 'old')];
  const result = ReviewPlan.plan(all, DAY, 0);
  assert.equal(result.get('old000'), DAY);
  assert.equal(result.get('old001'), DAY);
  assert.deepEqual([...result], [...ReviewPlan.plan(all.reverse(), DAY, 0)]);
});

test('date overflow handles month, year, and leap-day boundaries', () => {
  for (const [day, next] of [['2026-12-31', '2027-01-01'], ['2028-02-28', '2028-02-29'], ['2028-02-29', '2028-03-01']]) {
    assert.equal(ReviewPlan.plan(cards(1, day), day, 30).get('c000'), next);
  }
});

test('review count handles repeated Again attempts and separately arriving snapshots', () => {
  const all = [{ history: [{ d: DAY, g: 'again' }, { d: DAY, g: 'good' }, { d: '2026-10-10', g: 'good' }] }];
  assert.equal(ReviewPlan.reviewedToday(all, {}, DAY), 2);
  assert.equal(ReviewPlan.reviewedToday(all, { days: { [DAY]: { reviewed: 20 } } }, DAY), 20);
});

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
function appContext(completed = 0) {
  const state = { cards: new Map(cards(50).map(c => [c.id, c])), stats: { days: { [DAY]: { reviewed: completed } } }, settings: {} };
  const context = vm.createContext({ ReviewPlan, state, Map, Set, today: () => DAY,
    addDays: (day, n) => { const d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); },
    diffDays: (a,b) => Math.round((Date.parse(b)-Date.parse(a))/86400000),
    render() {},
    bumpStat(field, n) { state.stats.days[DAY][field] += n; },
    putCard(card) { state.cards.set(card.id, card); },
  });
  vm.runInContext(html.slice(html.indexOf('var INTERVALS='), html.indexOf('function stageInfo')), context);
  vm.runInContext(html.slice(html.indexOf('var plannedDates='), html.indexOf('function streak')), context);
  vm.runInContext('var session=null;' + html.slice(html.indexOf('function startSession'), html.indexOf('function renderReview')), context);
  vm.runInContext(html.slice(html.indexOf('function grade(g)'), html.indexOf("document.addEventListener('keydown'")), context);
  return context;
}

test('sessions and reloads share the remaining daily budget', () => {
  const app = appContext(20);
  app.startSession();
  assert.equal(app.session.queue.length, 10);
  for (let i=0; i<10; i++) { app.session.flipped=true; app.grade('good'); }
  assert.equal(app.reviewedCount(DAY), 30);
  assert.equal(app.dueCards(DAY).length, 0);
  app.startSession();
  assert.equal(app.session.queue.length, 0);
  assert.equal(appContext(30).dueCards(DAY).length, 0);
});

test('Again cannot exceed the daily limit, and its next date preview matches rollover', () => {
  const app = appContext(29);
  app.startSession();
  const card = app.state.cards.get(app.session.queue[0]);
  assert.equal(app.reviewInterval(card, 'again', DAY), 1);
  app.session.flipped=true; app.grade('again');
  app.session.flipped=true; app.grade('again');
  assert.equal(app.reviewedCount(DAY), 30);
  assert.equal(app.dueCards(DAY).length, 0);
  assert.equal(app.plannedDue(app.state.cards.get(card.id)), '2026-10-12');
});

test('a stale session at midnight cannot grade a card under the previous day budget', () => {
  const app=appContext();app.startSession();app.session.day='2026-10-10';app.session.flipped=true;app.grade('good');
  assert.equal(app.session,null);
  assert.equal(app.reviewedCount(DAY),0);
});


test('review screen ends the session at the daily cap even with Again queued', () => {
  const app = appContext(29);
  app.startSession();app.session.flipped=true;app.grade('again');
  const elements = new Map();
  app.$ = id => { if (!elements.has(id)) elements.set(id, {}); return elements.get(id); };
  app.state.ready=true;
  vm.runInContext(html.slice(html.indexOf('function renderReview'), html.indexOf('function flip')), app);
  app.renderReview(DAY);
  assert.equal(app.session.queue.length, 0);
  assert.match(elements.get('view-review').innerHTML, /복습 완료/);
});

test('reminders use the same daily capacity and skip review prompts after the cap', async () => {
  const source=fs.readFileSync(path.join(__dirname,'../reminders/send.js'),'utf8');
  const context=vm.createContext({ReviewPlan,APP_URL:'https://example.com/'});
  vm.runInContext(source.slice(source.indexOf('async function messageFor'),source.indexOf('async function main')),context);
  let completed=20;
  const user={collection(name){
    if(name==='cards')return {async get(){return {docs:cards(50).map(c=>({id:c.id,data:()=>c}))};}};
    return {doc(id){return {async get(){return {data:()=>id==='stats'?{days:{[DAY]:{reviewed:completed,added:5}}}:{goal:5}};}};}};
  }};
  const message=await context.messageFor(user,DAY);
  assert.match(message.body,/10개/);
  completed=30;
  assert.equal(await context.messageFor(user,DAY),null);
});
