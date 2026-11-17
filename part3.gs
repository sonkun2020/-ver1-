function getRoomState(roomId, playerId, adminPass) {
  const lock = LockService.getScriptLock();
  lock.tryLock(5000);
  try {
    const rData = SS.getSheetByName('Rooms').getDataRange().getValues();
    const rRow = rData.find(r => r.at(0) === roomId);
    if (!rRow) return { error: 'ルームが存在しません' };

    const isAdmin = (adminPass === ADMIN_PASSWORD);
    const room = {
      roomId: rRow.at(0), roomName: rRow.at(1), hostId: rRow.at(2),
      phase: rRow.at(3), day: Number(rRow.at(4)), winner: rRow.at(5),
      viperTarget: rRow.at(6), nightSec: Number(rRow.at(7))
    };

    const pData = SS.getSheetByName('Players').getDataRange().getValues();
    const players = new Array();
    let me = null;

    for (let i = 1; i < pData.length; i++) {
      const r = pData.at(i);
      if (r.at(0) !== roomId) continue;
      const p = {
        id: r.at(1), name: r.at(2), role: r.at(3), team: r.at(4), ability: r.at(5),
        alive: r.at(6) === true || r.at(6) === 'TRUE', target: r.at(7),
        voted: r.at(8) === true || r.at(8) === 'TRUE', extra: String(r.at(9) || '')
      };
      if (p.id === playerId) me = p;
      const isWolf = me && me.team === '人狼' && p.team === '人狼';
      const canSee = isAdmin || (room.phase === 'END') || (p.id === playerId) || isWolf;
      players.push({
        id: p.id, name: p.name, alive: p.alive,
        role: canSee ? p.role : '？？？', team: canSee ? p.team : '',
        voted: p.voted, isHost: p.id === room.hostId
      });
    }

    const messages = getRoomMessages(roomId, me, playerId, room.phase, isAdmin);
    return { room, players, me, messages, allRoles: ALL_ROLES, isAdmin };
  } finally { lock.releaseLock(); }
}

function getRoomMessages(roomId, me, playerId, phase, isAdmin) {
  const cData = SS.getSheetByName('Chat').getDataRange().getValues();
  const list = new Array();
  for (let i = 1; i < cData.length; i++) {
    const r = cData.at(i);
    if (r.at(0) !== roomId) continue;
    const ch = r.at(2);
    const isWolf = me && me.team === '人狼';
    const isDead = me && !me.alive;
    const isVent = me && me.ability === 'engineer' && me.extra === 'VENTING';

    const canRead =
      isAdmin || ch === 'ALL' || ch === 'SYSTEM' || ch === playerId || phase === 'END' ||
      (ch === 'WOLF' && (isWolf || isVent)) ||
      (ch === 'DEAD' && isDead);

    if (canRead) {
      const sender = (ch === 'WOLF' && isVent && !isWolf && !isAdmin) ? 'ダクト内の声' : r.at(3);
      list.push({
        time: Utilities.formatDate(new Date(r.at(1)), 'Asia/Tokyo', 'HH:mm'),
        channel: ch, sender: sender, text: String(r.at(4))
      });
    }
  }
  return list.slice(-80);
}

// ★管理者専用関数群
function verifyAdminPass(pass) {
  if (pass !== ADMIN_PASSWORD) throw new Error('管理者パスワードが違います');
  return true;
}

function adminAddBots(roomId, pass, count) {
  verifyAdminPass(pass);
  const pSheet = SS.getSheetByName('Players');
  for (let i = 1; i <= count; i++) {
    const botId = 'bot_' + Math.random().toString(36).substring(2, 7);
    pSheet.appendRow(new Array(roomId, botId, `テストBot${i}`, '', '', '', true, '', false, ''));
  }
  postChat(roomId, 'SYSTEM', 'GM', `【管理者】テスト用Botを${count}体追加しました`);
}

function adminSetRole(roomId, pass, targetPlayerId, roleName) {
  verifyAdminPass(pass);
  const roleObj = ALL_ROLES.find(r => r.name === roleName);
  if (!roleObj) throw new Error('役職が見つかりません');
  const pSheet = SS.getSheetByName('Players');
  const pData = pSheet.getDataRange().getValues();
  for (let i = 1; i < pData.length; i++) {
    if (pData.at(i).at(0) === roomId && pData.at(i).at(1) === targetPlayerId) {
      pSheet.getRange(i + 1, 4, 1, 3).setValues(new Array(new Array(roleObj.name, roleObj.team, roleObj.ability)));
      postChat(roomId, 'SYSTEM', 'GM', `【管理者】${pData.at(i).at(2)} の役職を「${roleObj.name}」に変更しました`);
      break;
    }
  }
}

function adminForceNext(roomId, pass) {
  verifyAdminPass(pass);
  const room = getRoomObj(roomId);
  const pSheet = SS.getSheetByName('Players');
  const pData = pSheet.getDataRange().getValues().filter(r => r.at(0) === roomId);
  const alive = pData.filter(r => r.at(6) === true || r.at(6) === 'TRUE');

  if (room.phase === 'DAY') {
    updateRoom(roomId, { phase: 'VOTE' });
    postChat(roomId, 'SYSTEM', 'GM', '【管理者強制進行】投票フェーズへ移行しました');
  } else if (room.phase === 'VOTE') {
    // 未投票のプレイヤーにランダム投票を入れて強制集計
    const allRows = pSheet.getDataRange().getValues();
    for (let i = 1; i < allRows.length; i++) {
      const r = allRows.at(i);
      if (r.at(0) === roomId && (r.at(6) === true || r.at(6) === 'TRUE') && !(r.at(8) === true || r.at(8) === 'TRUE')) {
        const others = alive.filter(a => a.at(1) !== r.at(1));
        const pick = others.at(Math.floor(Math.random() * others.length));
        if (pick) pSheet.getRange(i + 1, 8, 1, 2).setValues(new Array(new Array(pick.at(1), true)));
      }
    }
    const updated = pSheet.getDataRange().getValues().filter(r => r.at(0) === roomId);
    resolveVote(roomId, updated, updated.filter(r => r.at(6) === true || r.at(6) === 'TRUE'));
  } else if (room.phase === 'NIGHT') {
    resolveNight(roomId, pData, room.day);
  }
}
