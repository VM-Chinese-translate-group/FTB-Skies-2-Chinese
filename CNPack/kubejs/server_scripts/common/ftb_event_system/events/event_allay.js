// priority: 800

const allaySettings = {
    despawnInSeconds: 60
}

allTrades.forEach(t => {
    before_cobble.trades.push(t);
    after_cobble.trades.push(t);
    after_iron.trades.push(t);  
})

after_iron.trades.forEach(t => {
    after_diamond.trades.push(t);
});

after_diamond.trades.forEach(t => {
    after_netherite.trades.push(t);
});


const trades = {
    "before_cobble": before_cobble,
    "after_cobble": after_cobble,
    "after_iron": after_iron,
    "after_diamond": after_diamond,
    "after_netherite": after_netherite
};



/**
 * Represents a template event. Object name should be added to the ftbEvents object in the main script.
 * @property {string} name - The name of the event. Used for identification.
 * @property {string} displayName - The display name of the event. Used for display purposes.
 * @property {string} description - The description of the event. Not used at the moment
 * @property {number} chance - The chance of the event occurring. 0.0 - 1.0
 * @property {string|null} stage - The stage of the event. Stage needed before this Event can happen
 * @property {string|null} disableStage - The stage needed to be able to disable this event
 *
 * @property {number} size - The size of the event area / mob needed spawning area.
 * @property {number} minDistance - The minimum distance for the event.
 * @property {number} maxDistance - The maximum distance for the event.
 * @property {string[]} checkBlocks - The blocks to check for the event. (Example minecraft:chest for the Mimic Event)
 * @property {boolean} requireBlockBelow - Indicates if a block below is required for the event.
 *
 * @property {Function} execute - The function to execute when the event occurs.
 */
const event_allay = {
  name: "ftb:allay",
  displayName: "Allay Trade Event",
  description: "A random Allay spawns, having a special trade for the player, based on their game stage.",
  chance: 1,
  stage: null,
  disableStage: null,

  size: 0,
  minDistance: 4,
  maxDistance: 8,

  checkBlocks: ["minecraft:air"],
  requireBlockBelow: false,
  commandSuggestions: [
    {buy:"minecraft:emerald", sell:"minecraft:diamond"},
    {buy:"minecraft:emerald", action: "give @p minecraft:diamond", name: "customName", spawn_message: "custom Spawning Message", success_message: "You have been given a diamond!"}
  ],
  /**
   * Executes the event.
   * In here you can do almost everything you want.
   *
   * @param {Event} event - The event object. limited use when triggering the event with the force command
   * @param {Player} player - The player object.
   * @param {Location} location - The location object.
   */
  execute(event, player, location, name, options) {
    let level = player.getLevel();
    let server = level.getServer();
    
    let randomTrade;
    if(!options?.buy){
        let highestStage = getHighestGameStage(player.stages.getAll().toArray());
        let table = trades[highestStage];
        randomTrade = Ku.Lists.getEntryBasedOnWeight(table.trades.map(t => {t.weight = t.weight / 100; return t;}));
        if (!randomTrade) throw new Error(`No trades found for stage: ${highestStage}`);
    }
    let allay = level.createEntity("minecraft:allay");

    let trade = new allayTrade()
        .addBuy(options?.buy ?? randomTrade?.buy)
        .addSell(options?.sell ?? randomTrade?.sell)
        .addAction(options?.action ?? randomTrade?.action)
        .addSuccessMessage(options?.success_message ?? randomTrade?.success_message)
        .addSpawnMessage(options?.spawn_message ?? randomTrade?.spawn_message)
        .addName(options?.name ?? randomTrade?.name)
        .build();
    allay.persistentData["trade"] = trade;

    allay.setGlowing(true);
    allay.setPos(location.pos.x, location.pos.y + 1, location.pos.z);
    allay.setInvulnerable(true);
    // customName = customName ?? `Allay Trade: ${Text.translate(Item.of(trade.buy).getDescriptionId()).getString()} for ${Text.translate(Item.of(trade.sell).getDescriptionId()).getString()}`;
    allay.setCustomName(trade.name);
    allay.spawn();

    // spawn_message = spawn_message ?? Text.translate("ftb_event_system.event.allay.spawned", [Text.of(Item.of(trade.buy).displayName), Text.of(Item.of(trade.sell).displayName)]);
    player.tell(trade.spawn_message);;


    [20, 40].forEach(seconds => {
        server.scheduleInTicks(20 * seconds, _ => {
            allay.getNavigation().moveTo(player, 1.5);
        });
    })
    server.scheduleInTicks(20, (_) => {
      player.persistentData.timer = 10; //lower their event timer instead of a full reset
    });
  },
};

ItemEvents.entityInteracted(event => {
    const {player, target, level, server} = event;
    if(target.type !== "minecraft:allay" || target.getCustomName() == "Fairy") return;
    if (!target.persistentData["trade"]) return;

    const trade = allayTrade.of(target.persistentData["trade"]);
    server.scheduleInTicks(2, _ => {
        if(target.getMainHandItem().id === trade.buy){
            trade.isTrading = true;
            target.setDancing(true);
            server.scheduleInTicks(20, _ => {
                player.tell(trade.success_message)
                target.setGlowing(false);
                
                server.scheduleInTicks(20, _ => {

                    if(trade.sell){
                        let item = level.createEntity("minecraft:item");
                        item.setItem(trade.sell);
                        item.setPos(target.x, target.y, target.z);
                        item.setGlowing(true);
                        item.setNoGravity(true);
                        item.spawn();
                        server.scheduleInTicks(20*5, _ => {item.setNoGravity(false); item.setGlowing(false)})
                    }
                    if(trade.action){
                        let runCommand = `execute as ${target.uuid} run ${JSON.parse(trade.action)}`
                        server.runCommand(runCommand);
                    }

                    level.spawnParticles("minecraft:smoke", true, target.x, target.y, target.z, 0.25, 0.5, 0.25, 25, 0.01);
                    level.spawnParticles("minecraft:heart", true, target.x, target.y, target.z, 0.5, 0.5, 0.5, 10, 0.5);
                    target.discard();
                });
            })
        }else{
            player.sendSystemMessage(Text.of("I don't want this thingy!").red().bold());
            
        }
    })
})
LevelEvents.tick(event => {
    const {level, server} = event;
    if (server.getTickCount() % 20 !== 0) return;
    const allays = level.getEntities().filter(entity => entity.type === "minecraft:allay");
    if (allays.length === 0) return;

    for (const allay of allays) {
        if (allay.persistentData["trade"]) {
            let data = allay.persistentData["trade"];
            if (data.isTrading.getAsInt() == 0 && (new Date(data.spawnTime.getAsFloat())).getTime()+allaySettings.despawnInSeconds*1000 < new Date().getTime()) {
                level.spawnParticles("minecraft:smoke", true, allay.x, allay.y, allay.z, 0.35, 0.75, 0.35, 50, 0.01);
                allay.discard();
            }
        }
    }
})



const getHighestGameStage = (stages) => {
    let highestStage = "before_cobble";
    let highestValue = trades[highestStage].value;
    for (const stage of stages) {
        if (trades[stage] && trades[stage].value > highestValue) {
            highestStage = stage;
            highestValue = trades[stage].value;
        }
    }
    return highestStage;
}


function allayTrade() {
    this.name = null;
    this.buy = null;
    this.sell = null;
    this.action = null;
    this.success_message = null;
    return this;
}

allayTrade.prototype.addBuy = function (item) {
    this.buy = item;
    return this;
}
allayTrade.prototype.addSell = function (item) {
    this.sell = item;
    return this;
}
allayTrade.prototype.addAction = function (action) {
    this.action = action;
    return this;
}
allayTrade.prototype.addSpawnMessage = function (message) {
    this.spawn_message = message;
    return this;
}
allayTrade.prototype.addSuccessMessage = function (message) {
    this.success_message = message;
    return this;
}
allayTrade.prototype.addName = function (name) {
    this.name = name;
    return this;
}
allayTrade.prototype.build = function () {
    if (!this.buy) {
        throw new Error("Buy item is required for Allay Trade");
    }
    if (!this.sell && !this.action) {
        throw new Error("Sell item or action is required for Allay Trade");
    }
    if (this.action && !this.success_message) {
        throw new Error("Success message is required when using an action for Allay Trade");
    }
    if (this.action && !this.name) {
        throw new Error("Name is required when using an action for Allay Trade");
    }
    if (this.action && !this.spawn_message) {
        throw new Error("Spawn message is required when using an action for Allay Trade");
    }
    if (this.sell && !this.name) {
        this.name = `Allay Trade: ${Text.translate(Item.of(this.buy).getDescriptionId()).getString()} for ${Text.translate(Item.of(this.sell).getDescriptionId()).getString()}`;
    }
    else if (!this.name) {
        this.name = `Allay Trade: ${Text.translate(Item.of(this.buy).getDescriptionId()).getString()}`;
    }
    if (!this.spawn_message) {
        this.spawn_message = Text.translate("ftb_event_system.event.allay.spawned", [Text.of(Item.of(this.buy).displayName), Text.of(Item.of(this.sell).displayName)]);
    }
    if (!this.success_message) {
        this.success_message = Text.translate("ftb_event_system.event.allay.trade.success", [Text.of(Item.of(this.sell).displayName)]);
    }


    return {
        buy: this.buy,
        sell: this.sell,
        action: this.action,
        success_message: this.success_message,
        spawn_message: this.spawn_message,
        name: this.name,
        isTrading: false,
        spawnTime: new Date().getTime(),
    
    };
}
allayTrade.of = function(json) {
    const trade = new allayTrade();
    if (json.buy) trade.addBuy(json.buy);
    if (json.sell) trade.addSell(json.sell);
    if (json.action) trade.addAction(json.action);
    if (json.success_message) trade.addSuccessMessage(json.success_message);
    if (json.spawn_message) trade.addSpawnMessage(json.spawn_message);
    if (json.name) trade.addName(json.name);
    return trade.build();
};