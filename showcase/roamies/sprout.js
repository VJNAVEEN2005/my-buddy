// Sprout: cut from Naveen's Sprout art sheet (roamies/looks/sprout/), animated by roamies/sprites.js.
// Talking, listening, pointing and waving were generated from Naveen's sheet in Google Flow. A missing pose falls back to the closest one.
(() => {
  const R = window.Roamie;
  if (!R?.spriteLook) return;
  R.spriteLook('sprout', {
    name: 'Sprout', height: 3.4, foot: 1.3, ground: true, glow: 'rgba(150,220,110,A)', ring: '#c8f59a',
    poses: {'idle': [173, 240], 'happy': [168, 245], 'excited': [179, 206], 'curious': [184, 199], 'thinking': [140, 240], 'sad': [164, 228], 'angry': [147, 190], 'surprised': [141, 171], 'sitting': [207, 240], 'sleeping': [226, 174], 'walking': [217, 219], 'jump': [170, 247], 'peek': [122, 204], 'disappear': [131, 171], 'talking': [183, 240], 'listening': [145, 242], 'pointing': [198, 240], 'waving': [174, 238], 'cheer': [192, 247], 'thumbsup': [171, 239], 'remind': [170, 241], 'upset': [172, 237], 'laughing': [189, 243], 'crying': [174, 233], 'scared': [155, 237], 'shy': [169, 255]},
    // Cursor art from Flow: [w, h, tip x, tip y] (the arrow's tip is the hotspot).
    cursors: {'cur-normal': [71, 96, 1, 1], 'cur-click': [72, 96, 1, 1], 'cur-busy': [71, 96, 1, 0], 'cur-look': [75, 96, 1, 1]},
    // Character-to-cursor clip from Flow (frames in looks/sprout/tx-cursor.webp, a grid); played backwards to come back.
    toCursor: {'n': 36, 'cols': 6, 'w': 243, 'h': 173, 'fps': 36, 'blend': 7, 'skip': 14, 'tip': [94, 36], 'curH': 122, 'body': [122, 145], 'bodyH': 114},
    // Entrance clip from Flow (frames in looks/sprout/tx-entry.webp): forms out of leafy sparkles, ends on the sitting pose.
    entry: {'n': 36, 'cols': 6, 'w': 291, 'h': 175, 'blend': 5, 'body': [154, 147], 'bodyH': 114},
    pick(s, P) {
      if (s.sleepy) return 'sleeping';
      if (s.act === 'hype') return s.a % 0.6 < 0.3 ? 'jump' : 'excited';
      if (s.act === 'wave') return P.waving ? 'waving' : 'happy';
      if (s.act === 'remind') return 'remind';
      if (s.act === 'upset') return 'upset';
      if (s.act === 'motivate') return s.a % 1.2 < 0.6 ? 'cheer' : 'thumbsup';
      if (s.moving) return 'walking';
      if (s.mode === 'think') return 'thinking';
      if (s.mode === 'listen') return P.listening ? 'listening' : 'curious';
      if (s.mode === 'talk') return P.talking ? 'talking' : 'happy';
      if (s.pointing) return P.pointing ? 'pointing' : 'curious';
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
      return 'sitting';
    },
  });
})();
