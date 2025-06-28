// priority: 998

ServerEvents.commandRegistry((event) => {
    const { commands: Commands, arguments: Arguments, builtinSuggestions: Suggestions } = event;

    event.register(
        Commands.literal("ftblibrary")
            .requires(src => src.hasPermission(3))
            .then(Commands.literal("TESTING")
                .then(Commands.literal("true").executes((context) => {
                    global.TESTING.value = true;
                    let player = context.getSource().getPlayerOrException();
                    if (player) message(player, "Testing Mode on");
                    return 1;
                })
                )
                .then(
                    Commands.literal("false").executes((context) => {
                        global.TESTING.value = false;
                        let player = context.getSource().getPlayerOrException();
                        if (player) message(player, "Testing Mode Off");
                        return 1;
                    })
                )
            )
    )
    event.register(
        Commands.literal("puffish_skills")
            .requires(src => src.hasPermission(3))
            .then(Commands.literal("modifiers")
                .then(Commands.literal("ars")
                    .then(Commands.literal("set")
                    .then(Commands.argument("value", Arguments.FLOAT.create(event))
                    .executes((context) => {
                        if(!global.TESTING.value){
                            let player = context.getSource().getPlayerOrException();
                            if(player) error(player, "Testing mode is off, cannot change value");
                            return 0;
                        }
                        global.modifier.ars = Arguments.FLOAT.getResult(context, "value");
                        let player = context.getSource().getPlayerOrException();
                        if (player) message(player, `Ars Nouveau modifier (not persistent) changed to ${global.modifier.ars}`);
                        return 1;
                    })
                ))
                    .then(Commands.literal("get")
                        .executes((context) => {
                            let player = context.getSource().getPlayerOrException();
                            if (player) message(player, `Ars Nouveau modifier is currently set to ${global.modifier.ars}`);
                            return 1;
                        })
                    )
                )
                .then(Commands.literal("ironspell")
                    .then(Commands.literal("set")
                        .then(Commands.argument("value", Arguments.FLOAT.create(event))
                            .executes((context) => {
                                if(!global.TESTING.value){
                                    let player = context.getSource().getPlayerOrException();
                                    if(player) error(player, "Testing mode is off, cannot change value");
                                    return 0;
                                }
                                global.modifier.ironspell = Arguments.FLOAT.getResult(context, "value");
                                let player = context.getSource().getPlayerOrException();
                                if (player) message(player, `Ironspell modifier (not persistent) changed to ${global.modifier.ironspell}`);
                                return 1;
                            })
                        )
                    )
                    .then(Commands.literal("get")
                        .executes((context) => {
                            let player = context.getSource().getPlayerOrException();
                            if (player) message(player, `Ironspell modifier is currently set to ${global.modifier.ironspell}`);
                            return 1;
                        })
                    )
                )

            )
    )

})
