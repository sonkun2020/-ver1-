const SS = SpreadsheetApp.getActiveSpreadsheet();

// ★管理者用(新要素の確かめ等用)
const ADMIN_PASSWORD = '1111';

const ALL_ROLES = new Array(
  // 市民陣営
  { name: 'ナイスゲッサー', team: '市民', ability: 'nice_guesser', desc: '昼の議論中、1日1回相手の役職を当てて即死させる。外すと自爆する。' },
  { name: 'シェリフ', team: '市民', ability: 'sheriff', desc: '夜に対象1人を撃つ。相手が人狼・第三陣営なら倒し、市民なら自分が自爆する。' },
  { name: 'エンジニア', team: '市民', ability: 'engineer', desc: '夜にダクト潜伏を選ぶと、インポスター専用チャットの会話を盗み見できる。' },
  { name: '科学者', team: '市民', ability: 'scientist', desc: '夜にバイタル解析を行い、翌朝に前夜の死亡者の正確な死因を知る。' },
  { name: '守護天使', team: '市民', ability: 'angel', desc: '自分が死亡した後、毎晩生存者1人にバリアを張り襲撃から守る。' },
  { name: 'ノイズメーカー', team: '市民', ability: 'noisemaker', desc: '自分が死亡した瞬間、全員にノイズメーカー死亡の警報を鳴らす。' },
  { name: 'トラッカー', team: '市民', ability: 'tracker', desc: '夜に対象1人を追跡し、その人が夜に誰へ能力を使ったかを知る。' },
  { name: 'ディテクティブ', team: '市民', ability: 'detective', desc: '夜に対象1人を調査し、相手の陣営（市民・人狼・第三）を特定する。' },
  { name: 'メイヤー', team: '市民', ability: 'mayor', desc: '昼の追放投票において、自分の投票が常に2票分としてカウントされる。' },
  { name: 'プロセキューター', team: '市民', ability: 'prosecutor', desc: '昼の議論中、1ゲームに1回だけ対象1人を指定して即座に強制追放できる。' },
  { name: 'クルーメイト', team: '市民', ability: 'none', desc: '特殊能力を持たない一般クルー。議論と推理でインポスターを追放する。' },
  // 人狼陣営
  { name: 'イビルゲッサー', team: '人狼', ability: 'evil_guesser', desc: '昼の議論中、1日1回相手の役職を当てて即死させる。外すと自爆する。夜襲撃も可。' },
  { name: 'インポスター', team: '人狼', ability: 'impostor', desc: '夜にクルー1人を襲撃する。人狼陣営同士で専用チャットが可能。' },
  { name: 'シェイプシフター', team: '人狼', ability: 'shifter', desc: '昼の全体チャットで他人の名前に変装して発言できる。夜襲撃も可。' },
  { name: 'ファントム', team: '人狼', ability: 'phantom', desc: '夜に透明化して襲撃するため、守護天使のバリアを貫通してキルできる。' },
  { name: 'バイパー', team: '人狼', ability: 'viper', desc: '夜に毒で襲撃し、死亡アナウンスを1日遅らせて死体を溶解させる。' },
  // 第三陣営
  { name: 'ローグ', team: '第三', ability: 'rogue', desc: '夜に対象1人を暗殺し、倒した相手の役職・陣営・能力をそのまま奪って変化する。' },
  { name: '陰陽師', team: '第三', ability: 'onmyoji', desc: '市民・人狼の頭数カウントに含まれず、いずれかの陣営が勝利した際に生存していれば勝利を奪う。' },
  { name: 'ジェスター', team: '第三', ability: 'jester', desc: '昼の投票で追放された瞬間に単独勝利となる。夜の襲撃では勝利にならない。' },
  { name: 'ジャッカル', team: '第三', ability: 'jackal', desc: '毎晩1人をキルできる第三陣営。人狼全滅かつ生存で勝利を乗っ取る。' },
  { name: 'ジキルとハイド', team: '第三', ability: 'jekyll', desc: '奇数日は「ジキル（市民判定・無能力）」、偶数日は「ハイド（人狼判定・夜キル可）」に変化。終了時生存で勝利乗っ取り。' }
);

function getRolePools() {
  return {
    CITIZEN: ALL_ROLES.filter(r => r.team === '市民'),
    WOLF: ALL_ROLES.filter(r => r.team === '人狼'),
    THIRD: ALL_ROLES.filter(r => r.team === '第三')
  };
}
