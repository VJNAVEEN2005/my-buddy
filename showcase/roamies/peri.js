// Peri: cut from Naveen's Peri art sheet (roamies/looks/peri/), animated by roamies/sprites.js.
// Talking, listening, pointing and waving were generated from Naveen's sheet in Google Flow. A missing pose falls back to the closest one.
(() => {
  const R = window.Roamie;
  if (!R?.spriteLook) return;
  R.spriteLook('peri', {
    name: 'Peri', height: 2.7, foot: 1.35, glow: 'rgba(150,130,255,A)', ring: '#7fe9ff',
    poses: {'idle': [174, 185], 'blink': [175, 188], 'happy': [165, 191], 'excited': [176, 202], 'thinking': [183, 186], 'surprised': [169, 190], 'sad': [159, 174], 'angry': [167, 173], 'hiding': [114, 186], 'floating': [182, 222], 'jump': [172, 244], 'sleep': [220, 193], 'disappear': [182, 197], 'talking': [147, 182], 'listening': [137, 186], 'pointing': [150, 182], 'waving': [140, 186], 'cheer': [124, 181], 'thumbsup': [126, 185], 'remind': [121, 185], 'upset': [124, 185], 'dizzy': [159, 185], 'curious': [135, 185], 'love': [143, 186], 'yawn': [149, 184], 'laughing': [136, 184], 'crying': [130, 185], 'scared': [133, 186], 'shy': [135, 185]},
    // Cursor art from Flow: [w, h, tip x, tip y] (the arrow's tip is the hotspot).
    cursors: {'cur-normal': [83, 96, 1, 0], 'cur-click': [85, 96, 1, 1], 'cur-busy': [84, 96, 1, 1], 'cur-look': [85, 96, 1, 1]},
    // Character-to-cursor clip from Flow (frames in looks/peri/tx-cursor.webp, a grid); played backwards to come back.
    toCursor: {'n': 36, 'cols': 6, 'w': 283, 'h': 175, 'fps': 36, 'blend': 7, 'skip': 9, 'tip': [116, 41], 'curH': 111, 'body': [152, 136], 'bodyH': 92},
    // Entrance clip from Flow (frames in looks/peri/tx-entry.webp): forms out of sparkles, ends on the idle pose.
    entry: {'n': 36, 'cols': 6, 'w': 270, 'h': 175, 'blend': 5, 'body': [138, 146], 'bodyH': 113},
    pick(s, P) {
      if (s.sleepy) return 'sleep';
      if (s.act === 'hype') return s.a % 0.6 < 0.3 ? 'jump' : 'excited';
      if (s.act === 'wave') return P.waving ? 'waving' : 'happy';
      if (s.act === 'remind') return 'remind';
      if (s.act === 'upset') return 'upset';
      if (s.act === 'motivate') return s.a % 1.2 < 0.6 ? 'cheer' : 'thumbsup';
      if (s.mode === 'think') return 'thinking';
      if (s.mode === 'listen') return P.listening ? 'listening' : 'idle';
      if (s.mode === 'talk') return P.talking ? 'talking' : 'floating';
      if (s.pointing) return P.pointing ? 'pointing' : 'idle';
      if (s.dizzy) return P.dizzy ? 'dizzy' : 'excited';
      if (s.feel === 'laugh') return 'laughing';
      if (s.feel === 'cry') return 'crying';
      if (s.feel === 'scared') return 'scared';
      if (s.feel === 'tired' && P.yawn) return 'yawn';
      if (s.feel === 'love' && P.love) return 'love';
      if (s.feel === 'shy') return 'shy';
      if (s.angry) return 'angry';
      if (s.sad) return 'sad';
      if (s.surprised) return 'surprised';
      if (s.curious) return 'curious';
      if (s.happy) return 'happy';
      if (s.blink) return 'blink';
      return 'idle';
    },
  });
})();
