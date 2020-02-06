'use strict';

/*
 * 
 * repetierserver adapter Copyright 2020, Baumert7269 <thomas.baumert@live.de>
 *
 */

// ******************************
// Definitionen und Vorbelegungen
// ******************************

const utils = require('@iobroker/adapter-core');
//const adapter = new utils.Adapter('repetierserver');

// Rückmeldetext
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

class Template extends utils.Adapter {

    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'template',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('objectChange', this.onObjectChange.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here

        // Adapterwert 'info.connection' übergeben
        this.setState('info.connection', true, true);
    
	    // Meldung ausgeben
	    this.log.info('RepetierServer verbunden');

        // Hauptprogramm
        main();


        /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "testVariable"
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
        */
        await this.setObjectAsync('testVariable', {
            type: 'state',
            common: {
                name: 'testVariable',
                type: 'boolean',
                role: 'indicator',
                read: true,
                write: true,
            },
            native: {},
        });

        // in this template all states changes inside the adapters namespace are subscribed
        this.subscribeStates('*');

        /*
        setState examples
        you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
        */
        // the variable testVariable is set to true as command (ack=false)
        await this.setStateAsync('testVariable', true);

        // same thing, but the value is flagged "ack"
        // ack should be always set to true if the value is received from or acknowledged from the target system
        await this.setStateAsync('testVariable', { val: true, ack: true });

        // same thing, but the state is deleted after 30s (getState will return null afterwards)
        await this.setStateAsync('testVariable', { val: true, ack: true, expire: 30 });

        // examples for the checkPassword/checkGroup functions
        let result = await this.checkPasswordAsync('admin', 'iobroker');
        this.log.info('check user admin pw iobroker: ' + result);

        result = await this.checkGroupAsync('admin', 'admin');
        this.log.info('check group user admin group admin: ' + result);
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {

            // Alle Zeitgesteuerten Aufrufe löschen
            clearInterval(refreshServer);
            clearInterval(refreshPrinterActive);
            clearInterval(refreshState);
            clearInterval(refreshPrintJob);
            clearInterval(serverUpdate);

            this.setState('info.connection', false, false);

            this.log.info('Repetier-Server Verbindungsaufbau gestoppt...');
            this.log.info('Repetier-Server Service gestoppt...');
            this.log.info('Repetier-Server Service bereinigt...');

            callback();
        } catch (e) {
            callback();
        }
    }

    /**
     * Is called if a subscribed object changes
     * @param {string} id
     * @param {ioBroker.Object | null | undefined} obj
     */
    onObjectChange(id, obj) {
        if (obj) {
            // The object was changed
            this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
        } else {
            // The object was deleted
            this.log.info(`object ${id} deleted`);
        }
    }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.message" property to be set to true in io-package.json
    //  * @param {ioBroker.Message} obj
    //  */
    // onMessage(obj) {
    // 	if (typeof obj === 'object' && obj.message) {
    // 		if (obj.command === 'send') {
    // 			// e.g. send email or pushover or whatever
    // 			this.log.info('send command');

    // 			// Send response in callback if required
    // 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
    // 		}
    // 	}
    // }

}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Template(options);
} else {
    // otherwise start the instance directly
    new Template();
}


function main() {

    adapter.subscribeStates('*');
    this.subscribeStates('*');

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