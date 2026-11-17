function drawRoles(count) {
  const pools = getRolePools();
  const shuffle = arr => arr.slice().sort(() => Math.random() - 0.5);
  const pick = (pool, n) => {
    let deck = shuffle(pool), res = new Array();
    for (let i = 0; i < n; i++) {
      if (!deck.length) deck = shuffle(pool);
      res.push(deck.pop());
    }
    return res;
  };
  let c = 0, w = 0, t = 0;
  if (count === 5) { c = 3; w = 1; t = 1; }
  else if (count === 6) { c = 4; w = 1; t = 1; }
  else if (count === 7) { c = 4; w = 2; t = 1; }
  else if (count === 8) { c = 5; w = 2; t = 1; }
  else if (count === 9) { c = 5; w = 2; t = 2; }

  let sel = new Array();
  if (count >= 5 && count <= 9) {
    sel = sel.concat(pick(pools.CITIZEN, c), pick(pools.WOLF, w), pick(pools.THIRD, t));
  } else {
    sel = sel.concat(pick(pools.WOLF, 1), pick(pools.THIRD, 1), pick(ALL_ROLES, count - 2));
  }
  return shuffle(sel);
}

function startGame(roomId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const pSheet = SS.getSheetByName('Players');
    const pData = pSheet.getDataRange().getValues();
    const roomRowIndices = new Array();
    for (let i = 1; i < pData.length; i++) {
      if (pData.at(i).at(0) === roomId) roomRowIndices.push(i);
    }
    const count = roomRowIndices.length;
    if (count < 5) throw new Error('最低5人必要です');

    const roles = drawRoles(count);
    roomRowIndices.forEach((rowIdx, idx) => {
      const r = roles.at(idx);
      const vals = new Array(r.name, r.team, r.ability, true, '', false, '');
      pSheet.getRange(rowIdx + 1, 4, 1, 7).setValues(new Array(vals));
    });
    updateRoom(roomId, { phase: 'DAY', day: 1, winner: '', viperTarget: '' });
    postChat(roomId, 'SYSTEM', 'GM', `=== 闇鍋人狼（${count}人）開始！1日目の昼です ===`);
  } finally { lock.releaseLock(); }
}

function sendChat(roomId, playerId, channel, text, disguiseName) {
  if (!text || !text.trim()) return;
  const pData = SS.getSheetByName('Players').getDataRange().getValues();
  const me = pData.find(r => r.at(0) === roomId && r.at(1) === playerId);
  if (!me) return;
  const alive = me.at(6) === true || me.at(6) === 'TRUE';
  let ch = !alive ? 'DEAD' : channel;
  let sender = me.at(2);
  if (alive && ch === 'ALL' && me.at(5) === 'shifter' && disguiseName) sender = disguiseName;
  postChat(roomId, ch, sender, text.trim());
}
