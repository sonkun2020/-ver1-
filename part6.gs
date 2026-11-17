function submitAction(roomId, playerId, targetId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const pSheet = SS.getSheetByName('Players');
    const pData = pSheet.getDataRange().getValues();
    for (let i = 1; i < pData.length; i++) {
      const r = pData.at(i);
      if (r.at(0) === roomId && r.at(1) === playerId) {
        let extra = String(r.at(9) || '').replace('VENTING', '').trim();
        if (r.at(5) === 'engineer' && targetId === 'VENT') extra = (extra + ' VENTING').trim();
        pSheet.getRange(i + 1, 8, 1, 3).setValues(new Array(new Array(targetId, true, extra)));
        break;
      }
    }
    checkAutoAdvance(roomId);
  } finally { lock.releaseLock(); }
}

function checkAutoAdvance(roomId) {
  const room = getRoomObj(roomId);
  const pData = SS.getSheetByName('Players').getDataRange().getValues().filter(r => r.at(0) === roomId);
  const alive = pData.filter(r => r.at(6) === true || r.at(6) === 'TRUE');

  if (room.phase === 'VOTE' && alive.every(r => r.at(8) === true || r.at(8) === 'TRUE')) {
    resolveVote(roomId, pData, alive);
  } else if (room.phase === 'NIGHT') {
    const noNight = new Array('none', 'noisemaker', 'jester', 'nice_guesser', 'mayor', 'prosecutor', 'onmyoji');
    const actors = pData.filter(r => {
      const isAlive = r.at(6) === true || r.at(6) === 'TRUE';
      const ab = r.at(5);
      if (ab === 'angel') return !isAlive;
      if (ab === 'jekyll') return isAlive && (room.day % 2 === 0);
      return isAlive && !noNight.includes(ab);
    });
    if (actors.every(r => r.at(8) === true || r.at(8) === 'TRUE')) {
      resolveNight(roomId, pData, room.day);
    }
  }
}

function resolveVote(roomId, pData, alive) {
  const tally = {};
  alive.forEach(r => {
    const t = r.at(7);
    if (!t) return;
    const weight = (r.at(5) === 'mayor') ? 2 : 1;
    tally[t] = (tally[t] || 0) + weight;
  });

  let max = -1, execId = null;
  for (let id in tally) if (tally[id] > max) { max = tally[id]; execId = id; }

  const pSheet = SS.getSheetByName('Players');
  const allRows = pSheet.getDataRange().getValues();
  const idx = allRows.findIndex(r => r.at(0) === roomId && r.at(1) === execId);
  if (idx > 0) {
    const t = allRows.at(idx);
    pSheet.getRange(idx + 1, 7).setValue(false);
    postChat(roomId, 'SYSTEM', 'GM', `【追放】投票の結果、${t.at(2)} さんが追放されました。`);
    if (t.at(5) === 'noisemaker') postChat(roomId, 'SYSTEM', 'GM', `【警報】ノイズメーカーの ${t.at(2)} さんが死亡しました！`);
    if (t.at(5) === 'jester') { endGame(roomId, 'ジェスター（第三陣営）'); return; }
  }

  if (!checkWinCondition(roomId)) {
    resetActions(roomId);
    updateRoom(roomId, { phase: 'NIGHT' });
    postChat(roomId, 'SYSTEM', 'GM', '夜フェーズです。能力者は対象を選択してください。');
  }
}
