
// priority: 800

const bosses = {
  "overworld": [
    "bogged",
    "bogged_in_wet",
    "breeze",
    "enderman",
    "husk",
    "husk_in_dry",
    "skeleton",
    "stray",
    "stray_in_cold",
    "vindicator",
    "vindicator",
    "wolf",
    "zombie"
  ],
  "the_nether": [
    "blaze",
    "piglin",
    "piglin_brute",
    "wither_skeleton",
    "zoglin",
    "zombified_piglin"
  ],
  "the_end": [
    "enderman",
    "endermite",
    "evoker",
    "phantom",
    "shulker"
  ]
}

const event_apoth_boss = {
  name: "ftb:apoth_boss",
  displayName: "Apotheosis Boss Event",
  description: "Toggles the Apotheosis Boss Event. Spawns a random Apotheosis Boss near you.",
  chance: 1,
  minDistance: 12,
  maxDistance: 24,
  size: 0,
  checkBlocks: ["minecraft:air"],
  requireBlockBelow: true,
  stage: null,
  disableStage: null,

  commandSuggestions: [
    {"bypassOmen": true},
    {"dimension": "overworld", "bypassOmen": true},
    {"dimension": "the_nether", "bypassOmen": true},
    {"dimension": "the_end", "bypassOmen": true},
  ],

  execute(event, player, location, name, options) {
    const level = player.getLevel();
    const server = level.getServer();

    if(!options.bypassOmen){
      if(!player.potionEffects.isActive("minecraft:bad_omen")) return;
    }
    
    player.sendSystemMessage({ text: "⚠ " + 'You hear some rustling nearby as if some creature is approaching...', color: "red" }, true);

    let dimension = "overworld";
    if (options.dimension){
      dimension = options.dimension.toString().replace('"', '');
    }
    let boss = `apotheosis:${dimension}/${bosses[dimension][Math.floor(Math.random() * bosses[dimension].length)]}`
    if(options.boss){
      boss = options.boss.toString().replace('"', '');
    }

    server.scheduleInTicks(140, () => {
      player.sendSystemMessage({ text: "⚠ " + 'Its an Apotheosis Boss! Quick Kill it!', color: "red" }, true);

      let command =  `execute in ${player.level.dimension} as ${player.username} run apoth spawn_boss ${location.pos.x} ${location.pos.y - 1} ${location.pos.z} ${boss}`;
      console.log(command);
      server.runCommand(command);
    })
  }
};

const $InvaderRegistry = Java.loadClass("dev.shadowsoffire.apotheosis.mobs.registries.InvaderRegistry")
$InvaderRegistry.INSTANCE.getKeys().stream().forEach((boss) => {
  event_apoth_boss.commandSuggestions.push({"boss": boss.toString(), "bypassOmen": true});
})