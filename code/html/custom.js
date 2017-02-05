var websock;
var password = false;
var maxNetworks;

var numChanged = 0;
var numReset = 0;
var numReconnect = 0;

// http://www.the-art-of-web.com/javascript/validate-password/
function checkPassword(str) {
    // at least one number, one lowercase and one uppercase letter
    // at least eight characters that are letters, numbers or the underscore
    var re = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])\w{8,}$/;
    return re.test(str);
}

function validateForm() {

    var form = $("#formSave");

    // password
    var adminPass1 = $("input[name='adminPass1']", form).val();
    if (adminPass1.length > 0 && !checkPassword(adminPass1)) {
        alert("The password you have entered is not valid, it must have at least 8 characters, 1 lower and 1 uppercase and 1 number!");
        return false;
    }

    var adminPass2 = $("input[name='adminPass2']", form).val();
    if (adminPass1 != adminPass2) {
        alert("Passwords are different!");
        return false;
    }

    return true;

}

function deferredReload(milliseconds) {
    setTimeout(function(){ window.location = "/"; }, milliseconds);
}

function doUpdate() {
    if (validateForm()) {
        var data = $("#formSave").serializeArray();
        websock.send(JSON.stringify({'config': data}));
        $(".powExpected").val(0);
        $("input[name='powExpectedReset']")
            .prop("checked", false)
            .iphoneStyle("refresh");
        numChanged = 0;
        setTimeout(function() {
            if (numReset > 0) {
                var response = window.confirm("You have to reset the board for the changes to take effect, do you want to do it now?");
                if (response == true) doReset(false);
            } else if (numReconnect > 0) {
                var response = window.confirm("You have to reset the wifi connection for the changes to take effect, do you want to do it now?");
                if (response == true) doReconnect(false);
            }
            numReset = numReconnect = 0;
        }, 1000);
    }
    return false;
}

function doReset(ask = true) {
    if (numChanged > 0) {
        var response = window.confirm("Some changes have not been saved yet, do you want to save them first?");
        if (response == true) return doUpdate();
    }
    if (ask) {
        var response = window.confirm("Are you sure you want to reset the device?");
        if (response == false) return false;
    }
    websock.send(JSON.stringify({'action': 'reset'}));
    deferredReload(5000);
    return false;
}

function doReconnect(ask = true) {
    if (numChanged > 0) {
        var response = window.confirm("Some changes have not been saved yet, do you want to save them first?");
        if (response == true) return doUpdate();
    }
    if (ask) {
        var response = window.confirm("Are you sure you want to disconnect from the current WIFI network?");
        if (response == false) return false;
    }
    websock.send(JSON.stringify({'action': 'reconnect'}));
    deferredReload(5000);
    return false;
}

function doToggle(element, value) {
    var relayID = parseInt(element.attr("data"));
    websock.send(JSON.stringify({'action': value ? 'on' : 'off', 'relayID': relayID}));
    return false;
}

function randomString(length, chars) {
    var mask = '';
    if (chars.indexOf('a') > -1) mask += 'abcdefghijklmnopqrstuvwxyz';
    if (chars.indexOf('A') > -1) mask += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (chars.indexOf('#') > -1) mask += '0123456789';
    if (chars.indexOf('@') > -1) mask += 'ABCDEF';
    if (chars.indexOf('!') > -1) mask += '~`!@#$%^&*()_+-={}[]:";\'<>?,./|\\';
    var result = '';
    for (var i = length; i > 0; --i) result += mask[Math.round(Math.random() * (mask.length - 1))];
    return result;
}

function doGenerateAPIKey() {
    var apikey = randomString(16, '@#');
    $("input[name=\"apiKey\"]").val(apikey);
    return false;
}

function showPanel() {
    $(".panel").hide();
    $("#" + $(this).attr("data")).show();
    if ($("#layout").hasClass('active')) toggleMenu();
    $("input[type='checkbox']").iphoneStyle("calculateDimensions").iphoneStyle("refresh");
};

function toggleMenu() {
    $("#layout").toggleClass('active');
    $("#menu").toggleClass('active');
    $("#menuLink").toggleClass('active');
}

function createRelays(count) {

    var current = $("#relays > div").length;
    if (current > 0) return;

    var template = $("#relayTemplate .pure-g")[0];
    for (var relayID=0; relayID<count; relayID++) {
        var line = $(template).clone();
        $(line).find("input").each(function() {
            $(this).attr("data", relayID);
        });
        if (count > 1) $(".relay_id", line).html(" " + (relayID+1));
        line.appendTo("#relays");
        $(":checkbox", line).iphoneStyle({
            onChange: doToggle,
            resizeContainer: true,
            resizeHandle: true,
            checkedLabel: 'ON',
            uncheckedLabel: 'OFF'
        });

    }

}

function createIdxs(count) {

    var current = $("#idxs > div").length;
    if (current > 0) return;

    var template = $("#idxTemplate .pure-g")[0];
    for (var id=0; id<count; id++) {
        var line = $(template).clone();
        $(line).find("input").each(function() {
            $(this).attr("data", id).attr("tabindex", 40+id).attr("original", "");
        });
        if (count > 1) $(".id", line).html(" " + id);
        line.appendTo("#idxs");
    }

}

function delNetwork() {
    var parent = $(this).parents(".pure-g");
    $(parent).remove();
}

function moreNetwork() {
    var parent = $(this).parents(".pure-g");
    $("div.more", parent).toggle();
}

function addNetwork() {

    var numNetworks = $("#networks > div").length;
    if (numNetworks >= maxNetworks) {
        alert("Max number of networks reached");
        return;
    }

    var tabindex = 200 + numNetworks * 10;
    var template = $("#networkTemplate").children();
    var line = $(template).clone();
    $(line).find("input").each(function() {
        $(this).attr("tabindex", tabindex++).attr("original", "");
    });
    $(line).find(".button-del-network").on('click', delNetwork);
    $(line).find(".button-more-network").on('click', moreNetwork);
    line.appendTo("#networks");

    return line;

}

function processData(data) {

    // title
    if ("app" in data) {
        var title = data.app;
		if ("version" in data) {
			title = title + " " + data.version;
		}
        $(".pure-menu-heading").html(title);
        if ("hostname" in data) {
            title = data.hostname + " - " + title;
        }
        document.title = title;
    }

    Object.keys(data).forEach(function(key) {

        // Actions
        if (key == "action") {

            if (data.action == "reload") {
                if (password) {

                    // Forget current authentication
                    $.ajax({
                        'method': 'GET',
                        'url': '/',
                        'async': false,
                        'username': "logmeout",
                        'password': "123456",
                        'headers': { "Authorization": "Basic xxx" }
                    }).done(function(data) {
                	    // If we don't get an error, we actually got an error as we expect an 401!
                	}).fail(function(){
                	    // We expect to get an 401 Unauthorized error! In this case we are successfully
                        // logged out and we redirect the user.
                	    window.location = "/";
                    });

                } else {
                    window.location = "/";
                }
            }

            return;

        }

        if (key == "maxNetworks") {
            maxNetworks = parseInt(data.maxNetworks);
            return;
        }

        // Boards
        if (key == "boards") {

            // Empty dropdown
            var element = $("select[name='board']");
            element.empty();

            // Add boards to dropdown
            for (var i in data.boards) {
                $("<option />", {
                    val: parseInt(i) + 2,
                    original: parseInt(i) + 2,
                    text: data.boards[i]
                }).appendTo(element);
            }

            return;

        }

        // Wifi
        if (key == "wifi") {

            var networks = data.wifi;

            for (var i in networks) {

                // add a new row
                var line = addNetwork();

                // fill in the blanks
                var wifi = data.wifi[i];
                Object.keys(wifi).forEach(function(key) {
                    var element = $("input[name=" + key + "]", line);
                    if (element.length) element.val(wifi[key]).attr("original", wifi[key]);
                });

            }

            return;

        }

        // Relay status
        if (key == "relayStatus") {

            var relays = data.relayStatus;
            createRelays(relays.length);

            for (var relayID in relays) {
                var element = $(".relayStatus[data=" + relayID + "]");
                if (element.length > 0) {
                    element
                        .prop("checked", relays[relayID])
                        .iphoneStyle("refresh");
                }
            }

            return;

        }

        // Domoticz
        if (key == "dczRelayIdx") {
            var idxs = data.dczRelayIdx;
            createIdxs(idxs.length);

            for (var i in idxs) {
                var element = $(".dczRelayIdx[data=" + i + "]");
                if (element.length > 0) element.val(idxs[i]).attr("original", idxs[i]);
            }

            return;
        }


        // Messages
        if (key == "message") {
            window.alert(data.message);
            return;
        }

        // Enable options
        if (key.endsWith("Visible")) {
            var module = key.slice(0,-7);
            $(".module-" + module).show();
            return;
        }

        // Pre-process
        if (key == "network") {
            data.network = data.network.toUpperCase();
        }
        if (key == "mqttStatus") {
            data.mqttStatus = data.mqttStatus ? "CONNECTED" : "NOT CONNECTED";
        }

        // Look for INPUTs
        var element = $("input[name=" + key + "]");
        if (element.length > 0) {
            if (element.attr('type') == 'checkbox') {
                element
                    .prop("checked", data[key])
                    .attr("original", data[key])
                    .iphoneStyle("refresh");
            } else {
                element.val(data[key]).attr("original", data[key]);
            }
            return;
        }

        // Look for SELECTs
        var element = $("select[name=" + key + "]");
        if (element.length > 0) {
            element.val(data[key]).attr("original", data[key]);
            return;
        }

    });

    // Auto generate an APIKey if none defined yet
    if ($("input[name='apiKey']").val() == "") {
        doGenerateAPIKey();
    }

}

function getJson(str) {
    try {
        return JSON.parse(str);
    } catch (e) {
        return false;
    }
}

function initWebSocket(host) {
    if (host === undefined) {
        host = window.location.hostname;
    }
    websock = new WebSocket('ws://' + host + '/ws');
    websock.onopen = function(evt) {};
    websock.onclose = function(evt) {};
    websock.onerror = function(evt) {};
    websock.onmessage = function(evt) {
        var data = getJson(evt.data);
        if (data) processData(data);
    };
}

function hasChanged() {

    var newValue, originalValue;
    if ($(this).attr('type') == 'checkbox') {
        newValue = $(this).prop("checked")
        originalValue = $(this).attr("original") == "true";
    } else {
        newValue = $(this).val();
        originalValue = $(this).attr("original");
    }
    var hasChanged = $(this).attr("hasChanged") || 0;
    var action = $(this).attr("action");

    if (typeof originalValue == 'undefined') return;
    if (action == "none") return;

    if (newValue != originalValue) {
        if (hasChanged == 0) {
            ++numChanged;
            if (action == "reconnect") ++numReconnect;
            if (action == "reset") ++numReset;
            $(this).attr("hasChanged", 1);
        }
    } else {
        if (hasChanged == 1) {
            --numChanged;
            if (action == "reconnect") --numReconnect;
            if (action == "reset") --numReset;
            $(this).attr("hasChanged", 0);
        }
    }

}

function init() {

    $("#menuLink").on('click', toggleMenu);
    $(".button-update").on('click', doUpdate);
    $(".button-reset").on('click', doReset);
    $(".button-reconnect").on('click', doReconnect);
    $(".button-apikey").on('click', doGenerateAPIKey);
    $(".pure-menu-link").on('click', showPanel);
    $(".button-add-network").on('click', addNetwork);
    $(document).on('change', 'input', hasChanged);
    $(document).on('change', 'select', hasChanged);

    $.ajax({
        'method': 'GET',
        'url': '/auth'
    }).done(function(data) {
        initWebSocket();
    });

}

$(init);
