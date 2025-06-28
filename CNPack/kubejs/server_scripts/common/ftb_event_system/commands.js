
const setupCommand = (e, ctx) => {
  var source = ctx.getSource();
  if (!source) console.log("invalid source");

  var player = source.getPlayerOrException();

  if (!player) console.log("invalid player");

  if (!player.persistentData) console.log("invalid persistent data");

  var pData = player.persistentData;
  var disabledEvents = pData.disabledEvents;
  console.log(pData.disabledEvents);
  if (e.disableStage && !player.stages.has(e.disableStage)) {
    source.sendSuccess(Text.of(["You have not unlocked disabling this event yet!"]).red(), false);
    return 0;
  }
  if (disabledEvents) {
    let disabledEventsList = [];
    for (let i = 0; i < disabledEvents.length; i++) {
      disabledEventsList.push(disabledEvents[i].getAsString());
    }

    if (disabledEventsList.includes(e.name.toString())) {
      pData.disabledEvents = disabledEventsList.filter((item) => item !== e.name);
      source.sendSuccess(Text.of(["Toggled " + e.displayName + " Event on"]).green(), false);
      return 1;
    } else {
      pData.disabledEvents.push(e.name);
      source.sendSuccess(Text.of(["Toggled " + e.displayName + " Event off"]).green(), false);
      return 1;
    }
  } else {
    pData.disabledEvents = [e.name];
    source.sendSuccess(Text.of(["Toggled " + e.displayName + " Event off"]).green(), false);
    return 1;
  }
}

const getSuggestionsForEvent = (eventObj) => {
    return (ctx, builder) => {
            const eventSuggestions = eventObj.commandSuggestions || [];
            const suggestions = [];
            eventSuggestions.forEach(suggestion => {
                suggestions.push(JSON.stringify(suggestion));
            });

            if (suggestions.length != 0) {
                suggestions.forEach(suggestion => {
                  builder.suggest(suggestion);
              });
            }
            return builder.buildFuture();
        }
}

const registerForceSubcommands = (event, eventOrString) => {
  const { commands: Commands, arguments: Arguments, builtinSuggestions: Suggestions } = event;
  let name, eventObj;

  if (typeof eventOrString === "string") {
    name = eventOrString;
    eventObj = null;
  } else {
    name = eventOrString.name;
    eventObj = eventOrString;
  }

  return Commands.literal(name)
    .executes(function (ctx) { return executeEvent(ctx, null, eventObj, null); })
    .then(Commands.argument('target', Arguments.PLAYER.create(event))
      .executes(function (ctx) { return executeEvent(ctx, Arguments.PLAYER.getResult(ctx, "target"), eventObj, null); })

      .then(Commands.argument("viewername", Arguments.STRING.create(event))
        .executes(function (ctx) { return executeEvent(ctx, Arguments.PLAYER.getResult(ctx, "target"), eventObj, Arguments.STRING.getResult(ctx, 'viewername')); })

        .then(Commands.argument("options", Arguments.NBT_TAG.create(event))
            .suggests(getSuggestionsForEvent(eventObj))
            .executes(function (ctx) { return executeEvent(ctx, Arguments.PLAYER.getResult(ctx, "target"), eventObj, Arguments.STRING.getResult(ctx, 'viewername'), Arguments.NBT_TAG.getResult(ctx, "options")); })
        )
      )
      .then(Commands.argument("options", Arguments.NBT_TAG.create(event))
        .suggests(getSuggestionsForEvent(eventObj))
        .executes(function (ctx) { return executeEvent(ctx, Arguments.PLAYER.getResult(ctx, "target"), eventObj, null, Arguments.NBT_TAG.getResult(ctx, "options")); })
      )
    );
}

const executeEvent = (ctx, target, event, viewerName, options) => {

  
    var source = ctx.getSource();
    if (!source) console.log("invalid source");
    target = target ?? source.getPlayerOrException();
    let Statistics = target.level.server.persistentData.Statistics;
    Statistics.totalEvents = Statistics.totalEvents ? Statistics.totalEvents.getAsInt() + 1 : 1;

    let chosenEvent = event ?? checks.event.getRandomEvent(ftbEvents);
    let locationInfo = null;
    if (chosenEvent.size >= 0) {
      locationInfo = checks.event.findSpawnLocation(chosenEvent, target, 500);
      if(!locationInfo) {
        source.sendSuccess(Text.of(["Spawn not found for " + chosenEvent.displayName + " Event"]).red(), false);
        return 0; 
      }
    }
    options = options ?? {};
    chosenEvent.execute(ctx, target, locationInfo, viewerName, options);
    source.sendSuccess(Text.of(["Forced " + chosenEvent.displayName + " Event for " + target.username]).green(), false);
    Statistics.success[chosenEvent.name] = Statistics.success[chosenEvent.name] ? Statistics.success[chosenEvent.name].getAsInt() + 1 : 1;

    return 1;
}


ServerEvents.commandRegistry((event) => {
  const { commands: Commands, arguments: Arguments, builtinSuggestions: Suggestions } = event;
  const EventSettingsArgs = {
    'timer': Arguments.INTEGER,
    'timerDelay': Arguments.INTEGER,
    'debug': Arguments.BOOLEAN,
    'maxAttempts': Arguments.INTEGER,
    'timeCooldown': Arguments.INTEGER,
  }

    event.register(Commands.literal("events")
        .then(Commands.literal('force').requires(src => src.hasPermission(3))
            .then(registerForceSubcommands(event, "ftb:random"))
        )
        .then(Commands.literal("settings").requires(src => src.hasPermission(3))
            .then(Commands.literal("list")
              .executes(function (ctx) {
                const source = ctx.getSource();
                let player = source.getPlayerOrException();
                let server = source.getServer();
                let sPData = server.getPersistentData();
                let eventSettings = sPData.eventSettings;
                let text = [];
                Object.keys(eventSettings).forEach(function (key) {
                  text.push(key + ": " + eventSettings[key]);
                })
                source.sendSuccess(Text.of([text.join("\n")]), false);
                return 1;
              })
            )
        )
        .then(Commands.literal("statistics")
          .requires(src => src.hasPermission(3))
          .executes(function (ctx) {

            const source = ctx.getSource();
            let statistics = ctx.source.getServer().getPersistentData().Statistics;

            if (!statistics) {
              source.sendSuccess(Text.of(["No statistics found!"]).red(), false);
              return 0;
            }

            let text = []
            text.push("Total Events Triggered: " + statistics.totalEvents.getAsInt());
            text.push("==============================")
            Object.keys(statistics.failure).forEach(function (key) {
              text.push("Total " + key + " Events Failed: " + statistics.failure[key].getAsInt());
            })
            text.push("==============================")
            Object.keys(statistics.success).forEach(function (key) {
              let event = ftbEvents.find(e => e.name == key)
              text.push("Total " + event.displayName + " Events Succeeded: " + statistics.success[key].getAsInt());
            })
            source.sendSuccess(Text.of([text.join("\n")]), false);
            return 1;
          })
          .then(Commands.literal("reset")
            .requires(src => src.hasPermission(3))
            .executes(function (ctx) {
              const source = ctx.getSource();
              let statistics = ctx.source.getServer().getPersistentData().Statistics;
              if (!statistics) {
                source.sendSuccess(Text.of(["No statistics found!"]).red(), false);
                return 0;
              }
              statistics.totalEvents = 0;
              statistics.failure = {};
              statistics.success = {};
              source.sendSuccess(Text.of(["Statistics reset"]).green(), false);
              return 1;
            })
        )
        )
    )

  // Registering the main Event commands
  ftbEvents.forEach(ftbEvent => {
    event.register(
      Commands.literal("events")
        .then(Commands.literal("toggle")
          .then(Commands.literal(ftbEvent.name)
            .executes(function (ctx) {
              setupCommand(ftbEvent, ctx);
              return 1;
            })
          )
        )

        .then(Commands.literal('force').requires(src => src.hasPermission(3))
          .then(registerForceSubcommands(event, ftbEvent))
        )
    );
  })

  // Event Settings Commands
  Object.keys(EventSettingsArgs).forEach(function (key) {
    event.register(Commands.literal("events")
        .then(Commands.literal("settings")
            .then(Commands.literal("set").requires(src => src.hasPermission(3))
            .then(Commands.literal(key)
                .then(Commands.argument(key, EventSettingsArgs[key].create(event))
                .executes(function (ctx) {
                    const source = ctx.getSource();
                    let server = source.getServer();
                    let sPData = server.getPersistentData();
                    let eventSettings = sPData.eventSettings;
                    let argument = EventSettingsArgs[key].getResult(ctx, key);
                    eventSettings[key] = argument;
                    source.sendSuccess(Text.of([key + " set to " + argument]).green(), false);
                    return 1;
                })
                )
            )
            )
        )
    )
  })

});

