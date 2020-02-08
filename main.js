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
const request = require('request');

// Rückmeldetext
const rGcodeUnbekannt = 'unbekannter G-Code' ;

// Adapterparameter
let repetierIP = '' ;
let repIPOK = false ;
let repetierPort = '' ;
let repPortOK = false ;
let repetierApi = '' ;
let repApiKeyOK = false ;

// Datenübergabevariablen
let printerwert ;
let printerdatenpfad = '' ;

// Allgemeine Hilfsvariablen
let i = 0 ;

// Variablen für TimeOut-IDs
let tou1 ;
let tou2 ;
let tou3 ;
let tou4 ;
let tou5 ;
let tou6 ;

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

// Adapter anlegen
class Template extends utils.Adapter {

    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'repetierserver',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady(callback) {

        // Initialisierung
        // Adapterwert 'info.connection' übergeben
        this.setState('info.connection', true, true);
    
	    // Meldung ausgeben
	    this.log.info('RepetierServer verbunden');

        // *******************
        // Adapterwerte prüfen
        // *******************
        // Adapterwerte übergeben
        repetierIP = this.config.repIP;
        repetierPort = this.config.repPort;
        repetierApi = this.config.repApiKey;

        // IP-Adresse prüfen
        if(repetierIP == '' || repetierIP == '0.0.0.0'){
            this.log.info('Repetier IP: ' + repetierIP);
            this.log.info('Keine korrekte IP angegeben!');
            this.setState('info.connection', false, false);
            repIPOK = false;
        }
        else {
            repIPOK = true;
            this.log.info('Repetier IP: ' + repetierIP);
        }

        // ApiKey prüfen
        if(repetierApi == ''){
            this.log.info('Kein ApiKey angegeben!');
            this.setState('info.connection', false, false);
            repApiKeyOK = false;
        }
        else {
            repApiKeyOK = true;
            this.log.info('Repetier ApiKey: ' + repetierApi);
        }

        // Port prüfen --> Defaultwert für Port übergeben, falls keine Angabe
        if(repetierPort == ''){
            repetierPort = '3344';
            this.log.info('Repetier Defaultport 3344 wurde übernommen!');
            repPortOK = true;
        }
        else {
            repPortOK = true;
            this.log.info('Repetier Port: ' + repetierPort);
        }
  
        // Initisalsierung
        if (repIPOK == true && repPortOK == true && repApiKeyOK == true){
           
            // Pfadangben vorbelegen
            printerpath = 'IP_' + repetierIP.replace(/\./g, '_') + '.' ;
            serverpath = 'IP_' + repetierIP.replace(/\./g, '_') + '.Server.';
 
            main(this);
        }
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {

            // Alle Zeitgesteuerten Aufrufe löschen
            clearTimeout(tou1);
            clearTimeout(tou2);
            clearTimeout(tou3);
            clearTimeout(tou4);
            clearTimeout(tou5);
            clearTimeout(tou6);

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
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            // Printername ermitteln
            const tmp = id.split('.');

            // Printername vorhanden
            if (tmp.length > 3) {

                // Printername auswerten
                if (tmp[3].search('rinter_') > 0 || tmp[3].search('pdate_Printer') > 0){  // --> Printer ohne 'P', damit search > 0 sein kann    
                    printername = tmp[3].replace('Printer_', '');
        
                    // Welcher Steuerbefehl des Printers wurde geändert 
                    switch(true){

                        // Druck Stopp
                    case (id.search('Steuern.Signale.Stopp')> 0 && state.val == true):
                        request(
                            {
                                url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + printername + '?a=stopJob&apikey=' + repetierApi,
                            },    
                        );
                        this.setState(id, {val: false, ack: true});
                        break;

                    // Drucker NOT-STOP
                    case (id.search('Steuern.Signale.NOTSTOP')> 0 && state.val == true):
                        request(
                            {
                                url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + printername + '?a=emergencyStop&apikey=' + repetierApi,
                            },    
                        );
                        this.setState(id, {val: false, ack: true});
                        break;

                        // Printer Aktivieren
                    case (id.search('Steuern.Signale.Aktivieren') > 0 && state.val == true):
                        request(
                            {
                                url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + printername + '?a=activate&data={"printer":"' + printername + '"}&apikey=' + repetierApi,
                            },    
                        );
                        this.setState(id, {val: false, ack: true});
                        break; 

                    // Printer Deaktivieren
                    case (id.search('Steuern.Signale.Deaktivieren')> 0 && state.val == true):
                        request(
                            {
                                url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + printername + '?a=deactivate&data={"printer":"' + printername + '"}&apikey=' + repetierApi,
                            },    
                        );
                        this.setState(id, {val: false, ack: true});
                        break;

                    // Druck Pause
                    case (id.search('Steuern.Signale.Pause')> 0 && state.val == true):
                        request(
                            {
                                url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + printername + '?a=send&data={"cmd":"@pause"}&apikey=' + repetierApi,
                            },    
                        );
                        this.setState(id, {val: false, ack: true});
                        break;
                    
                    // Druck fortsetzen
                    case (id.search('Steuern.Signale.Fortsetzen')> 0 && state.val == true):
                        request(
                            {
                                url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + printername + '?a=continueJob&apikey=' + repetierApi,
                            },    
                        );
                        this.setState(id, {val: false, ack: true});
                        break;

                    // Manueller G-Code-Befehl
                    case (id.search('Befehl.G_Code') > 0 && state.val != '' && state.val != rGcodeUnbekannt):
                        // Befehl ist korrekt --> dann übergeben
                        if (GCodeCheck(state.val) == true){
                            request(
                                {
                                    url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + printername + '?a=send&data={"cmd":"'+ state.val + '"}&apikey=' + repetierApi,
                                },    
                            );
                            this.setState(id, {val: '', ack: true});
                        }
                        else{   // Befehl nicht korrekt --> abbrechen und Rückmeldung
                            this.setState(id, {val: '', ack: true});
                        }
                        break;

                    // Materialfluss ändern (10% - 200%)
                    case (id.search('Steuern.Werte.Materialfluss') > 0 && (state.val >= 10) && (state.val <=200)):
                        request(
                            {
                                url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + printername + '?a=setFlowMultiply&data={"speed":"'+ state.val + '"}&apikey=' + repetierApi,
                            },    
                        );
                        break;

                    // Druckgeschwindigkeit ändern (10% - 300%)
                    case (id.search('Steuern.Werte.Druckgeschwindigkeit') > 0 && (state.val >= 10) && (state.val <=300)):
                        request(
                            {
                                url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + printername + '?a=setSpeedMultiply&data={"speed":"'+ state.val + '"}&apikey=' + repetierApi,
                            },    
                        );
                        break;

                    // update_Printer - neu Printer vorhanden
                    case (id.search('update.Printer')> 0 && state.val == true):

                        printerUpdate(this);
                        this.setState(id, {val: false, ack: true});
                    
                        break;
                
                    }
                }
            }   
        }
    }
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

// ***********************************************************************************************************

// *************
// Hauptprogramm
// *************
function main(tadapter)
{
    tadapter.subscribeStates('*');
    tadapter.log.debug('RepetierServer states subscribed');
    
    // ***************
    // Initialisierung
    // ***************

    // PrinterUpdate Button
    PrinterUpdateButton(tadapter);

    // PrinterUpdate (alle 10 Min.) Timer-ID: tou1
    printerUpdate(tadapter, 600000);
 
    // Serverstatus (alle 5 Min.) Timer-ID: tou2
    refreshServer(tadapter, 300000);

    // Refresh ServerUpdate (1x am Tag) Timer-ID: tou3
    serverUpdate(tadapter, 86400000);

    // Refresh Printer aktiv (alle 5 Sek.) Timer-ID: tou4
    refreshPrinterActive(tadapter, 5000);

    // PrinterMessage
    PrinterMessage(tadapter, '');

    // PrinterStatus (alle 2 Sek.) Timer-ID:tou5
    refreshState(tadapter, 2000);

    // Refresh PrintJob (alle 5 Sek.) Timer-ID: tou6
    refreshPrintJob(tadapter, 5000);
	
}

// *****************
// Printerfunktionen
// *****************

// neue oder gelöschte Printer
async function printerUpdate(tadapter, refreshtime)
{
    // Alle Drucker innerhalb des Adapters einlesen
    /* Funktion folgte noch */

    // Abfrage und Auswertung
    await request(
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
                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Drucker aktivieren', 'boolean', true, true, '', 'button', false);
            
                        // Drucker deaktivieren
                        printerdatenpfad = printerpath + 'Printer_' + printername + '.Steuern.Signale.Deaktivieren';
                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Drucker deaktivieren', 'boolean', true, true, '', 'button', false);
                
                        // Drucker PrintJob Stop
                        printerdatenpfad = printerpath + 'Printer_' + printername + '.Steuern.Signale.Stopp';
                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'PrintJob stoppen', 'boolean', true, true, '', 'button', false);

                        // Drucker NOT-STOP
                        printerdatenpfad = printerpath + 'Printer_' + printername + '.Steuern.Signale.NOTSTOP';
                        DatenAusgabe(tadapter, printerdatenpfad, 'state', '>>>>> NOT-STOP <<<<<', 'boolean', true, true, '', 'button', false);
                        
                        // Drucker PrintJob Pause
                        printerdatenpfad = printerpath + 'Printer_' + printername + '.Steuern.Signale.Pause';
                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'PrintJob Pause', 'boolean', true, true, '', 'button', false);
                        
                        // Drucker PrintJob Fortsetzen
                        printerdatenpfad = printerpath + 'Printer_' + printername + '.Steuern.Signale.Fortsetzen';
                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'PrintJob fortsetzen', 'boolean', true, true, '', 'button', false); 

                        // Manueller G-Code Befehl
                        printerdatenpfad = printerpath + 'Printer_' + printername + '.Befehl.G_Code';
                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Manueller G-Code', 'string', true, true, '', 'text.command', ''); 

                        // Materialfluss ändern (10% - 200%)
                        printerdatenpfad = printerpath + 'Printer_' + printername + '.Steuern.Werte.Materialfluss';
                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Materialfluss ändern', 'number', true, true, '%', 'value', 100); 

                        // Druckgeschwindigkeit ändern (10% - 300%)
                        printerdatenpfad = printerpath + 'Printer_' + printername + '.Steuern.Werte.Druckgeschwindigkeit';
                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Druckgeschwindigkeit ändern', 'number', true, true, '%', 'value', 100); 
                    }

                    // Message ausgeben
                    PrinterMessage(tadapter, 'Printerupdate durchgeführt');
                }
            }
        }
    );

    // Funktion erneut nach x Sekunden aufrufen
    clearTimeout(tou1);
    tou1 = setTimeout(() => {
        printerUpdate(tadapter, refreshtime);
    }, refreshtime);


}


// Serverdaten aktualisieren
async function refreshServer(tadapter, refreshtime)
{
    // Abfrage und Auswertung
    await request(
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
                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Name des Programms', 'string', true, false, '', 'info.name', printerwert);
       
                // Versionsname --> Server
                printerwert = content.servername;
                printerdatenpfad = serverpath + 'Versionsname';
                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Name der Version', 'string', true, false, '', 'info.name', printerwert);
    
                //Versionsnummer --> Server
                printerwert = content.version;
                printerdatenpfad = serverpath + 'VersionNr';
                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'VersionNummer', 'string', true, false, '', 'info.version', printerwert);
                
                //UUID --> Server
                printerwert = content.serveruuid;
                printerdatenpfad = serverpath + 'UUID';
                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'UUID des Servers', 'string', true, false, '', 'info', printerwert);
                
                //Druckeranzahl --> Server
                printerwert = content.printers.length;
                printerdatenpfad = serverpath + 'Druckeranzahl';
                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Anzahl der vorhandenen Drucker', 'number', true, false, '', 'info', printerwert);

                // IP-Adresse --> Server
                printerwert = repetierIP;
                printerdatenpfad = serverpath + 'Server_IP';
                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'IP-Adresse des Servers', 'string', true, false, '', 'info', printerwert);
                
				// Port --> Server
                printerwert = repetierPort;
                printerdatenpfad = serverpath + 'Server_Port';
                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Port-Nummer des Servers', 'string', true, false, '', 'info', printerwert);
                
				// ApiKey --> Server
                printerwert = repetierApi;
                printerdatenpfad = serverpath + 'Server_ApiKey';
                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'ApiKey des Servers', 'string', true, false, '', 'info', printerwert);
                
            }
        }
    );
    
    // Funktion erneut nach x Sekunden aufrufen
    clearTimeout(tou2);
    tou2 = setTimeout(() => {
        refreshServer(tadapter, refreshtime);
    }, refreshtime);

}

// Printerstatus aktualisieren
async function refreshPrinterActive(tadapter, refreshtime)
{
    // Abfrage und Auswertung
    await request(
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
                    DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Drucker aktiviert', 'boolean', true, false, '', 'info.status', printerwert);

                    // Drucker Online --> Drucker Status
                    printerwert=content.printers[p].online;
                    printerdatenpfad = printerpath + 'Printer_' + printername + '.Status.Online';
                    DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Drucker Online', 'number', true, false, '', 'info.status', printerwert);
                }            
            }
        }
    );

    // Funktion erneut nach x Sekunden aufrufen
    clearTimeout(tou4);
    tou4 = setTimeout(() => {
        refreshPrinterActive(tadapter, refreshtime);
    }, refreshtime);
    
}

// Softwareupdate für Server
async function serverUpdate(tadapter, refreshtime)
{
    // min. 1 Drucker muss vorhanden sein
    if (printercnt > 0){

        // ersten Drucker wählen
        printername = aprinter[0];

        // Abfrage und Auswertung
        await request(
            {
                url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + printername + '?a=updateAvailable&apikey=' + repetierApi,
                json: true
            },
            function (error, response, content){

                if (!error && response.statusCode == 200){

                    // Demovesion --> Server
                    printerwert = content.demo;
                    printerdatenpfad = serverpath + 'Demoversion';
                    DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Demoversion', 'boolean', true, false, '', 'info', printerwert);

                    // Softwareupdate vorhanden --> Server
                    printerwert = content.updateAvailable;
                    printerdatenpfad = serverpath + 'Update';
                    DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Softwareupdate vorhanden', 'boolean', true, false, '', 'info', printerwert);

                }
            }
        );
    }

    // Funktion erneut nach x Sekunden aufrufen
    clearTimeout(tou3);
    tou3 = setTimeout(() => {
        serverUpdate(tadapter, refreshtime);
    }, refreshtime);

}

// Printerwerte aktualisieren
async function refreshState(tadapter, refreshtime){

    // Überhaupt Drucker vorhanden
    if (aprinter.length > 0){

        // über alle Drucker
        for (let p = 0; p < printercnt; p++) {

            // Printername
            printername = aprinter[p];

            // Abfrage und Auswertung
            await request(
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
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Firmware des Druckers', 'string', true, false, '', 'info', printerwert);
                            
                            // Anzahl Extruder --> Info
                            printerwert = content[printername].extruder.length;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Info.Extruderanzahl';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Anzahl der Extruder', 'number', true, false, '', 'info', printerwert);

                            // Anzahl Heizbeden --> Info
                            printerwert = content[printername].heatedBeds.length;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Info.Heizbedanzahl';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Anzahl der Heizbeden', 'number', true, false, '', 'info', printerwert);

                            // Anzahl Lüfter --> Info
                            printerwert = content[printername].fans.length; 
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Info.Lüfteranzahl';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Anzahl der Lüfter', 'number', true, false, '', 'info', printerwert);

                            // Anzahl Heizkammern --> Info
                            printerwert = content[printername].heatedChambers.length; 
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Info.Heizkammern';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Anzahl der Heizkammern', 'number', true, false, '', 'info', printerwert);

                            // X-Position --> Positionen
                            printerwert = content[printername].x;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Koordinaten.Position_X';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'X-Position', 'number', true, false, 'mm', 'value', printerwert.toFixed(3));
                            
                            // Y-Position --> Positionen
                            printerwert = content[printername].y;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Koordinaten.Position_Y';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Y-Position', 'number', true, false, 'mm', 'value', printerwert.toFixed(3));

                            // Z-Position --> Positionen
                            printerwert = content[printername].z;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Koordinaten.Position_Z';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Z-Position', 'number', true, false, 'mm', 'value', printerwert.toFixed(3));

                            // X-Homing --> Homing
                            printerwert = content[printername].hasXHome;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Homing.Achse_X';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Referenzfahrt X-Achse erfolgt', 'boolean', true, false, '', 'value', printerwert);

                            // Y-Homing --> Homing
                            printerwert = content[printername].hasYHome;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Homing.Achse_Y';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Referenzfahrt Y-Achse erfolgt', 'boolean', true, false, '', 'value', printerwert);

                            // Z-Homing --> Homing
                            printerwert = content[printername].hasZHome;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Homing.Achse_Z';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Referenzfahrt Z-Achse erfolgt', 'boolean', true, false, '', 'value', printerwert);

                            // Druckertür --> Status
                            printerwert = content[printername].doorOpen;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Status.Tür_geöffnet';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Tür zum Drucker geöffnet', 'boolean', true, false, '', 'value', printerwert);

                            // Power Ein (M80) --> Status
                            printerwert = content[printername].powerOn;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Status.Power_Ein';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Power (M80) eingeschaltet', 'boolean', true, false, '', 'switch.power', printerwert);

                            // Lichter --> Status
                            printerwert = content[printername].lights;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.Status.Lichter';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Lichter eingeschaltet (Versuch)', 'number', true, false, '', 'value', printerwert);

                            // TemperaturIstWerte der Extruder übergeben
                            for (i=0 ; i < content[printername].extruder.length; i++){
                                printerwert = content[printername].extruder[i].tempRead;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Istwerte.Extruder_' + (i+1) +'_Temperatur';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Temperaturwert Extruder ' + (i + 1), 'number', true, false, '°C', 'value.temperature', printerwert.toFixed(1));
                            }

                            // HeizleistungIstWerte der Extruder übergeben
                            for (i=0 ; i < content[printername].extruder.length; i++){
                                printerwert = content[printername].extruder[i].output;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Istwerte.Extruder_' + (i+1) +'_Heizleistung';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Heizleistung Extruder ' + (i + 1), 'number', true, false, '%', 'value.value', printerwert.toFixed(0));
                            }

                            // TemperaturSollWerte der Extruder übergeben
                            for (i=0 ; i < content[printername].extruder.length; i++){
                                printerwert = content[printername].extruder[i].tempSet;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Sollvorgaben.Extruder_' + (i+1) +'_Temperatur';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Solltemperatur Extruder ' + (i + 1), 'number', true, false, '°C', 'value.temperature.setpoint', printerwert);
                            }

                            // TemperaturIstWerte der Heizbeden übergeben
                            for (i=0 ; i < content[printername].heatedBeds.length; i++){
                                printerwert = content[printername].heatedBeds[i].tempRead;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Istwerte.Heizbed_' + (i+1) +'_Temperatur';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Temperaturwert Heizbed ' + (i + 1), 'number', true, false, '°C', 'value.temperature', printerwert.toFixed(1));
                            }

                            // HeizleistungIstWerte der Heizbeden übergeben
                            for (i=0 ; i < content[printername].heatedBeds.length; i++){
                                printerwert = content[printername].heatedBeds[i].output;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Istwerte.Heizbed_' + (i+1) +'_Heizleistung';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Heizleistung Heizbed ' + (i + 1), 'number', true, false, '%', 'value.value', printerwert.toFixed(0));
                            }

                            // TemperaturSollWerte der Heizbeden übergeben
                            for (i=0 ; i < content[printername].heatedBeds.length; i++){
                                printerwert = content[printername].heatedBeds[i].tempSet;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Sollvorgaben.Heizbed_' + (i+1) +'_Temperatur';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Solltemperatur Heizbed ' + (i + 1), 'number', true, false, '°C', 'value.temperature.setpoint', printerwert);
                            }
                            
                            // TemperaturIstWerte der Heizkammern übergeben
                            for (i=0 ; i < content[printername].heatedChambers.length; i++){
                                printerwert = content[printername].heatedChambers[i].tempRead;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Istwerte.Heizkammer_' + (i+1) +'_Temperatur';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Temperaturwert Heizkammer ' + (i + 1), 'number', true, false, '°C', 'value.temperature', printerwert.toFixed(1));
                            }

                            // HeizleistungIstWerte der Heizkammern übergeben
                            for (i=0 ; i < content[printername].heatedChambers.length; i++){
                                printerwert = content[printername].heatedChambers[i].output;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Istwerte.Heizkammer_' + (i+1) +'_Heizleistung';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Heizleistung Heizkammer ' + (i + 1), 'number', true, false, '%', 'value.value', printerwert.toFixed(0));
                            }

                            // TemperaturSollWerte der Heizkammern übergeben
                            for (i=0 ; i < content[printername].heatedChambers.length; i++){
                                printerwert = content[printername].heatedChambers[i].tempSet;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Sollvorgaben.Heizkammer_' + (i+1) +'_Temperatur';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Solltemperatur Heizkammer ' + (i + 1), 'number', true, false, '°C', 'value.temperature.setpoint', printerwert.toFixed(0));
                            }

                            // Lüfter Ein übergeben
                            for (i=0 ; i < content[printername].fans.length; i++){
                                printerwert = content[printername].fans[i].on;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Status.Lüfter_' + (i+1) +'_Eingeschaltet';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Lüfter ' + (i + 1) + ' eingeschaltet', 'boolean', true, false, '', 'switch.power', printerwert);
                            }

                            // Lüfter Output übergeben
                            for (i=0 ; i < content[printername].fans.length; i++){
                                printerwert = content[printername].fans[i].voltage;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Istwerte.Lüfter_' + (i+1) +'_Drehzahl';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Lüfter ' + (i + 1) + ' Drehzahl in %', 'number', true, false, '%', 'value.value', ((printerwert/255)*100).toFixed(0));
                            }

                            // Materialfluss % --> PrintJob
                            printerwert = content[printername].flowMultiply;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Materialfluss';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Materialfluss in %', 'number', true, false, '%', 'value.flow', printerwert.toFixed(0));

                            // Druckgeschwindigkeit % --> PrintJob
                            printerwert = content[printername].speedMultiply;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Druckgeschwindigkeit';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Druckgeschwindigkeit in %', 'number', true, false, '%', 'value.speed', printerwert.toFixed(0));

                            // Aktueller Layer --> PrintJob
                            printerwert = content[printername].layer;
                            printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Layer_Aktuell';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Layer wird aktuell erstellt', 'number', true, false, '', 'value', printerwert);

                        }
                    }
                }
            );
        }
    }

    // Funktion erneut nach x Sekunden aufrufen
    clearTimeout(tou5);
    tou5 = setTimeout(() => {
        refreshState(tadapter, refreshtime);
    }, refreshtime);
}

// PrintJob-Daten aktualisieren
async function refreshPrintJob(tadapter, refreshtime)
{
    if (aprinter.length > 0){

        // Über alle Printer
        for (let p = 0; p < printercnt; p++) {

            // Printername 
            printername = aprinter[p];

            // Abfrage und Auswertung
            await request(
                {
                    url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + printername + '?a=listPrinter&data&apikey=' + repetierApi,
                    json: true
                },

                function (error, response, content){
            
                    if (!error && response.statusCode == 200){
                    
                        if (content && content.hasOwnProperty(0)){

                            //Wenn nicht gedruckt wird, keine Anfrage der Zeiten, da im JSON nicht vorhanden
                            if(content[0].job !== 'none'){

                                // Druckteilname --> PrintJob
                                printerwert = content[0].job;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Druckteilname';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Name des Druckteils', 'string', true, false, '', 'info.name', printerwert);
                                
                                // Druckbeginn --> PrintJob
                                printerwert = new Date(content[0].printStart * 1000);
                                tStd = ('00' + printerwert.getHours().toString()).substr(-2);
                                tMin = ('00' + printerwert.getMinutes().toString()).substr(-2);
                                printerwert = tStd + ':' + tMin;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Uhrzeit_Start';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Uhrzeit bei Druckstart', 'string', true, false, 'Uhr', 'info.time', printerwert);

                                // Gesamtdruckzeit --> PrintJob
                                printerwert =  Math.round (1 * content[0].printTime / 60);
                                tStd = (Math.floor(printerwert / 60));
                                tMin = (printerwert - (tStd * 60));
                                tStd = ('00' + tStd.toString()).substr(-2);
                                tMin = ('00' + tMin.toString()).substr(-2);
                                printerwert = tStd + ':' + tMin;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Gesamtdruckzeit';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Gesamtdruckzeit', 'string', true, false, 'Std.', 'info.time', printerwert);

                                // Restzeit --> PrintJob
                                printerwert = Math.round ((1 * content[0].printTime.toFixed(2) / 60)-(1 * content[0].printedTimeComp / 60));
                                tRStd = (Math.floor(printerwert / 60));
                                tRMin = (printerwert - (tRStd * 60));
                                tStd = ('00' + tRStd.toString()).substr(-2);
                                tMin = ('00' + tRMin.toString()).substr(-2);
                                printerwert = tStd + ':' + tMin;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Restzeit';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Restzeit bis Druckende', 'string', true, false, 'Std.', 'info.time', printerwert);

                                // Fertigzeit --> PrintJob
                                printerwert = new Date();
                                printerwert.setHours(printerwert.getHours() + tRStd);
                                printerwert.setMinutes(printerwert.getMinutes() + tRMin);
                                tStd = ('00' + printerwert.getHours().toString()).substr(-2);
                                tMin = ('00' + printerwert.getMinutes().toString()).substr(-2);
                                printerwert = tStd + ':' + tMin;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Uhrzeit_Fertig';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Uhrzeit wenn Druck fertig', 'string', true, false, 'Uhr', 'info.time', printerwert);

                                // Fortschritt in % --> PrintJob
                                printerwert = content[0].done.toFixed(2);
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Druckfortschritt';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Druckfortschritt in %', 'string', true, false, '%', 'info.status', printerwert);

                                // Anzahl Layer --> PrintJob
                                printerwert = content[0].ofLayer;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Layer_Gesamt';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Anzahl der Layer', 'number', true, false, '', 'info.status', printerwert);

                                // Anzahl Lines --> PrintJob
                                printerwert = content[0].totalLines;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Linien_Gesamt';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Gesamtanzahl der Linien', 'number', true, false, '', 'info.status', printerwert);

                                // Gesendete Lines --> PrintJob
                                printerwert = content[0].linesSend;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Linien_gesendet';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'An Drucker gesendete Linien', 'number', true, false, '', 'info.status', printerwert);

                                // Druckpause --> Status
                                printerwert = content[0].paused;
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Status.Druckpause';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Drucker im Pausenmodus', 'boolean', true, false, '', 'info.status', printerwert);

                                // Druck läuft --> PrintJob
                                if (content[0].done.toFixed(2) > 0){
                                    printerwert = true;
                                }
                                else{
                                    printerwert = false;
                                }
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Status.Drucker_druckt';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Drucker druckt', 'boolean', true, false, '', 'info.status', printerwert);
    
                            }

                            // Wenn Druckteil fertig, dann Zeiten/Werte löschen 
                            if(content[0].job === 'none'){

                                // Druckteilname --> PrintJob
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Druckteilname';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Name des Druckteils', 'string', true, false, '', 'info.name', '---');
                                
                                // Anzahl Layer --> PrintJob
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Layer_Gesamt';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Anzahl der Layer', 'number', true, false, '', 'info.status', 0);
                                                            
                                // Anzahl Lines --> PrintJob
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Linien_Gesamt';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Gesamtanzahl der Linien', 'number', true, false, '', 'info.status', 0);
                                
                                // Gesendete Lines --> PrintJob
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Linien_gesendet';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'An Drucker gesendete Linien', 'number', true, false, '', 'info.status', 0);
                                
                                // Druckpause --> Status
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Status.Druckpause';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Drucker im Pausenmodus', 'boolean', true, false, '', 'info.status', false);

                                // Gesamtdruckzeit
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Gesamtdruckzeit';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Gesamtdruckzeit', 'string', true, false, 'Std.', 'info.time', '--:--');
                                
                                // Uhrzeit Druckbeginn                                
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Uhrzeit_Start';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Uhrzeit bei Druckstart', 'string', true, false, 'Uhr', 'info.time', '--:--');

                                // Restzeit
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Restzeit';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Restzeit bis Druckende', 'string', true, false, 'Std.', 'info.time', '--:--');

                                // Uhrzeit Druckende
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Uhrzeit_Fertig';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Uhrzeit wenn Druck fertig', 'string', true, false, 'Uhr', 'info.time', '--:--');

                                // Fortschritt
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.PrintJob.Druckfortschritt';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Druckfortschritt in %', 'string', true, false, '%', 'info.status', '---');
                                printerdatenpfad = printerpath + 'Printer_' + printername + '.Status.Drucker_druckt';
                                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Drucker druckt', 'boolean', true, false, '', 'info.status', false);

                            }                                
                        }
                    }
                }
            );
        }
    }

    // Funktion erneut nach x Sekunden aufrufen
    clearTimeout(tou6);
    tou6 = setTimeout(() => {
        refreshPrintJob(tadapter, refreshtime);
    }, refreshtime);
}

// *********************
// Allgemeine Funktionen
// *********************

// Updatebutton anlegen und initialisieren
function PrinterUpdateButton(tadapter){

    // 'update_Printer' anlegen
    DatenAusgabe(tadapter, printerpath + 'Printer_update', 'state', 'update Printers', 'boolean', true, true, '', 'button', false); 
}


// Updatebutton anlegen und initialisieren
function PrinterMessage(tadapter, tMessage){

    // 'Message_Printer' anlegen
    DatenAusgabe(tadapter, printerpath + 'Nachricht', 'state', 'Message Printers', 'string', true, true, '', 'text', tMessage); 
}


// Datenübergabe an ioBroker 
function DatenAusgabe(tadapter, d_Pfad, d_Type, c_Name, c_Type, c_Read, c_Write, c_Unit, c_Role, d_Wert){
    tadapter.setObjectNotExists(d_Pfad,{
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
    tadapter.setState(d_Pfad, {val: d_Wert, ack: true});
}


// grobe G-Code-Überprüfung
function GCodeCheck(tadapter, G_Code){

    // Prüfen, og G-Code mit 'G', 'M', 'T', oder '@' beginnt
    if (G_Code.substr(0,1)=='G' || G_Code.substr(0,1)=='M' || G_Code.substr(0,1)=='T' || G_Code.substr(0,1)=='@'){
        PrinterMessage(tadapter, 'G-Code übernommen');
        return true;    // Prüfung bestanden, dann 'true' zurück
    }
    else
    {
        PrinterMessage(tadapter, rGcodeUnbekannt);
        return false;   // sonst 'false' als Rückgabewert
    }
}