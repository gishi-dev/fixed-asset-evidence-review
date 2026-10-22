export const roles = ['総務担当', '作業室担当', '第二室受入担当', '保管担当', '処分手配担当', '経理担当', '現場責任者'];
export const categories = ['同名別資産', '現物不明', '移動済み未反映', '廃棄予定のみ', '廃棄の証拠待ち', '一致（対照）'];
export const columns = {
  ledger: ['id', 'asset', 'name', 'place', 'status'],
  sightings: ['id', 'asset', 'label', 'role', 'date', 'text'],
  events: ['id', 'asset', 'type', 'event', 'date', 'text'],
};
export function join(data, asset) {
  const ledger = data.ledger.find(r => r.asset === asset);
  const relatedLabels = new Set(data.sightings.filter(r => r.asset === asset).map(r => r.label).filter(Boolean));
  const sightings = data.sightings.filter(r => r.asset === asset || r.label === asset || relatedLabels.has(r.label));
  const events = data.events.filter(r => r.asset === asset);
  const records = [ledger, ...sightings, ...events].filter(Boolean);
  const different = sightings.filter(r => r.label && r.label !== r.asset);
  const moves = new Map();
  for (const r of events.filter(r => r.event)) {
    if (!moves.has(r.event)) moves.set(r.event, []);
    moves.get(r.event).push(r.id);
  }
  return { ledger, sightings, events, records, different, moves,
    missingLabel: sightings.some(r => r.asset === asset && !r.label),
    evidence: Object.fromEntries(['受渡', '連絡', '予定', '処分記録'].map(t => [t, events.filter(r => r.type === t).map(r => r.id)])),
  };
}
export function fingerprint(data, asset) {
  return JSON.stringify(join(data, asset).records);
}
export function validateData(data) {
  const ids = new Set();
  const assets = new Set();
  for (const key of Object.keys(columns)) {
    if (!Array.isArray(data[key]) || data[key].length > 100) throw Error('各表は100行までです。');
    for (const row of data[key]) {
      if (!row.id || ids.has(row.id) || !/^FA-\d{3}$/.test(row.asset)) throw Error('記録番号は全表で一意、資産番号はFA-と3桁の数字にしてください。');
      ids.add(row.id);
      if (columns[key].some(k => typeof row[k] !== 'string' || row[k].length > 1200)) throw Error('各項目は1200文字以内の文字列にしてください。');
      if (key === 'ledger') {
        if (assets.has(row.asset) || !row.name || !row.place || !row.status) throw Error('台帳の資産番号は一意にし、名称・場所・状態を記入してください。');
        assets.add(row.asset);
      }
      if (key === 'sightings' && ((row.label && !/^FA-\d{3}$/.test(row.label)) || !roles.includes(row.role))) throw Error('ラベルは空欄またはFA-と3桁の数字、担当は用意した役割名にしてください。');
      if (key === 'events' && !['受渡', '連絡', '予定', '処分記録'].includes(row.type)) throw Error('証拠の種類は受渡・連絡・予定・処分記録から指定してください。');
    }
  }
  for (const row of [...data.sightings, ...data.events]) {
    if (!assets.has(row.asset) || (row.label && !assets.has(row.label))) throw Error('記録の資産番号とラベルは台帳に登録してください。');
  }
}
export function parseCSV(text, fields) {
  const rows = []; let row = [], cell = '', quoted = false;
  text = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted) quoted = false;
      else if (!cell) quoted = true;
      else throw Error('CSVの引用符を確認してください。');
    } else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if (c === '\n' && !quoted) { row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (quoted) throw Error('CSVの引用符が閉じられていません。');
  row.push(cell); if (row.some(Boolean)) rows.push(row);
  if (rows.shift()?.join(',') !== fields.join(',')) throw Error('ヘッダーを表示中の項目名に合わせてください。');
  return rows.map(r => { if (r.length !== fields.length) throw Error('CSVの列数を確認してください。'); return Object.fromEntries(fields.map((k, i) => [k, r[i]])); });
}
export function csv(rows, fields) {
  return [fields, ...rows.map(r => fields.map(k => r[k] ?? ''))].map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n');
}
export function validateCandidates(rows, data) {
  if (!Array.isArray(rows) || rows.length !== data.ledger.length) throw Error('候補は台帳の全資産を1行ずつ含む配列にしてください。');
  const seen = new Set();
  for (const r of rows) {
    if (!data.ledger.some(l => l.asset === r.asset) || seen.has(r.asset)) throw Error('候補の資産番号が重複、または台帳と異なります。');
    seen.add(r.asset);
    for (const key of ['category', 'reason', 'missing', 'contact']) {
      if (typeof r[key] !== 'string' || !r[key].trim() || r[key].length > 1200) throw Error('区分・理由・不足資料・確認先は空でない1200文字以内の文字列にしてください。');
    }
    if (!roles.includes(r.contact)) throw Error('確認先は画面に示した役割名にしてください。');
    const refs = join(data, r.asset).records.map(x => x.id);
    if (!Array.isArray(r.refs) || !r.refs.length || r.refs.some(id => !refs.includes(id))) throw Error('根拠にはその資産に結び付く記録番号を指定してください。');
  }
}
