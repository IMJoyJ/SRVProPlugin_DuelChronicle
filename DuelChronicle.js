ygopro.ctos_follow_after("UPDATE_DECK", true, (buffer, info, client, server, datas) => {
    var room = ROOM_all[client.rid];
    if (!room) {
        return null;
    }
    if (room.duel_stage != ygopro.constants.DUEL_STAGE.BEGIN) {
        return null;
    }
    if (client.is_local) {
        return null;
    }
    var room_parameters = room.name.split('#', 2)[0].split(/[,£¬]/);
    var found = false;
    for (var parameter of room_parameters) {
        if (parameter.toUpperCase() == "DC") {
            found = true;
            break;
        }
    }
    if (!found) {
        return null;
    }

    var buff_main_new = [];
    var buff_side_new = [];

    var sql = "SELECT * FROM RandomDecks ORDER BY RAND() LIMIT 1;"
    var result = global.mysqldb_sync.query(sql);
    if (result == null || result.length == 0) {
        return null;
    }
    var cards = result[0].content.split(/[\r\n\t ]+/);
    var side = false;
    for (var i = 0; i < cards.length; i++) {
        var code = parseInt(cards[i].trim());
        if (!isNaN(code)) { 
            if (!side)
                buff_main_new.push(code);
            else
                buff_side_new.push(code);
        }
        else if (cards[i].substring(0, 5) == "!side") {
            side = true;
        }
    }
    client.main = buff_main_new;
    client.side = buff_side_new;

    var compat_deckbuf = buff_main_new.concat(buff_side_new); 
    while (compat_deckbuf.length < 90) {
        compat_deckbuf.push(0);
    }

    ygopro.ctos_send(server, "UPDATE_DECK", {
        mainc: client.main.length,
        sidec: client.side.length,
        deckbuf: compat_deckbuf
    });
    return true;
});

ygopro.stoc_follow_after("CHANGE_SIDE", true, (buffer, info, client, server, datas) => {
    var room = ROOM_all[client.rid];
    if (!room) {
        return false;
    }
    ygopro.ctos_send(server, "UPDATE_DECK", {
        mainc: client.main.length,
        sidec: client.side.length,
        deckbuf: client.main.concat(client.side)
    });
    if (client.side_interval) {
        clearInterval(client.side_interval);
    }
    return true;
});