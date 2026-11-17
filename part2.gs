function doGet() {
  initSheets();
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('オンライン人狼 闇鍋 - GAS闇鍋版')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function initSheets() {
  const defs = {
    'Rooms': new Array('roomId', 'roomName', 'hostId', 'phase', 'day', 'winner', 'viperTarget', 'nightSec'),
    'Players': new Array('roomId', 'id', 'name', 'role', 'team', 'ability', 'alive', 'target', 'voted', 'extra'),
    'Chat': new Array('roomId', 'timestamp', 'channel', 'sender', 'message')
  };
  for (let name in defs) {
    let s = SS.getSheetByName(name);
    if (!s) { s = SS.insertSheet(name); s.appendRow(defs[name]); }
  }
}

function createRoom(playerId, nickName, roomName) {
  initSheets();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const rName = roomName.trim() || '金曜夜の闇鍋村';
    SS.getSheetByName('Rooms').appendRow(new Array(roomId, rName, playerId, 'LOBBY', 1, '', '', 70));
    SS.getSheetByName('Players').appendRow(new Array(roomId, playerId, nickName, '', '', '', true, '', false, ''));
    postChat(roomId, 'SYSTEM', 'GM', `${nickName} さんがルーム『${rName}』を作成しました`);
    postChat(roomId, 'SYSTEM', 'GM', `ルームID ${roomId} を共有して仲間を集めましょう（5〜12人）`);
    return { roomId };
  } finally { lock.releaseLock(); }
}

function joinRoom(playerId, nickName, roomIdInput) {
  initSheets();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const roomId = roomIdInput.trim().toUpperCase();
    const rooms = SS.getSheetByName('Rooms').getDataRange().getValues();
    const room = rooms.find(r => r.at(0) === roomId);
    if (!room) throw new Error('指定されたルームIDが見つかりません');

    const pSheet = SS.getSheetByName('Players');
    const pData = pSheet.getDataRange().getValues();
    const existing = pData.find(r => r.at(0) === roomId && r.at(1) === playerId);
    if (!existing) {
      if (room.at(3) !== 'LOBBY') throw new Error('このルームは既にゲーム開始済みです');
      pSheet.appendRow(new Array(roomId, playerId, nickName, '', '', '', true, '', false, ''));
      postChat(roomId, 'SYSTEM', 'GM', `${nickName} さんが入室しました`);
    }
    return { roomId };
  } finally { lock.releaseLock(); }
}

function leaveRoom(roomId, playerId) {
  const lock = LockService.getScriptLock();
  lock.tryLock(5000);
  try {
    const pSheet = SS.getSheetByName('Players');
    const pData = pSheet.getDataRange().getValues();
    for (let i = pData.length - 1; i >= 1; i--) {
      if (pData.at(i).at(0) === roomId && pData.at(i).at(1) === playerId) {
        const name = pData.at(i).at(2);
        pSheet.deleteRow(i + 1);
        postChat(roomId, 'SYSTEM', 'GM', `${name} さんが退室しました`);
        break;
      }
    }
  } finally { lock.releaseLock(); }
}
