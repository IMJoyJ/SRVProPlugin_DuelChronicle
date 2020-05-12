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
    var deckindex = global.dc_decks_index;
    global.dc_decks_index++;
    
    if (global.dc_decks_index == global.dc_decks_index_max) {
        global.dc_decks_index = 0;
    }
    
    client.main = global.dc_decks_main[deckindex];
    client.side = global.dc_decks_side[deckindex];
    var compat_deckbuf =  client.main.concat(client.side);
    client.deckMd5 = global.dc_decks_md5[deckindex];

    ygopro.ctos_send(server, "UPDATE_DECK", {
        mainc: client.main.length,
        sidec: client.side.length,
        deckbuf: compat_deckbuf
    });

    var sql = "SELECT * FROM RandomDecks AS t1 JOIN (SELECT ROUND(RAND() * (SELECT MAX(id) FROM RandomDecks)) AS id) AS t2 WHERE t1.id >= t2.id ORDER BY t1.id LIMIT 1;"
    
    global.mysqldb.query(sql, null, function(err, result) {
        if (err) {
          log.info(err);
          return;
        }
        if (result == null || result.length == 0) {
            return null;
        }
        var buff_main = [];
        var buff_side = [];
        var cards = result[0].content.split(/[\r\n\t ]+/);
        var side = false;
        var valid = false;
        for (var i = 0; i < cards.length; i++) {
            var code = parseInt(cards[i].trim());
            if (!isNaN(code)) { 
                if (!side) {
                    buff_main.push(code);
	                valid = true;
                }
                else {
                    buff_side.push(code);
                }
            }
            else if (cards[i].substring(0, 5) == "!side") {
                side = true;
            }
        }
        if (valid) {
            dc_decks_main[deckindex] = buff_main;
            dc_decks_side[deckindex] = buff_side;
            dc_decks_md5[deckindex] = result.md5;
        }
    });
    return true;
});

ygopro.ctos_follow_before('CHAT', true, function(buffer, info, client, server, datas) {
    room = ROOM_all[client.rid];
    if (!room) {
        return;
    }
    if (!client.deckMd5) {
	    return;
    }
    var md5 = client.deckMd5;
    if (room.duel_stage != ygopro.constants.DUEL_STAGE.DUELING) {
	    return;
    }
    var msg = _.trim(info.msg);
    if (msg.substring(0, 7) != "/report") {
	    return;
    }
    msg = msg.substring(7);
    msg = _.trim(msg);
    if (msg.length < 2) {
	    ygopro.stoc_send_chat(client, "请以【/report 举报原因】的格式写明举报原因", ygopro.constants.COLORS.YELLOW);
	    return;
    }
    //"CREATE TABLE DCReportServer(reporterIp varchar(255),reportDate DateTime)";
    var sql = "SELECT * FROM `DCReportServer` WHERE reporterIp=? AND reportDate > date_sub(now(), interval 1024 minute)";
    sqlParams = [client.ip];
    mysqldb.query(sql, sqlParams, function(err, result) {
        if (err) {
            log.info(err);
            ygopro.stoc_send_chat(client, "服务器出现异常，请重试", ygopro.constants.COLORS.RED);
            return;
        }
        if (result.length > 0) {
            ygopro.stoc_send_chat(client, "服务器端的举报在1024分钟内只能进行一次，请稍后再试", ygopro.constants.COLORS.YELLOW);
            return;
        }
        sql = "INSERT INTO `DCReportServer` VALUES(?,now())";
        sqlParams = [client.ip];
        mysqldb.query(sql, sqlParams, function(err, result) {
            if (err) {
                log.info(err);
                ygopro.stoc_send_chat(client, "出现异常，请重试", ygopro.constants.COLORS.RED);
                return;
            }
			sql = "SELECT * FROM DCDeckNoChangeList WHERE deckMd5=?";
            sqlParams = [md5];
            mysqldb.query(sql, sqlParams, function(err, result) {
                if (err) {
                    log.info(err);
                    ygopro.stoc_send_chat(client, "例外库无法检索卡组，提交失败", ygopro.constants.COLORS.RED);
                    return;
                }
                if (result.length > 0) {
                    ygopro.stoc_send_chat(client, "此卡组已被判定为无需修改，提交失败", ygopro.constants.COLORS.RED);
                    return;
                }
                msg = (new Date().toString()) + " - 由服务器端提交\r\n\r\n" + msg;
				sql = "INSERT INTO DCReport VALUES(?,?,?)";
                sqlParams = [md5, client.ip, msg];
                mysqldb.query(sql, sqlParams, function(err, result) {
                    if (err) {
                        log.info(err);
                        ygopro.stoc_send_chat(client, "提交失败", ygopro.constants.COLORS.RED);
                        return;
                    }
                    ygopro.stoc_send_chat(client, "提交成功，感谢您的举报。\n举报ID为"+md5+"，可用编年史客户端查看并修改。", ygopro.constants.COLORS.YELLOW);
                });
            });
        });
    });
    return true;
});

ygopro.stoc_follow_after("CHANGE_SIDE", true, (buffer, info, client, server, datas) => {
    var room = ROOM_all[client.rid];
    if (!room) {
        return false;
    }
     
    if (client.is_local) {
        return null;
    }
    var deckindex = global.dc_decks_index;
    global.dc_decks_index++;
    
    if (global.dc_decks_index == global.dc_decks_index_max) {
        global.dc_decks_index = 0;
    }
    
    client.main = global.dc_decks_main[deckindex];
    client.side = global.dc_decks_side[deckindex];
    var compat_deckbuf =  client.main.concat(client.side);
    client.deckMd5 = global.dc_decks_md5[deckindex];

    ygopro.ctos_send(server, "UPDATE_DECK", {
        mainc: client.main.length,
        sidec: client.side.length,
        deckbuf: compat_deckbuf
    });

    var sql = "SELECT * FROM RandomDecks AS t1 JOIN (SELECT ROUND(RAND() * (SELECT MAX(id) FROM RandomDecks)) AS id) AS t2 WHERE t1.id >= t2.id ORDER BY t1.id LIMIT 1;"
    
    global.mysqldb.query(sql, null, function(err, result) {
        if (err) {
          log.info(err);
          return;
        }
        if (result == null || result.length == 0) {
            return null;
        }
        var buff_main = [];
        var buff_side = [];
        var cards = result[0].content.split(/[\r\n\t ]+/);
        var side = false;
        var valid = false;
        for (var i = 0; i < cards.length; i++) {
            var code = parseInt(cards[i].trim());
            if (!isNaN(code)) { 
                if (!side) {
                    buff_main.push(code);
	                valid = true;
                }
                else {
                    buff_side.push(code);
                }
            }
            else if (cards[i].substring(0, 5) == "!side") {
                side = true;
            }
        }
        if (valid) {
            dc_decks_main[deckindex] = buff_main;
            dc_decks_side[deckindex] = buff_side;
            dc_decks_md5[deckindex] = result.md5;
        }
    });
    return true;
});