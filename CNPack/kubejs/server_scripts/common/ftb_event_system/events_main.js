//priority: 100
const ftbEvents = [
    event_allay,
    event_creeper,
    event_goat,
    event_frog,
    event_trader,
    event_fairy,
    event_phantom,
    event_apoth_boss,
    event_llama,
    event_pyromancer
];

const defaultSettings = {
    timer: 0,  //initial timer
    timerDelay: 1000, //time in ticks for the event to trigger
    debug: false, //debug mode
    maxAttempts: 50, //max attempts to find a spawn location
    chance: 0.4, //chance of no event for the player this time
    timeCooldown: 12000, //time in ticks to check if a player has had an event recently

}


ServerEvents.loaded((event) => {
    let sPData = event.server.persistentData;
    let settings = sPData.contains("eventSettings") ? sPData.getCompound("eventSettings") : sPData.putCompound("eventSettings", {});

    for (let key in defaultSettings) {
        if (!settings.contains(key)) {
            const value = defaultSettings[key];
            if (typeof value === "boolean") {
                settings.putBoolean(key, value);
            } else if (typeof value === "number") {
                // Choose appropriate NBT method for int vs double
                if (Number.isInteger(value)) {
                    settings.putInt(key, value);
                } else {
                    settings.putDouble(key, value);
                }
            }
        }
    }

    sPData.Statistics = sPData.Statistics ?? {
        totalEvents: 0,
        success: {},
        failure: {},
    };
});

PlayerEvents.tick((event) => {
    const {player:{persistentData}} = event;
    let timer = persistentData.contains('timer') ? persistentData.getInt('timer') : 0;
    persistentData.timer = timer + 1;

});

ServerEvents.tick((event) => {
    const { server: { persistentData } } = event;

    if (!persistentData.contains("eventSettings")) {
        return; // Exit early if eventSettings is not yet initialized
    }

    const eventSettings = persistentData.getCompound("eventSettings");
    const timer = eventSettings.getInt("timer") ?? 0;
    eventSettings.timer = timer + 1;

    if ((timer + 1) > eventSettings.getInt("timerDelay")) {
        eventSystem(event);
        eventSettings.timer = 0;
    }
});


function eventSystem(event, forceEvent) {

    forceEvent = forceEvent ?? false;
    const { server } = event;
    const { Statistics, eventSettings } = server.persistentData;
    var debug = eventSettings.contains("debug") ? eventSettings.getBoolean("debug") : false;

    let startTime = Date.now();
    if (debug) console.log("Event System Started at " + Date(startTime).toString());
    let maxAttempts = eventSettings.maxAttempts ?? 50;
    let timeCooldown = eventSettings.timeCooldown ?? 10000;
    let disabledEvents = [];
    if (debug) console.log("Events Triggered");
    Statistics.totalEvents = Statistics.totalEvents ? Statistics.totalEvents.getAsInt() + 1 : 1;

    //Check if the player is valid for the event
    let chosenPlayer = checks.player.getRandomPlayer(server.players);
    if( !chosenPlayer ) return;
    if(!forceEvent){
        if( checks.player.isCreativeOrSpectator(chosenPlayer) ) return;
        if( !checks.player.isAlive(chosenPlayer) ) return;
        if( !checks.player.hasTimer(chosenPlayer) ) return;
        if( checks.player.isOnCooldown(chosenPlayer, timeCooldown) ) return;
        disabledEvents = checks.player.getDisabledEvents(chosenPlayer);
    }

    let filteredEvents = checks.event.filterEvents(ftbEvents, disabledEvents);
    if(!filteredEvents) return;
    var chosenEvent = checks.event.getRandomEvent(filteredEvents);
    if (!chosenEvent) return;

    //Check for required biomes
    if(!checks.event.inBiome(chosenEvent, chosenPlayer)) return;

    //40% chance of no event for the player this time.
    let chance = checks.event.rollChance(chosenEvent.chance);
    if( !forceEvent && !chance ) {
        Statistics.failure['Fail Chance'] = Statistics.failure['Fail Chance'] ? Statistics.failure['Fail Chance'].getAsInt() + 1 : 1;

        if (debug) {
            console.log("Event " + chosenEvent.name + " did not trigger for player " + chosenPlayer.username);
            chosenPlayer.persistentData.timer = timeCooldown / server.players.length; //try again but faster if more players are online
        }
        return; //No event for the player this time
    }

    let locationInfo = null;
    if(chosenEvent.size >= 0) {
        locationInfo = checks.event.findSpawnLocation(chosenEvent, chosenPlayer, maxAttempts);
        if(!locationInfo) return; //No valid spawn location found
    }

    chosenEvent.execute(event, chosenPlayer, locationInfo);
    chosenPlayer.persistentData.timer = 0; //reset the timer for the player
    let endTime = Date.now();
    if (debug) {
        console.log("Event " + chosenEvent.name + " triggered for player " + chosenPlayer.username + " in " + (endTime - startTime) + "ms");
    }
    Statistics.success[chosenEvent.name] = Statistics.success[chosenEvent.name] ? Statistics.success[chosenEvent.name].getAsInt() + 1 : 1;
}
