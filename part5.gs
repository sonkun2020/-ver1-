function guessRole(roomId, playerId, targetId, guessedRole) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const room = getRoomObj(roomId);
    if (room.phase !== 'DAY') throw new Error('狙撃は昼の議論中のみ可能です');

    const pSheet = SS.getSheetByName('Players');
    const pData = pSheet.getDataRange().getValues();
    const meIdx = pData.findIndex(r => r.at(0) === roomId && r.at(1) === playerId);
    const tIdx = pData.findIndex(r => r.at(0) === roomId && r.at(1) === targetId);
    if (meIdx < 1 || tIdx < 1) return;

    const me = pData.at(meIdx), target = pData.at(tIdx);
    if (!(me.at(6) === true || me.at(6) === 'TRUE')) return;
    if (!new Array('nice_guesser', 'evil_guesser').includes(me.at(5))) return;
    if (String(me.at(9)).includes('GUESSED_' + room.day)) throw new Error('本日は既に狙撃済みです');

    pSheet.getRange(meIdx + 1, 10).setValue(String(me.at(9)) + ' GUESSED_' + room.day);

    if (target.at(3) === guessedRole) {
      pSheet.getRange(tIdx + 1, 7).setValue(false);
      postChat(roomId, 'SYSTEM', 'GM', `【狙撃成功】${me.at(2)} が ${target.at(2)}（${guessedRole}）を撃ち抜きました！`);
      if (target.at(5) === 'noisemaker') postChat(roomId, 'SYSTEM', 'GM', `【警報】ノイズメーカーの ${target.at(2)} さんが死亡！`);
    } else {
      pSheet.getRange(meIdx + 1, 7).setValue(false);
      postChat(roomId, 'SYSTEM', 'GM', `【狙撃失敗】${me.at(2)} は予想を外し自爆しました！`);
      if (me.at(5) === 'noisemaker') postChat(roomId, 'SYSTEM', 'GM', `【警報】ノイズメーカーの ${me.at(2)} さんが死亡！`);
    }
    checkWinCondition(roomId);
  } finally { lock.releaseLock(); }
}

function prosecutePlayer(roomId, playerId, targetId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const room = getRoomObj(roomId);
    if (room.phase !== 'DAY') throw new Error('強制追放は昼の議論中のみ可能です');

    const pSheet = SS.getSheetByName('Players');
    const pData = pSheet.getDataRange().getValues();
    const meIdx = pData.findIndex(r => r.at(0) === roomId && r.at(1) === playerId);
    const tIdx = pData.findIndex(r => r.at(0) === roomId && r.at(1) === targetId);
    if (meIdx < 1 || tIdx < 1) return;

    const me = pData.at(meIdx), target = pData.at(tIdx);
    if (me.at(5) !== 'prosecutor' || String(me.at(9)).includes('PROSECUTED')) throw new Error('能力は1ゲーム1回のみです');

    pSheet.getRange(meIdx + 1, 10).setValue(String(me.at(9)) + ' PROSECUTED');
    pSheet.getRange(tIdx + 1, 7).setValue(false);
    postChat(roomId, 'SYSTEM', 'GM', `【強制追放】プロセキューター ${me.at(2)} の権限により ${target.at(2)} さんが即座に追放されました！`);
    if (target.at(5) === 'noisemaker') postChat(roomId, 'SYSTEM', 'GM', `【警報】ノイズメーカーの ${target.at(2)} さんが死亡！`);
    if (target.at(5) === 'jester') { endGame(roomId, 'ジェスター（第三陣営）'); return; }

    if (!checkWinCondition(roomId)) {
      resetActions(roomId);
      updateRoom(roomId, { phase: 'NIGHT' });
      postChat(roomId, 'SYSTEM', 'GM', '強制追放により夜フェーズへ移行します。');
    }
  } finally { lock.releaseLock(); }
}
