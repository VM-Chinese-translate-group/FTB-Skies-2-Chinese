// priority: 998

NativeEvents.onEvent("com.hollingsworth.arsnouveau.api.event.SpellCastEvent", event => {
    global.arsCast(event)
})
NativeEvents.onEvent("io.redspace.ironsspellbooks.api.events.SpellOnCastEvent", event => {
    global.ironSpellCast(event)
})
const $SkillsMod = Java.loadClass("net.puffish.skillsmod.SkillsMod").getInstance()

global.modifier = {
    ironspell: 0.5,
    ars: 0.1
}

global.TESTING = { value: false }

global.arsCast = (event) => {
    try {
        addExp(event.entity, event.spell.getCost() * global.modifier.ars)
    } catch (err) {
        console.error(`error in arsCast: ${err}`)
        if (global.TESTING.value) error(event.entity, `Error in arsCast: ${err}`)
    }
}
global.ironSpellCast = (event) => {
    try {
        let spellLevel = event.getSpellLevel();
        addExp(event.entity, event.getManaCost() * global.modifier.ironspell * Math.min(spellLevel / 2, 1))
    } catch (err) {
        console.error(`Error in ironSpellCast: ${err}`)
        if (global.TESTING.value) error(event.entity, `Error in ironSpellCast: ${err}`)
    }
}

const addExp = (entity, amount) => {
    $SkillsMod.addExperience(entity, "puffish_skills:magic", Math.floor(amount))
    if (global.TESTING.value) success(entity, `Added ${Math.floor(amount)} exp to magic`)
}
const success = (player, message) => {
    player.sendSystemMessage({ text: "✔ " + message, color: "green" }, true);
};
const error = (player, message) => {
    player.sendSystemMessage({ text: "⚠ " + message, color: "red" }, true);
}
const message = (player, message) => {
    player.sendSystemMessage({ text: message, color: "white" }, true);
}