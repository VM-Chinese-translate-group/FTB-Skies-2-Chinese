MIMachineEvents.registerCasings(event => {
    event.registerBlockImitation('bricks_casing', 'immersiveengineering:cokebrick')
})

// MIRegistrationEvents.registerCableTiers(event => {
//     event.register(
//         'bricked',
//         'Bricked',
//         'Bricked',
//         262144,
//         'bricks_casing',
//     );
// })

MIMachineEvents.registerHatches(event => {
    // event.energy('bricked')

    event.fluid(
        'Bricked',
        'bricked',
        'bricks_casing',
        4096
    )

    event.item(
        'Bricked',
        'bricked',
        'bricks_casing',
        3, 5,
        8, 17
    )
})