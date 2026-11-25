// Nova: cut from Naveen's Nova art sheet (roamies/looks/nova/), animated by roamies/sprites.js.
// Talking, listening, pointing, waving and the extra feelings (laughing, crying, scared, shy, dizzy, surprised, love, yawn) come from Naveen's later Nova sheets. A pose it lacks falls back to the closest one.
(() => {
  const R = window.Roamie;
  if (!R?.spriteLook) return;
  R.spriteLook('nova', {
    name: 'Nova', height: 2.7, foot: 1.35, glow: 'rgba(140,110,255,A)', ring: '#7fe9ff',
    poses: {'idle': [170, 219], 'happy': [159, 214], 'excited': [164, 208], 'curious': [159, 209], 'thinking': [177, 204], 'sleep': [194, 193], 'sad': [165, 202], 'angry': [177, 184], 'wave': [176, 205], 'jump': [169, 244], 'peek': [125, 231], 'disappear': [162, 198], 'lie': [182, 133], 'star': [134, 157], 'back': [140, 180], 'talking': [189, 226], 'listening': [152, 219], 'pointing': [206, 217], 'waving': [184, 218], 'laughing': [189, 219], 'crying': [152, 216], 'scared': [162, 215], 'shy': [167, 215], 'dizzy': [166, 203], 'surprised': [150, 201], 'love': [148, 200], 'yawn': [150, 197], 'cheer': [184, 219], 'thumbsup': [186, 216], 'remind': [165, 217], 'upset': [170, 215]},
    // Cursor art from Flow: [w, h, tip x, tip y] (the arrow's tip is the hotspot).
    cursors: {'cur-normal': [83, 96, 2, 1], 'cur-click': [86, 96, 2, 1], 'cur-busy': [85, 96, 2, 1], 'cur-look': [79, 96, 2, 1]},
    // Character-to-cursor clip from Flow (frames in looks/nova/tx-cursor.webp, a grid); played backwards to come back.
    toCursor: {'n': 36, 'cols': 6, 'w': 226, 'h': 169, 'fps': 36, 'blend': 7, 'skip': 11, 'tip': [85, 35], 'curH': 119, 'body': [117, 139], 'bodyH': 105},
    // Entrance clip from Flow (frames in looks/nova/tx-entry.webp): forms out of sparkles, ends on the idle pose.
    entry: {'n': 36, 'cols': 6, 'w': 298, 'h': 175, 'blend': 5, 'body': [158, 146], 'bodyH': 114},
    pick(s, P) {
      if (s.sleepy) return 'sleep';
      if (s.act === 'hype') return s.a % 0.6 < 0.3 ? 'jump' : 'excited';
      if (s.act === 'wave') return P.waving ? 'waving' : 'wave';
      if (s.act === 'remind') return 'remind';
      if (s.act === 'upset') return 'upset';
      if (s.act === 'motivate') return s.a % 1.2 < 0.6 ? 'cheer' : 'thumbsup';
      if (s.mode === 'think') return 'thinking';
      if (s.mode === 'listen') return P.listening ? 'listening' : 'curious';
      if (s.mode === 'talk') return P.talking ? 'talking' : 'happy';
      if (s.pointing) return P.pointing ? 'pointing' : 'wave';
      if (s.dizzy) return 'dizzy';
      if (s.feel === 'laugh') return 'laughing';
      if (s.feel === 'cry') return 'crying';
      if (s.feel === 'scared') return 'scared';
      if (s.feel === 'tired') return 'yawn';
      if (s.feel === 'love') return 'love';
      if (s.feel === 'shy') return 'shy';
      if (s.angry) return 'angry';
      if (s.sad) return 'sad';
      if (s.surprised) return 'surprised';
      if (s.curious) return 'curious';
      if (s.happy) return 'happy';
      return 'idle';
    },
  });
})();
