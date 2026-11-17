function resolveNight(roomId, pData, day) {
  const room = getRoomObj(roomId);
  const pSheet = SS.getSheetByName('Players');
  const allRows = pSheet.getDataRange().getValues();
  let guardId = null, logs = new Array(), kills = new Array();

  pData.forEach(r => {
    if (r.at(5) === 'angel' && !(r.at(6) === true || r.at(6) === 'TRUE')) guardId = r.at(7);
  });
  if (room.viperTarget) {
    kills.push({ id: room.viperTarget, cause: 'バイパーの毒溶解' });
    updateRoom(roomId, { viperTarget: '' });
  }

  pData.filter(r => r.at(6) === true || r.at(6) === 'TRUE').forEach(r => {
    const ab = r.at(5), tid = r.at(7), t = pData.find(p => p.at(1) === tid);
    if (!t) return;
    const isJekyllHyde = (t.at(5) === 'jekyll' && day % 2 === 0);
    const apparentTeam = isJekyllHyde ? '人狼' : (t.at(5) === 'jekyll' ? '市民' : t.at(4));

    if (ab === 'detective') {
      postChat(roomId, r.at(1), '調査結果', `${t.at(2)} は【${apparentTeam}陣営】です`);
    } else if (ab === 'tracker') {
      const actTarget = pData.find(p => p.at(1) === t.at(7));
      postChat(roomId, r.at(1), '追跡結果', `${t.at(2)} は今夜【${actTarget ? actTarget.at(2) : '行動なし'}】へ向かいました`);
    } else if (ab === 'sheriff') {
      if (apparentTeam !== '市民') kills.push({ id: tid, cause: 'シェリフの正当防衛' });
      else kills.push({ id: r.at(1), cause: 'シェリフの誤爆自決' });
    } else if (ab === 'jackal' || (ab === 'jekyll' && day % 2 === 0)) {
      kills.push({ id: tid, cause: ab === 'jackal' ? 'ジャッカルの襲撃' : 'ハイドの凶行' });
    } else if (new Array('impostor', 'shifter', 'evil_guesser').includes(ab) && tid !== guardId) {
      kills.push({ id: tid, cause: 'インポスターの襲撃' });
    } else if (ab === 'rogue' && tid !== guardId) {
      kills.push({ id: tid, cause: 'ローグの役職奪取キル', rogueId: r.at(1) });
    } else if (ab === 'phantom') {
      kills.push({ id: tid, cause: 'ファントムの奇襲（防御貫通）' });
    } else if (ab === 'viper' && tid !== guardId) {
      updateRoom(roomId, { viperTarget: tid });
    }
  });

  kills.forEach(k => {
    const idx = allRows.findIndex(p => p.at(0) === roomId && p.at(1) === k.id);
    if (idx > 0 && (allRows.at(idx).at(6) === true || allRows.at(idx).at(6) === 'TRUE')) {
      const victim = allRows.at(idx);
      pSheet.getRange(idx + 1, 7).setValue(false);
      postChat(roomId, 'SYSTEM', 'GM', `【朝】${victim.at(2)} さんが無残な姿で発見されました。`);
      if (victim.at(5) === 'noisemaker') postChat(roomId, 'SYSTEM', 'GM', `【警報】ノイズメーカーの ${victim.at(2)} さんが死亡！`);
      logs.push(`${victim.at(2)}（死因: ${k.cause}）`);

      if (k.rogueId) {
        const rIdx = allRows.findIndex(p => p.at(0) === roomId && p.at(1) === k.rogueId);
        if (rIdx > 0 && (allRows.at(rIdx).at(6) === true || allRows.at(rIdx).at(6) === 'TRUE')) {
          pSheet.getRange(rIdx + 1, 4, 1, 3).setValues(new Array(new Array(victim.at(3), victim.at(4), victim.at(5))));
          postChat(roomId, k.rogueId, '役職奪取', `暗殺に成功し、あなたは【${victim.at(3)}（${victim.at(4)}陣営）】に変化しました！`);
        }
      }
    }
  });
  if (!kills.length) postChat(roomId, 'SYSTEM', 'GM', '【朝】昨晩は犠牲者がいませんでした。');

  pData.filter(r => r.at(5) === 'scientist' && (r.at(6) === true || r.at(6) === 'TRUE')).forEach(s => {
    postChat(roomId, s.at(1), 'バイタル解析', logs.length ? logs.join(' / ') : '異常なし');
  });

  if (!checkWinCondition(roomId)) { resetActions(roomId); updateRoom(roomId, { phase: 'DAY', day: day + 1 }); }
}

function checkWinCondition(roomId) {
  const alive = SS.getSheetByName('Players').getDataRange().getValues().filter(r => r.at(0) === roomId && (r.at(6) === true || r.at(6) === 'TRUE'));
  const wolves = alive.filter(r => r.at(4) === '人狼').length;
  const jackals = alive.filter(r => r.at(5) === 'jackal').length;
  const jekylls = alive.filter(r => r.at(5) === 'jekyll').length;
  const onmyojis = alive.filter(r => r.at(5) === 'onmyoji').length;
  const citizens = alive.filter(r => r.at(4) === '市民').length;

  let baseWinner = null;
  if (wolves === 0 && jackals === 0) {
    baseWinner = jekylls > 0 ? 'ジキルとハイド（第三陣営乗っ取り）' : 'クルー陣営（市民）';
  } else if (wolves === 0 && jackals > 0 && jackals >= citizens) {
    baseWinner = 'ジャッカル（第三陣営）';
  } else if (wolves > 0 && wolves >= (citizens + jackals + jekylls)) {
    baseWinner = jekylls > 0 ? 'ジキルとハイド（第三陣営乗っ取り）' : 'インポスター陣営（人狼）';
  }

  if (baseWinner) {
    if (onmyojis > 0) {
      endGame(roomId, `陰陽師（第三陣営生存乗っ取り／元勝者:${baseWinner}）`);
    } else {
      endGame(roomId, baseWinner);
    }
    return true;
  }
  return false;
}

function advancePhaseManual(roomId) {
  if (getRoomObj(roomId).phase === 'DAY') { updateRoom(roomId, { phase: 'VOTE' }); postChat(roomId, 'SYSTEM', 'GM', '議論終了！追放したい人に投票してください。'); }
}

// ★村リセット（チャットログも初期化しロビー状態に戻す）
function resetVillage(roomId) {
  const pSheet = SS.getSheetByName('Players'), pData = pSheet.getDataRange().getValues();
  for (let i = 1; i < pData.length; i++) {
    if (pData.at(i).at(0) === roomId) {
      pSheet.getRange(i + 1, 4, 1, 7).setValues(new Array(new Array('', '', '', true, '', false, '')));
    }
  }
  const cSheet = SS.getSheetByName('Chat'), cData = cSheet.getDataRange().getValues();
  for (let i = cData.length - 1; i >= 1; i--) {
    if (cData.at(i).at(0) === roomId) cSheet.deleteRow(i + 1);
  }
  updateRoom(roomId, { phase: 'LOBBY', day: 1, winner: '', viperTarget: '' });
  postChat(roomId, 'SYSTEM', 'GM', '=== 村がリセットされ、ロビー状態に戻りました ===');
}

function getRoomObj(roomId) {
  const r = SS.getSheetByName('Rooms').getDataRange().getValues().find(row => row.at(0) === roomId);
  return { roomId: r.at(0), phase: r.at(3), day: Number(r.at(4)), viperTarget: r.at(6) };
}
function updateRoom(roomId, patch) {
  const s = SS.getSheetByName('Rooms'), d = s.getDataRange().getValues();
  const cols = { phase: 4, day: 5, winner: 6, viperTarget: 7, nightSec: 8 };
  for (let i = 1; i < d.length; i++) {
    if (d.at(i).at(0) === roomId) {
      for (let k in patch) if (cols[k]) s.getRange(i + 1, cols[k]).setValue(patch[k]);
      return;
    }
  }
}
function endGame(roomId, w) { updateRoom(roomId, { phase: 'END', winner: w }); postChat(roomId, 'SYSTEM', 'GM', `=== 決着！勝者：【${w}】 ===`); }
function resetActions(roomId) {
  const s = SS.getSheetByName('Players'), d = s.getDataRange().getValues();
  for (let i = 1; i < d.length; i++) {
    if (d.at(i).at(0) === roomId) {
      const keep = String(d.at(i).at(9) || '').replace('VENTING', '').trim();
      s.getRange(i + 1, 8, 1, 3).setValues(new Array(new Array('', false, keep)));
    }
  }
}
function postChat(roomId, ch, sender, msg) { SS.getSheetByName('Chat').appendRow(new Array(roomId, new Date(), ch, sender, msg)); }
