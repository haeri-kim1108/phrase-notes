// Sends the daily review reminder. Runs every hour from .github/workflows/reminders.yml.
// For each user whose chosen hour has come in their own time zone, counts the
// expressions due today and pushes one notification to each of their devices.
//
//   node reminders/send.js           send reminders that are due this hour
//   node reminders/send.js --test    send a test notification to every device now
const admin = require('firebase-admin');

const APP_URL = 'https://haeri-kim1108.github.io/phrase-notes/';
const TEST = process.argv.includes('--test');

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!sa.project_id) {
  console.error('FIREBASE_SERVICE_ACCOUNT secret is missing. See README > 복습 알림.');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// Local date (YYYY-MM-DD) and hour (0-23) in the given IANA time zone
function localNow(tz) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map(x => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

async function messageFor(user, day) {
  const due = (await user.collection('cards').where('due', '<=', day).count().get()).data().count;
  if (due > 0) {
    return { title: '복습할 시간이에요', body: `오늘 복습할 표현이 ${due}개 있어요. 잊기 전에 한 번 더 봐요.`, url: `${APP_URL}#review` };
  }
  const [stats, settings] = await Promise.all([user.collection('meta').doc('stats').get(), user.collection('meta').doc('settings').get()]);
  const added = (((stats.data() || {}).days || {})[day] || {}).added || 0;
  const goal = (settings.data() || {}).goal || 5;
  if (added < goal) {
    return { title: '오늘의 표현을 추가해 보세요', body: `오늘 목표 ${goal}개 중 ${added}개를 추가했어요.`, url: `${APP_URL}#add` };
  }
  return null; // nothing to review and today's goal is met
}

async function main() {
  const users = await db.collection('users').listDocuments();
  let sent = 0;
  for (const user of users) {
    const ref = user.collection('meta').doc('notify');
    const snap = await ref.get();
    if (!snap.exists) continue;
    const n = snap.data();
    const devices = Object.entries(n.devices || {});
    if (!n.enabled || !devices.length) continue;

    let now;
    try { now = localNow(n.tz || 'UTC'); } catch (e) { now = localNow('UTC'); }
    if (!TEST && (now.hour !== n.hour || n.lastSentDay === now.day)) continue;

    const msg = TEST
      ? { title: '알림 테스트', body: '복습 알림이 잘 도착했어요.', url: APP_URL }
      : await messageFor(user, now.day);
    if (!msg) { await ref.update({ lastSentDay: now.day }); continue; }

    const res = await admin.messaging().sendEach(devices.map(([, d]) => ({
      token: d.token,
      data: msg,
      webpush: { headers: { Urgency: 'high', TTL: String(12 * 3600) } },
    })));

    // Forget devices whose push subscription no longer exists
    const update = TEST ? {} : { lastSentDay: now.day };
    res.responses.forEach((r, i) => {
      if (r.success) return;
      const code = r.error && r.error.code;
      console.log(`device ${devices[i][0]}: ${code}`);
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        update[`devices.${devices[i][0]}`] = admin.firestore.FieldValue.delete();
      }
    });
    if (Object.keys(update).length) await ref.update(update);
    sent += res.successCount;
    console.log(`${now.day} ${now.hour}h (${n.tz}): "${msg.title}" sent to ${res.successCount}/${devices.length} device(s)`);
  }
  console.log(`done, ${sent} notification(s) sent`);
}

main().catch(e => { console.error(e); process.exit(1); });
