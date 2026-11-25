// The chosen sidekick: the LED matrix dither blob, without the drips, with the agent layer on top.
Roamie.register(Roamie.ditherKit({
  id: 'sidekick', label: 'Sidekick', matrix: true, pixel: 1.3, glow: 0.55, speed: 80,
  pal: [[4, 8, 18], [14, 52, 96], [32, 184, 204], [120, 239, 255], [230, 252, 255]],
  plugin: (kit) => Roamie.agentPlugin?.(kit) ?? null,
}));
