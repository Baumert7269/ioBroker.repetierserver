/**
 *
 * pimatic adapter Copyright 2017, bluefox <dogafox@gmail.com>
 *
 */

/* jshint -W097 */
/* jshint strict:false */
/* jslint node: true */
'use strict';

// you have to require the utils module and call adapter function
var utils = require('@iobroker/adapter-core'); // Get common adapter utils
var request = require('request');
var adapter = utils.Adapter('pimatic');
var io      = require('socket.io-client');
var client;
var objects = {};
var states  = [];
var connected = false;
var url;
var getUrl;
var credentials;

// ******************************
// Definitionen und Vorbelegungen
// ******************************

const utils = require('@iobroker/adapter-core'); // Get common adapter utils
const request = require('request');

const adapter = new utils.Adapter('repetierserver');

// Rückmeldungen
const rGcodeUnbekannt = 'unbekannter G-Code' ;

// Adapterparameter
let repetierIP = '' ;
let repetierPort = '' ;
let repetierApi = '' ;

// Datenübergabevariablen
let printerwert ;
let printerdatenpfad = '' ;

// Allgemeine Hilfsvariablen
let i = 0 ;

// Hilfsvariablen für Zeitrechnungen
let tStd = '' ; 
let tMin = '' ;
let tRStd = '';
let tRMin = '';

// interne Druckerübersicht
const aprinter = new Array;
let printercnt ;
let printername = '' ;

// Hauptpfade
let printerpath = '' ;
let serverpath = '' ;


// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        if (adapter.setState) adapter.setState('info.connection', false, true);
        if (client) client.disconnect();
        client = null;

        // Alle Zeitgesteuerten Aufrufe löschen
        clearInterval(refreshServer);
        clearInterval(refreshPrinterActive);
        clearInterval(refreshState);
        clearInterval(refreshPrintJob);
        clearInterval(serverUpdate);

        adapter.log.info('Repetier-Server Verbindungsaufbau gestoppt');
        adapter.log.info('Repetier-Server Service gestoppt');
        adapter.log.info('Repetier-Server bereinigt...');
        callback();
    } catch (e) {
        callback();
    }
});


// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    if (state && !state.ack) {
        if (objects[id]) {
            if (objects[id].common.write && objects[id].native.control && objects[id].native.control.action) {
                states[id] = state.val;
                if (!connected) {
                    adapter.log.warn('Cannot control: no connection to pimatic "' + adapter.config.host + '"');
                } else {
                    /*client.emit('call', {
                        id: id,
                        action: objects[id].native.control.action,
                        params: {
                            deviceId: objects[id].native.control.deviceId,
                            name: objects[id].native.name,
                            type: objects[id].common.type,
                            valueOrExpression: state.val
                        }
                    });*/
                    // convert values
                    if (objects[id].common.type === 'boolean') {
                        state.val = (state.val === true || state.val === 'true' || state.val === '1' || state.val === 1 || state.val === 'on' || state.val === 'ON');
                    } else if (objects[id].common.type === 'number') {
                        if (typeof state.val !== 'number') {
                            if (state.val === true || state.val === 'true' || state.val === 'on' || state.val === 'ON') {
                                state.val = 1;
                            } else if (state.val === false || state.val === 'false' || state.val === 'off' || state.val === 'OFF') {
                                state.val = 0;
                            } else {
                                state.val = parseFloat((state.val || '0').toString().replace(',', '.'));
                            }
                        }
                    }

                    var link = getUrl + 'api/device/' + objects[id].native.control.deviceId + '/' + objects[id].native.control.action + '?' + objects[id].native.name + '=' + state.val;
                    adapter.log.debug('http://' + link);


                    request('http://' + credentials + link, function (err, res, body) {
                        if (err || res.statusCode !== 200) {
                            adapter.log.warn('Cannot write "' + id + '": ' + (body || err || res.statusCode));
                            adapter.setForeignState(id, {val: state.val, ack: true, q: 0x40});
                        } else {
                            try {
                                var data = JSON.parse(body);
                                if (data.success) {
                                    adapter.log.debug(body);
                                    // the value will be updated in deviceAttributeChanged
                                } else {
                                    adapter.log.warn('Cannot write "' + id + '": ' + body);
                                    adapter.setForeignState(id, {val: state.val, ack: true, q: 0x40});
                                }
                            } catch (e) {
                                adapter.log.warn('Cannot write "' + id + '": ' + body);
                                adapter.setForeignState(id, {val: state.val, ack: true, q: 0x40});
                            }
                        }
                    });
                }
            } else {
                adapter.log.warn('State "' + id + '" is read only');
            }
        } else {
            adapter.log.warn('Unknown state "' + id + '"');
        }
    }
});

// Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
adapter.on('message', function (obj) {
    if (typeof obj === 'object' && obj.message) {
        if (obj.command === 'send') {
            // e.g. send email or pushover or whatever
            console.log('send command');

            // Send response in callback if required
            if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
        }
    }
});

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    main();
});

function syncObjects(objs, callback) {
    if (!objs || !objs.length) {
        callback && callback();
        return;
    }
    var obj = objs.shift();
    adapter.getForeignObject(obj._id, function (err, oObj) {
        if (!oObj) {
            objects[obj._id] = obj;
            adapter.setForeignObject(obj._id, obj, function () {
                setTimeout(syncObjects, 0, objs, callback);
            });
        } else {
            var changed = false;
            for (var a in obj.common) {
                if (obj.common.hasOwnProperty(a) && oObj.common[a] !== obj.common[a]) {
                    changed = true;
                    oObj.common[a] = obj.common[a];
                }
            }
            if (JSON.stringify(obj.native) !== JSON.stringify(oObj.native)) {
                changed = true;
                oObj.native = obj.native;
            }
            objects[obj._id] = oObj;
            if (changed) {
                adapter.setForeignObject(oObj._id, oObj, function () {
                    setTimeout(syncObjects, 0, objs, callback);
                });
            } else {
                setTimeout(syncObjects, 0, objs, callback);
            }
        }
    });
}

function syncStates(_states, callback) {
    if (!_states || !_states.length) {
        callback && callback();
        return;
    }
    var state = _states.shift();
    adapter.getForeignState(state._id, function (err, oState) {
        if (!oState) {
            adapter.setForeignState(state._id, state.val, function () {
                setTimeout(syncStates, 0, _states, callback);
            });
        } else {
            var changed = false;
            for (var a in state.val) {
                if (state.val.hasOwnProperty(a) &&
                    (typeof state.val[a] !== 'object' && state.val[a] !== oState[a]) ||
                    (typeof state.val[a] === 'object' && JSON.stringify(state.val[a]) !== JSON.stringify(oState[a]))) {
                    changed = true;
                    oState[a] = state.val[a];
                }
            }
            if (changed) {
                adapter.setForeignState(oState._id, oState, function () {
                    setTimeout(syncStates, 0, _states, callback);
                });
            } else {
                setTimeout(syncStates, 0, _states, callback);
            }
        }
    });
}

function syncDevices(devices, callback) {
    var objs = [];
    var _states = [];
    for (var d = 0; d < devices.length; d++) {
        var localObjects = [];
        var device = devices[d];
        adapter.log.debug('Handle Device: ' + JSON.stringify(device));
        var obj = {
            _id: adapter.namespace + '.devices.' + device.id,
            common: {
                name: device.name
            },
            type: 'channel'
        };
        objs.push(obj);
        var attributes = device.attributes;
        if ((!attributes || !attributes.length) && device.config) attributes = device.config.attributes;

        if (attributes && attributes.length) {
            for (var a = 0; a < attributes.length; a++) {
                var attr = attributes[a];
                adapter.log.debug('Handle Attribute: ' + JSON.stringify(attr));
                var id = adapter.namespace + '.devices.' + device.id + '.' + attr.name.replace(/\s/g, '_');
                obj = {
                    _id: id,
                    common: {
                        name: device.name + ' - ' + (attr.acronym || attr.name),
                        desc: attr.description,
                        type: attr.type,
                        read: true,
                        write: false,
                        unit: attr.unit === 'c' ? '�C' : (attr.unit === 'f' ? '�F' : attr.unit)
                        //role: acronym2role(attr.acronym)
                    },
                    native: {

                    },
                    type: 'state'
                };
                _states.push({
                    _id: id,
                    val: {
                        ack: true,
                        val: attr.value,
                        ts:  attr.lastUpdate
                    }
                });
                states[id] = attr.value;
                delete attr.value;
                delete attr.lastUpdate;
                delete attr.history;
                obj.native = attr;

                if (obj.common.type === 'boolean') {
                    if (device.template === 'presence') obj.common.role = 'state';//'indicator.presence';
                    if (attr.labels && attr.labels[0] !== 'true') {
                        obj.common.states = {false: attr.labels[1], true: attr.labels[0]};
                    }
                } else
                if (obj.common.type === 'number') {
                    if (obj.common.unit === '�C' || obj.common.unit === '�F') {
                        obj.common.role = 'value.temperature';
                    } else if (obj.common.unit === '%') {
                        obj.common.min = 0;
                        obj.common.max = 100;

                        // Detect if temperature exists
                        var found = false;
                        for (var k = 0; k < localObjects.length; k++) {
                            if (localObjects[k].common.unit === '�C' || localObjects[k].common.unit === '�F') {
                                found = true;
                                break;
                            }
                        }
                        if (found) {
                            obj.common.role = 'value.humidity';
                        }
                    }
                    if (attr.name === 'latitude') {
                        obj.common.role = 'value.gps.latitude';
                    } else if (attr.name === 'longitude') {
                        obj.common.role = 'value.gps.longitude';
                    } if (attr.name === 'gps') {
                        obj.common.role = 'value.gps';
                    }
                } else {
                    if (attr.name === 'battery') {
                        obj.common.role = 'indicator.battery';
                        obj.native.mapping = {'ok': false, 'low': true};
                        obj.common.type = 'boolean';
                        obj.common.states = {false: 'ok', true: 'low'};
                        attr.value = (attr.value !== 'ok');
                    }
                }

                if (attr.enum && !obj.common.states) {
                    obj.common.states = {};
                    for (var e = 0; e < attr.enum.length; e++) {
                        if (attr.enum[e] === 'manu') {
                            obj.common.states.manu = 'manual';
                        } else if (attr.enum[e] === 'auto') {
                            obj.common.states.auto = 'automatic';
                        } else{
                            obj.common.states[attr.enum[e]] = attr.enum[e];
                        }
                    }
                }
                objs.push(obj);
                localObjects.push(obj);
            }
        }

        var actions = device.actions;
        if ((!actions || !actions.length) && device.config) actions = device.config.actions;

        if (actions && actions.length) {
            for (var c = 0; c < actions.length; c++) {
                var action = actions[c];

                for (var p in action.params) {
                    if (!action.params.hasOwnProperty(p)) continue;
                    // try to find state for that
                    var _found = false;
                    for (var u = 0; u < localObjects.length; u++) {
                        if (localObjects[u].native.name === p) {
                            _found = true;
                            obj = localObjects[u];
                            obj.native.control = {
                                action: action.name,
                                deviceId: device.id
                            };
                            obj.common.write = true;
                            if (obj.common.role === 'value.temperature') obj.common.role = 'level.temperature';
                        }
                    }

                    if (!_found) {
                        obj = {
                            _id: adapter.namespace + '.devices.' + device.id + '.' + action.name.replace(/\s/g, '_') + '.' + p.replace(/\s/g, '_'),
                            common: {
                                desc: action.params[p].description || action.description,
                                name: device.name + ' - ' + action.name + '.' + p,
                                read: false,
                                write: true,
                                type: action.params[p].type
                            },
                            native: {
                                name: p,
                                control: {
                                    action: action.name,
                                    deviceId: device.id
                                }
                            },
                            type: 'state'
                        };
                        objs.push(obj);
                    }
                }
            }
        }
    }
    var ids = [];
    for (var j = 0; j < objs.length; j++) {
        ids.push(objs[j]._id);
        objects[objs[j]._id] = objs[j];
    }
    syncObjects(objs, function () {
        syncStates(_states, function () {
            callback && callback(ids);
        });
    });
}

function syncGroups(groups, ids, callback) {
    var enums = [];
    var obj = {
        _id: 'enum.pimatic',
        common: {
            members: [],
            name: 'Pimatic groups'
        },
        native: {},
        type: 'enum'

    };

    enums.push(obj);

    for (var g = 0; g < groups.length; g++) {
        obj = {
            _id: 'enum.pimatic.' + groups[g].id,
            type: 'enum',
            common: {
                name: groups[g].name,
                members: []
            },
            native: {}
        };
        for (var m = 0; m < groups[g].devices.length; m++) {
            var id = adapter.namespace + '.devices.' + groups[g].devices[m].replace(/\s/g, '_');
            if (ids.indexOf(id) === -1) {
                // try to find
                var found = false;
                var _id = id.toLowerCase();
                for (var i = 0; i < ids.length; i++) {
                    if (ids[i].toLowerCase() === _id) {
                        id = ids[i];
                        found = true;
                        break;
                    }
                }
                if (found) {
                    obj.common.members.push(id);
                } else {
                    adapter.log.warn('Device "' + groups[g].devices[m] + '" was found in the group "' + groups[g].name + '", but not found in devices');
                }
            } else {
                obj.common.members.push(id);
            }
        }
        enums.push(obj);
    }
    syncObjects(enums, callback);
}

/*
function processResponse(text, type, callback) {
    try {
        var data = JSON.parse(text);
        if (data.success) {
            callback && callback(null, data[type]);
        } else {
            callback && callback(data.error || !data.success);
        }
    } catch (e) {
        adapter.log.error('Cannot parse answer (' + type + ') from pimatic: ' + e);
        callback && callback(e);
    }
}
function getData(type, callback) {
    if (process.env.DEVELOPMENT) {
        processResponse(require('fs').readFileSync(__dirname + '/test/data/' + type + '.json'), type, callback);
    } else {
        request({
            url : 'http://' + encodeURIComponent(adapter.config.username) + ':' + encodeURIComponent(adapter.config.password) + '@' + adapter.config.host + (adapter.config.port ? ':' + adapter.config.port : '') + '/api/' + type
        }, function (err, resp, body) {
            if (body) {
                processResponse(body, type, callback);
            } else {
                adapter.log.error('Cannot read ' + type + ' from "' + adapter.config.host + '": ' + err);
            }
        });
    }
}
function syncAll(callback) {
    getData('devices', function (err, devices) {
        if (err) {
            // try later
            callback && callback(err);
            return;
        }
        syncDevices(devices, function (ids) {
            // redundant information
            //getData('variables', function (err, variables) {
                //if (err) {
                    // try later
                //    callback && callback(err);
                ///    return;
                //}
                getData('groups', function (err, groups) {
                    if (err) {
                        // try later
                        callback && callback(err);
                        ids = null;
                    } else {
                        syncGroups(groups, ids, callback);
                    }
                });
            //});
        });
    });
}*/

function updateConnected(isConnected) {
    if (connected !== isConnected) {
        connected = isConnected;
        adapter.setState('info.connection', connected, true);
        adapter.log.info(isConnected ? 'connected' : 'disconnected');
    }
}

function connect() {
    url = url || 'http://'  + adapter.config.host + (adapter.config.port ? ':' + adapter.config.port : '') + '/?username=' + encodeURIComponent(adapter.config.username) + '&password=';
    credentials = credentials || encodeURIComponent(adapter.config.username) + ':' + encodeURIComponent(adapter.config.password);
    getUrl = getUrl || '@' + adapter.config.host + (adapter.config.port ? ':' + adapter.config.port : '') + '/';
    adapter.log.debug('Connect: ' + url + 'xxx');
    client = io.connect(url + encodeURIComponent(adapter.config.password), {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 3000,
        timeout: 20000,
        forceNew: true
    });
    client.on('connect', function() {
        updateConnected(true);
    });

    client.on('event', function (data) {
        adapter.log.debug(data);
    });

    client.on('disconnect', function (data) {
        updateConnected(false);
    });

    client.on('devices', function (devices) {
        updateConnected(true);
        syncDevices(devices);
    });

    client.on('rules', function (rules) {
        //adapter.log.debug('Rules ' + JSON.stringify(rules));
    });

    client.on('variables', function (variables) {
        var _states = [];
        for (var s = 0; s < variables.length; s++) {
            if (variables[s].value !== undefined && variables[s].value !== null) {
                var state = {
                    _id: adapter.namespace + '.devices.' + variables[s].name.replace(/\s/g, '_'),
                    val: {
                        val: variables[s].value,
                        ack: true
                    }
                };
                if (objects[state._id]) {
                    if (objects[state._id].native && objects[state._id].native.mapping) {
                        if (objects[state._id].native.mapping[variables[s].value] !== undefined) {
                            state.val.val = objects[state._id].native.mapping[variables[s].value];
                        }
                    }
                    _states.push(state);
                } else {
                    adapter.log.warn('Unknown state: ' + state._id);
                }
            }
        }
        syncStates(_states);
    });

    client.on('pages', function (pages) {
        //adapter.log.debug('pages ' + JSON.stringify(pages));
    });

    client.on('groups', function (groups) {
        updateConnected(true);
        var ids = [];
        for (var id in objects) {
            ids.push(id);
        }
        syncGroups(groups, ids);
    });

    client.on('deviceAttributeChanged', function (attrEvent) {
        if (!attrEvent.deviceId || !attrEvent.attributeName) {
            adapter.log.warn('Received invalid event: ' + JSON.stringify(attrEvent));
            return;
        }
        var name = attrEvent.deviceId.replace(/\s/g, '_') + '.' + attrEvent.attributeName.replace(/\s/g, '_');
        adapter.log.debug('update for "' + name + '": ' + JSON.stringify(attrEvent));

        //{deviceId: device.id, attributeName, time: time.getTime(), value}
        var id = adapter.namespace + '.devices.' + name;
        if (objects[id]) {
            adapter.setForeignState(id, {val: attrEvent.value, ts: attrEvent.time, ack: true});
        } else {
            adapter.log.warn('Received update for unknown state: ' + JSON.stringify(attrEvent));
        }
    });

    client.on('callResult', function (msg) {
        if (objects[msg.id]) {
            adapter.setForeignState(msg.id, states[msg.id].val, true);
        }
    });
}

function main() {

    adapter.setState('info.connection', false, true);
    
    connect();
    
    // in this pimatic all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');

    adapter.log.debug('subscribed');
    
    // Adapterwerte übergeben
    repetierIP = adapter.config.repIP;
    repetierPort = adapter.config.repPort;
    repetierApi = adapter.config.repApiKey;


    // *******************
    // Adapterwerte prüfen
    // *******************

    // IP-Adresse prüfen
    if(repetierIP == ''){
        adapter.log.info('Repetier IP: ' + repetierIP);
        adapter.log.info('Keine IP angegeben!');
        adapter.setState('info.connection', false, false);
    }

    // ApiKey prüfen
    if(repetierApi == ''){
        adapter.log.info('Repetier ApiKey: ' + repetierApi);
        adapter.log.info('Keine ApiKey angegeben!');
        adapter.setState('info.connection', false, false);
    }

    // Port prüfen --> Defaultwert für Port übergeben, falls keine Angabe
    if(repetierPort == '')
    {
        repetierPort = '3344';
        adapter.log.info('Repetier Port mit 3344 übernommen!');
    }
    
    // Pfadangben vorbelegen
    printerpath = 'IP_' + repetierIP.replace(/\./g, '_') + '.' ;
    serverpath = 'IP_' + repetierIP.replace(/\./g, '_') + '.Server.';

    // Adapterwerte ausgeben
    adapter.log.info('Repetier IP: ' + repetierIP);
    adapter.log.info('Repetier Port: ' + repetierPort);


    // ***************
    // Initialisierung
    // ***************

    // PrinterStatus
    refreshState();
    
    // Serverstatus
    refreshServer();

    // PrinterUpdate
    printerUpdate();

    // PrinterUpdate Button
    PrinterUpdateButton();

    // PrinterMessage
    PrinterMessage('');

    // **********************
    // Zeitgesteuerte Aufrufe
    // **********************

    // Aufruf RefreshServer (alle 5 Min.)
    setInterval(refreshServer, 300000);
    
    // Refresh Printer aktiv (alle 5 Sek.)
    setInterval(refreshPrinterActive, 5000);

    // Refresh PrinterState (alle 2 Sek.)
    setInterval(refreshState, 2000);

    // Refresh PrintJob (alle 5 Sek.)
    setInterval(refreshPrintJob, 5000);

    // Refresh ServerUpdate (1x am Tag)
    setInterval(serverUpdate, 86400000);

}

// *****************
// Printerfunktionen
// *****************

// neue oder gelöschte Printer
function printerUpdate()
{

    // Alle Drucker innerhalb des Adapters einlesen
    /* Funktion folgte noch */

// Abfrage und Auswertung
    request(
        {
            url:  'http://' + repetierIP + ':' + repetierPort + '/printer/info',
            json: true
        },

        function (error, response, content){
    
            if (!error && response.statusCode == 200){

                //Druckeranzahl
                printercnt = content.printers.length;

                // Alle Drucker einlesen
                for (let p = 0; p < printercnt; p++) {

                    // Druckername
                    printername = content.printers[p].slug;

                    // Array aprinter füllen
                    aprinter[p] = printername;

                    // über alle Printer
                    for (let p = 0; p < printercnt; p++) {

                        // Printername 
                        printername = aprinter[p];
            
                        // Drucker aktivieren
                        printerdatenpfad = printerpath + 'Printer_' + printername + '.Steuern.Signale.Aktivieren';
                        DatenAusgabe(printerdatenpfad, 'state', 'Drucker aktivieren', 'boolean', true, true, '', 'button', false);
            
                        // Drucker deaktivieren
                        printerdatenpfad = printerpath + 'Printer_' + printername + '.Steuern.Signale.Deaktivieren';
                        DatenAusgabe(printerdatenpfad, 'state', 'Drucker deaktivieren', 'boolean', true, true, '', 'button', false);
                
                        // Drucker PrintJob Stop
                        printerdatenpfad = printerpath + 'Printer_' + printername + '.Steuern.Signale.Stopp';
                        DatenAusgabe(printerdatenpfad, 'state', 'PrintJob stoppen', 'boolean', true, true, '', 'button', false);

                        // Drucker NOT-STOP
                        printerdatenpfad = printerpath + 'Printer_' + printername + '.Steuern.Signale.NOTSTOP';
                        DatenAusgabe(printerdatenpfad, 'state', '>>>>> NOT-STOP <<<<<', 'boolean', true, true, '', 'button', false);
                        
                        // Drucker PrintJob Pause
                        printerdatenpfad = printerpath + 'Printer_' + printername + '.Steuern.Signale.Pause';
                        DatenAusgabe(printerdatenpfad, 'state', 'PrintJob Pause', 'boolean', true, true, '', 'button', false);
                        
                        // Drucker PrintJob Fortsetzen
                        printerdatenpfad = printerpath + 'Printer_' + printername + '.Steuern.Signale.Fortsetzen';
                        DatenAusgabe(printerdatenpfad, 'state', 'PrintJob fortsetzen', 'boolean', true, true, '', 'button', false); 

                        // Manueller G-Code Befehl
                        printerdatenpfad = printerpath + 'Printer_' + printername + '.Befehl.G_Code';
                        DatenAusgabe(printerdatenpfad, 'state', 'Manueller G-Code', 'string', true, true, '', 'text.command', ''); 

                        // Materialfluss ändern (10% - 200%)
                        printerdatenpfad = printerpath + 'Printer_' + printername + '.Steuern.Werte.Materialfluss';
                        DatenAusgabe(printerdatenpfad, 'state', 'Materialfluss ändern', 'number', true, true, '%', 'value', 100); 

                        // Druckgeschwindigkeit ändern (10% - 300%)
                        printerdatenpfad = printerpath + 'Printer_' + printername + '.Steuern.Werte.Druckgeschwindigkeit';
                        DatenAusgabe(printerdatenpfad, 'state', 'Druckgeschwindigkeit ändern', 'number', true, true, '%', 'value', 100); 
                    }

                    // Message ausgeben
                    PrinterMessage('Printerupdate durchgeführt');
                }
            }
        }
    );
}

// Serverdaten aktualisieren
function refreshServer()
{

    // Abfrage und Auswertung
    request(
        {
            url:  'http://' + repetierIP + ':' + repetierPort + '/printer/info',
            json: true
        },

        function (error, response, content){
    
            if (!error && response.statusCode == 200){

                // Abfrage Serverdaten
                // Programmname --> Server  
                printerwert = content.name;
                printerdatenpfad = serverpath + 'Programm';
                DatenAusgabe(printerdatenpfad, 'state', 'Name des Programms', 'string', true, false, '', 'info.name', printerwert);
       
                // Versionsname --> Server
                printerwert = content.servername;
                printerdatenpfad = serverpath + 'Versionsname';
                DatenAusgabe(printerdatenpfad, 'state', 'Name der Version', 'string', true, false, '', 'info.name', printerwert);
    
                //Versionsnummer --> Server
                printerwert = content.version;
                printerdatenpfad = serverpath + 'VersionNr';
                DatenAusgabe(printerdatenpfad, 'state', 'VersionNummer', 'string', true, false, '', 'info.version', printerwert);
                
                //UUID --> Server
                printerwert = content.serveruuid;
                printerdatenpfad = serverpath + 'UUID';
                DatenAusgabe(printerdatenpfad, 'state', 'UUID des Servers', 'string', true, false, '', 'info', printerwert);
                
                //Druckeranzahl --> Server
                printerwert = content.printers.length;
                printerdatenpfad = serverpath + 'Druckeranzahl';
                DatenAusgabe(printerdatenpfad, 'state', 'Anzahl der vorhandenen Drucker', 'number', true, false, '', 'info', printerwert);

                // IP-Adresse --> Server
                printerwert = repetierIP;
                printerdatenpfad = serverpath + 'Server_IP';
                DatenAusgabe(printerdatenpfad, 'state', 'IP-Adresse des Servers', 'string', true, false, '', 'info', printerwert);
                
				// Port --> Server
                printerwert = repetierPort;
                printerdatenpfad = serverpath + 'Server_Port';
                DatenAusgabe(printerdatenpfad, 'state', 'Port-Nummer des Servers', 'string', true, false, '', 'info', printerwert);
                
				// ApiKey --> Server
                printerwert = repetierApi;
                printerdatenpfad = serverpath + 'Server_ApiKey';
                DatenAusgabe(printerdatenpfad, 'state', 'ApiKey des Servers', 'string', true, false, '', 'info', printerwert);
                
            }
        }
    );
}

// Printerstatus aktualisieren
function refreshPrinterActive()
{
        
    // Abfrage und Auswertung
    request(
        {
            url:  'http://' + repetierIP + ':' + repetierPort + '/printer/info',
            json: true
        },

        function (error, response, content){
    
            if (!error && response.statusCode == 200){
               
                // Alle Drucker einlesen
                for (let p = 0; p < printercnt; p++) {

                    // Druckername
                    printername = content.printers[p].slug;

                    // Drucker aktiviert --> Drucker Status
                    printerwert = content.printers[p].active;
                    printerdatenpfad = printerpath + 'Printer_' + printername + '.Status.Aktiviert';
                    DatenAusgabe(printerdatenpfad, 'state', 'Drucker aktiviert', 'boolean', true, false, '', 'info.status', printerwert);

                    // Drucker Online --> Drucker Status
                    printerwert=content.printers[p].online;
                    printerdatenpfad = printerpath + 'Printer_' + printername + '.Status.Online';
                    DatenAusgabe(printerdatenpfad, 'state', 'Drucker Online', 'number', true, false, '', 'info.status', printerwert);
                }            
            }
        }
    );
}

// Softwareupdate für Server
function serverUpdate()
{
    // min. 1 Drucker muss vorhanden sein
    if (printercnt > 0){

        // ersten Drucker wählen
        printername = aprinter[0];

        // Abfrage und Auswertung
        request(
            {
                url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + printername + '?a=updateAvailable&apikey=' + repetierApi,
                json: true
            },
            function (error, response, content){

                if (!error && response.statusCode == 200){

                    // Demovesion --> Server
                    printerwert = content.demo;
                    printerdatenpfad = serverpath + 'Demoversion';
                    DatenAusgabe(printerdatenpfad, 'state', 'Demoversion', 'boolean', true, false, '', 'info', printerwert);

                    // Softwareupdate vorhanden --> Server
                    printerwert = content.updateAvailable;
                    printerdatenpfad = serverpath + 'Update';
                    DatenAusgabe(printerdatenpfad, 'state', 'Softwareupdate vorhanden', 'boolean', true, false, '', 'info', printerwert);

                }
            }
        );
    }
}

// Printerwerte aktualisieren
function refreshState(){

    // Überhaupt Drucker vorhanden
    if (aprinter.length > 0){

        // über alle Drucker
        for (let p = 0; p < printercnt; p++) {

            // Printername
            printername = aprinter[p];

            // Abfrage und Auswertung
            request(
                {
                    url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + printername + '?a=stateList&data&apikey=' + repetierApi,
                    json: true
                },

                function (error, response, content){
                
                    if (!error && response.statusCode == 200){

                        if (content && content.hasOwnProperty(printername)){
            
                            // Firmware --> Info
                            printerwert = content[printername].firmware; 
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Info.Firmware';
                            DatenAusgabe(printerdatenpfad, 'state', 'Firmware des Druckers', 'string', true, false, '', 'info', printerwert);
                            
                            // Anzahl Extruder --> Info
                            printerwert = content[printername].extruder.length;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Info.Extruderanzahl';
                            DatenAusgabe(printerdatenpfad, 'state', 'Anzahl der Extruder', 'number', true, false, '', 'info', printerwert);

                            // Anzahl Heizbeden --> Info
                            printerwert = content[printername].heatedBeds.length;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Info.Heizbedanzahl';
                            DatenAusgabe(printerdatenpfad, 'state', 'Anzahl der Heizbeden', 'number', true, false, '', 'info', printerwert);

                            // Anzahl Lüfter --> Info
                            printerwert = content[printername].fans.length; 
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Info.Lüfteranzahl';
                            DatenAusgabe(printerdatenpfad, 'state', 'Anzahl der Lüfter', 'number', true, false, '', 'info', printerwert);

                            // Anzahl Heizkammern --> Info
                            printerwert = content[printername].heatedChambers.length; 
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Info.Heizkammern';
                            DatenAusgabe(printerdatenpfad, 'state', 'Anzahl der Heizkammern', 'number', true, false, '', 'info', printerwert);

                            // X-Position --> Positionen
                            printerwert = content[printername].x;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Koordinaten.Position_X';
                            DatenAusgabe(printerdatenpfad, 'state', 'X-Position', 'number', true, false, 'mm', 'value', printerwert.toFixed(3));
                            
                            // Y-Position --> Positionen
                            printerwert = content[printername].y;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Koordinaten.Position_Y';
                            DatenAusgabe(printerdatenpfad, 'state', 'Y-Position', 'number', true, false, 'mm', 'value', printerwert.toFixed(3));

                            // Z-Position --> Positionen
                            printerwert = content[printername].z;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Koordinaten.Position_Z';
                            DatenAusgabe(printerdatenpfad, 'state', 'Z-Position', 'number', true, false, 'mm', 'value', printerwert.toFixed(3));

                            // X-Homing --> Homing
                            printerwert = content[printername].hasXHome;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Homing.Achse_X';
                            DatenAusgabe(printerdatenpfad, 'state', 'Referenzfahrt X-Achse erfolgt', 'boolean', true, false, '', 'value', printerwert);

                            // Y-Homing --> Homing
                            printerwert = content[printername].hasYHome;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Homing.Achse_Y';
                            DatenAusgabe(printerdatenpfad, 'state', 'Referenzfahrt Y-Achse erfolgt', 'boolean', true, false, '', 'value', printerwert);

                            // Z-Homing --> Homing
                            printerwert = content[printername].hasZHome;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Homing.Achse_Z';
                            DatenAusgabe(printerdatenpfad, 'state', 'Referenzfahrt Z-Achse erfolgt', 'boolean', true, false, '', 'value', printerwert);

                            // Druckertür --> Status
                            printerwert = content[printername].doorOpen;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Status.Tür_geöffnet';
                            DatenAusgabe(printerdatenpfad, 'state', 'Tür zum Drucker geöffnet', 'boolean', true, false, '', 'value', printerwert);

                            // Power Ein (M80) --> Status
                            printerwert = content[printername].powerOn;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Status.Power_Ein';
                            DatenAusgabe(printerdatenpfad, 'state', 'Power (M80) eingeschaltet', 'boolean', true, false, '', 'switch.power', printerwert);

                            // Lichter --> Status
                            printerwert = content[printername].lights;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Status.Lichter';
                            DatenAusgabe(printerdatenpfad, 'state', 'Lichter eingeschaltet (Versuch)', 'number', true, false, '', 'value', printerwert);

                            // TemperaturIstWerte der Extruder übergeben
                            for (i=0 ; i < content[printername].extruder.length; i++){
                                printerwert = content[printername].extruder[i].tempRead;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Istwerte.Extruder_' + (i+1) +'_Temperatur';
                                DatenAusgabe(printerdatenpfad, 'state', 'Temperaturwert Extruder ' + (i + 1), 'number', true, false, '°C', 'value.temperature', printerwert.toFixed(1));
                            }

                            // HeizleistungIstWerte der Extruder übergeben
                            for (i=0 ; i < content[printername].extruder.length; i++){
                                printerwert = content[printername].extruder[i].output;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Istwerte.Extruder_' + (i+1) +'_Heizleistung';
                                DatenAusgabe(printerdatenpfad, 'state', 'Heizleistung Extruder ' + (i + 1), 'number', true, false, '%', 'value.value', printerwert.toFixed(0));
                            }

                            // TemperaturSollWerte der Extruder übergeben
                            for (i=0 ; i < content[printername].extruder.length; i++){
                                printerwert = content[printername].extruder[i].tempSet;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Sollvorgaben.Extruder_' + (i+1) +'_Temperatur';
                                DatenAusgabe(printerdatenpfad, 'state', 'Solltemperatur Extruder ' + (i + 1), 'number', true, false, '°C', 'value.temperature.setpoint', printerwert);
                            }

                            // TemperaturIstWerte der Heizbeden übergeben
                            for (i=0 ; i < content[printername].heatedBeds.length; i++){
                                printerwert = content[printername].heatedBeds[i].tempRead;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Istwerte.Heizbed_' + (i+1) +'_Temperatur';
                                DatenAusgabe(printerdatenpfad, 'state', 'Temperaturwert Heizbed ' + (i + 1), 'number', true, false, '°C', 'value.temperature', printerwert.toFixed(1));
                            }

                            // HeizleistungIstWerte der Heizbeden übergeben
                            for (i=0 ; i < content[printername].heatedBeds.length; i++){
                                printerwert = content[printername].heatedBeds[i].output;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Istwerte.Heizbed_' + (i+1) +'_Heizleistung';
                                DatenAusgabe(printerdatenpfad, 'state', 'Heizleistung Heizbed ' + (i + 1), 'number', true, false, '%', 'value.value', printerwert.toFixed(0));
                            }

                            // TemperaturSollWerte der Heizbeden übergeben
                            for (i=0 ; i < content[printername].heatedBeds.length; i++){
                                printerwert = content[printername].heatedBeds[i].tempSet;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Sollvorgaben.Heizbed_' + (i+1) +'_Temperatur';
                                DatenAusgabe(printerdatenpfad, 'state', 'Solltemperatur Heizbed ' + (i + 1), 'number', true, false, '°C', 'value.temperature.setpoint', printerwert);
                            }
                            
                            // TemperaturIstWerte der Heizkammern übergeben
                            for (i=0 ; i < content[printername].heatedChambers.length; i++){
                                printerwert = content[printername].heatedChambers[i].tempRead;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Istwerte.Heizkammer_' + (i+1) +'_Temperatur';
                                DatenAusgabe(printerdatenpfad, 'state', 'Temperaturwert Heizkammer ' + (i + 1), 'number', true, false, '°C', 'value.temperature', printerwert.toFixed(1));
                            }

                            // HeizleistungIstWerte der Heizkammern übergeben
                            for (i=0 ; i < content[printername].heatedChambers.length; i++){
                                printerwert = content[printername].heatedChambers[i].output;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Istwerte.Heizkammer_' + (i+1) +'_Heizleistung';
                                DatenAusgabe(printerdatenpfad, 'state', 'Heizleistung Heizkammer ' + (i + 1), 'number', true, false, '%', 'value.value', printerwert.toFixed(0));
                            }

                            // TemperaturSollWerte der Heizkammern übergeben
                            for (i=0 ; i < content[printername].heatedChambers.length; i++){
                                printerwert = content[printername].heatedChambers[i].tempSet;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Sollvorgaben.Heizkammer_' + (i+1) +'_Temperatur';
                                DatenAusgabe(printerdatenpfad, 'state', 'Solltemperatur Heizkammer ' + (i + 1), 'number', true, false, '°C', 'value.temperature.setpoint', printerwert.toFixed(0));
                            }

                            // Lüfter Ein übergeben
                            for (i=0 ; i < content[printername].fans.length; i++){
                                printerwert = content[printername].fans[i].on;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Status.Lüfter_' + (i+1) +'_Eingeschaltet';
                                DatenAusgabe(printerdatenpfad, 'state', 'Lüfter ' + (i + 1) + ' eingeschaltet', 'boolean', true, false, '', 'switch.power', printerwert);
                            }

                            // Lüfter Output übergeben
                            for (i=0 ; i < content[printername].fans.length; i++){
                                printerwert = content[printername].fans[i].voltage;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Istwerte.Lüfter_' + (i+1) +'_Drehzahl';
                                DatenAusgabe(printerdatenpfad, 'state', 'Lüfter ' + (i + 1) + ' Drehzahl in %', 'number', true, false, '%', 'value.value', ((printerwert/255)*100).toFixed(0));
                            }

                            // Materialfluss % --> PrintJob
                            printerwert = content[printername].flowMultiply;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Materialfluss';
                            DatenAusgabe(printerdatenpfad, 'state', 'Materialfluss in %', 'number', true, false, '%', 'value.flow', printerwert.toFixed(0));

                            // Druckgeschwindigkeit % --> PrintJob
                            printerwert = content[printername].speedMultiply;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Druckgeschwindigkeit';
                            DatenAusgabe(printerdatenpfad, 'state', 'Druckgeschwindigkeit in %', 'number', true, false, '%', 'value.speed', printerwert.toFixed(0));

                            // Aktueller Layer --> PrintJob
                            printerwert = content[printername].layer;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Layer_Aktuell';
                            DatenAusgabe(printerdatenpfad, 'state', 'Layer wird aktuell erstellt', 'number', true, false, '', 'value', printerwert);

                        }
                    }
                }
            );
        }
    }
}

// PrintJob-Daten aktualisieren
function refreshPrintJob()
{
    if (aprinter.length > 0){

        // Über alle Printer
        for (let p = 0; p < printercnt; p++) {

            // Printername 
            printername = aprinter[p];

            // Abfrage und Auswertung
            request(
                {
                    url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + printername + '?a=listPrinter&data&apikey=' + repetierApi,
                    json: true
                },

                function (error, response, content){
                    adapter.log.debug('Request done');
            
                    if (!error && response.statusCode == 200){
                    
                        if (content && content.hasOwnProperty(0)){

                            //Wenn nicht gedruckt wird, keine Anfrage der Zeiten, da im JSON nicht vorhanden
                            if(content[0].job !== 'none'){

                                // Druckteilname --> PrintJob
                                printerwert = content[0].job;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Druckteilname';
                                DatenAusgabe(printerdatenpfad, 'state', 'Name des Druckteils', 'string', true, false, '', 'info.name', printerwert);
                                
                                // Druckbeginn --> PrintJob
                                printerwert = new Date(content[0].printStart * 1000);
                                tStd = ('00' + printerwert.getHours().toString()).substr(-2);
                                tMin = ('00' + printerwert.getMinutes().toString()).substr(-2);
                                printerwert = tStd + ':' + tMin;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Uhrzeit_Start';
                                DatenAusgabe(printerdatenpfad, 'state', 'Uhrzeit bei Druckstart', 'string', true, false, 'Uhr', 'info.time', printerwert);

                                // Gesamtdruckzeit --> PrintJob
                                printerwert =  Math.round (1 * content[0].printTime / 60);
                                tStd = (Math.floor(printerwert / 60));
                                tMin = (printerwert - (tStd * 60));
                                tStd = ('00' + tStd.toString()).substr(-2);
                                tMin = ('00' + tMin.toString()).substr(-2);
                                printerwert = tStd + ':' + tMin;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Gesamtdruckzeit';
                                DatenAusgabe(printerdatenpfad, 'state', 'Gesamtdruckzeit', 'string', true, false, 'Std.', 'info.time', printerwert);

                                // Restzeit --> PrintJob
                                printerwert = Math.round ((1 * content[0].printTime.toFixed(2) / 60)-(1 * content[0].printedTimeComp / 60));
                                tRStd = (Math.floor(printerwert / 60));
                                tRMin = (printerwert - (tRStd * 60));
                                tStd = ('00' + tRStd.toString()).substr(-2);
                                tMin = ('00' + tRMin.toString()).substr(-2);
                                printerwert = tStd + ':' + tMin;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Restzeit';
                                DatenAusgabe(printerdatenpfad, 'state', 'Restzeit bis Druckende', 'string', true, false, 'Std.', 'info.time', printerwert);

                                // Fertigzeit --> PrintJob
                                printerwert = new Date();
                                printerwert.setHours(printerwert.getHours() + tRStd);
                                printerwert.setMinutes(printerwert.getMinutes() + tRMin);
                                tStd = ('00' + printerwert.getHours().toString()).substr(-2);
                                tMin = ('00' + printerwert.getMinutes().toString()).substr(-2);
                                printerwert = tStd + ':' + tMin;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Uhrzeit_Fertig';
                                DatenAusgabe(printerdatenpfad, 'state', 'Uhrzeit wenn Druck fertig', 'string', true, false, 'Uhr', 'info.time', printerwert);

                                // Fortschritt in % --> PrintJob
                                printerwert = content[0].done.toFixed(2);
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Druckfortschritt';
                                DatenAusgabe(printerdatenpfad, 'state', 'Druckfortschritt in %', 'string', true, false, '%', 'info.status', printerwert);

                                // Anzahl Layer --> PrintJob
                                printerwert = content[0].ofLayer;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Layer_Gesamt';
                                DatenAusgabe(printerdatenpfad, 'state', 'Anzahl der Layer', 'number', true, false, '', 'info.status', printerwert);

                                // Anzahl Lines --> PrintJob
                                printerwert = content[0].totalLines;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Linien_Gesamt';
                                DatenAusgabe(printerdatenpfad, 'state', 'Gesamtanzahl der Linien', 'number', true, false, '', 'info.status', printerwert);

                                // Gesendete Lines --> PrintJob
                                printerwert = content[0].linesSend;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Linien_gesendet';
                                DatenAusgabe(printerdatenpfad, 'state', 'An Drucker gesendete Linien', 'number', true, false, '', 'info.status', printerwert);

                                // Druckpause --> Status
                                printerwert = content[0].paused;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Status.Druckpause';
                                DatenAusgabe(printerdatenpfad, 'state', 'Drucker im Pausenmodus', 'boolean', true, false, '', 'info.status', printerwert);

                                // Druck läuft --> PrintJob
                                if (content[0].done.toFixed(2) > 0){
                                    printerwert = true;
                                }
                                else{
                                    printerwert = false;
                                }
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Status.Drucker_druckt';
                                DatenAusgabe(printerdatenpfad, 'state', 'Drucker druckt', 'boolean', true, false, '', 'info.status', printerwert);
    
                            }

                            // Wenn Druckteil fertig, dann Zeiten/Werte löschen 
                            if(content[0].job === 'none'){

                                // Druckteilname --> PrintJob
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Druckteilname';
                                DatenAusgabe(printerdatenpfad, 'state', 'Name des Druckteils', 'string', true, false, '', 'info.name', '---');
                                
                                // Anzahl Layer --> PrintJob
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Layer_Gesamt';
                                DatenAusgabe(printerdatenpfad, 'state', 'Anzahl der Layer', 'number', true, false, '', 'info.status', 0);
                                                            
                                // Anzahl Lines --> PrintJob
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Linien_Gesamt';
                                DatenAusgabe(printerdatenpfad, 'state', 'Gesamtanzahl der Linien', 'number', true, false, '', 'info.status', 0);
                                
                                // Gesendete Lines --> PrintJob
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Linien_gesendet';
                                DatenAusgabe(printerdatenpfad, 'state', 'An Drucker gesendete Linien', 'number', true, false, '', 'info.status', 0);
                                
                                // Druckpause --> Status
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Status.Druckpause';
                                DatenAusgabe(printerdatenpfad, 'state', 'Drucker im Pausenmodus', 'boolean', true, false, '', 'info.status', false);

                                // Gesamtdruckzeit
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Gesamtdruckzeit';
                                DatenAusgabe(printerdatenpfad, 'state', 'Gesamtdruckzeit', 'string', true, false, 'Std.', 'info.time', '--:--');
                                
                                // Uhrzeit Druckbeginn                                
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Uhrzeit_Start';
                                DatenAusgabe(printerdatenpfad, 'state', 'Uhrzeit bei Druckstart', 'string', true, false, 'Uhr', 'info.time', '--:--');

                                // Restzeit
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Restzeit';
                                DatenAusgabe(printerdatenpfad, 'state', 'Restzeit bis Druckende', 'string', true, false, 'Std.', 'info.time', '--:--');

                                // Uhrzeit Druckende
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Uhrzeit_Fertig';
                                DatenAusgabe(printerdatenpfad, 'state', 'Uhrzeit wenn Druck fertig', 'string', true, false, 'Uhr', 'info.time', '--:--');

                                // Fortschritt
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Druckfortschritt';
                                DatenAusgabe(printerdatenpfad, 'state', 'Druckfortschritt in %', 'string', true, false, '%', 'info.status', '---');
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Drucker_druckt';
                                DatenAusgabe(printerdatenpfad, 'state', 'Drucker druckt', 'boolean', true, false, '', 'info.status', false);

                            }                                
                        }
                    }
                }
            );
        }
    }
}

// *********************
// Allgemeine Funktionen
// *********************

// Updatebutton anlegen und initialisieren
function PrinterUpdateButton(){

    // 'update_Printer' anlegen
    DatenAusgabe(printerpath + 'Printer_update', 'state', 'update Printers', 'boolean', true, true, '', 'button', false); 
}


// Updatebutton anlegen und initialisieren
function PrinterMessage(tMessage){

    // 'Message_Printer' anlegen
    DatenAusgabe(printerpath + 'Nachricht', 'state', 'Message Printers', 'string', true, true, '', 'text', tMessage); 
}


// Datenübergabe an ioBroker 
function DatenAusgabe(d_Pfad, d_Type, c_Name, c_Type, c_Read, c_Write, c_Unit, c_Role, d_Wert){
    adapter.setObjectNotExists(d_Pfad,{
        type: d_Type,
        common:
        {
            name:  c_Name,
            type:  c_Type,
            read:  c_Read,
            write: c_Write,
            unit:  c_Unit,
            role:  c_Role
        },
        native: {}
    });
    adapter.setState(d_Pfad, {val: d_Wert, ack: true});
}


// grobe G-Code-Überprüfung
function GCodeCheck(G_Code){

    // Prüfen, og G-Code mit 'G', 'M', 'T', oder '@' beginnt
    if (G_Code.substr(0,1)=='G' || G_Code.substr(0,1)=='M' || G_Code.substr(0,1)=='T' || G_Code.substr(0,1)=='@'){
        PrinterMessage('G-Code übernommen');
        return true;    // Prüfung bestanden, dann 'true' zurück
    }
    else
    {
        PrinterMessage(rGcodeUnbekannt);
        return false;   // sonst 'false' als Rückgabewert
    }
}