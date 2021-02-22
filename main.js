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
//const fs = require('fs');

// Adapterparameter
let repetierIP = '' ;
let repIPOK = false ;
let repetierPort = '' ;
let repPortOK = false ;
let repetierApi = '' ;
let repApiKeyOK = false ;
let repetierModel = false;
let repetierDelPri = false;

// Datenübergabevariablen
let printerwert ;
let printerdatenpfad = '' ;

// Allgemeine Hilfsvariablen
let i = 0 ;
let debug = false;

// Sprachauswahl
let sprachen = {0:'en', 1:'de', 2:'ru', 3:'pt', 4:'nl', 5:'fr', 6:'it', 7:'es', 8:'pl', 9:'zh-cn'};
let langnr = 1;  // 1 = de
let alang ;      // Array für Text
let sprachwechselaktiv = false; // Variable vorbelegen
let sprachwechsel = false;

// Sparachen einlesen
let tdata = require('./languages.json')
alang = JSON.parse(JSON.stringify (tdata));

// Variablen für TimeOut-IDs
let tou1 ;
let tou2 ;
let tou3 ;
let tou4 ;
let tou5 ;
let tou6 ;
let tou7 ;
let tou8 ;
let tou9 ;
let tou10 ;

// Statusvariablen für schnelle Reaktionen
const aprinterAktiv = new Array;  // (Printer, aktiv)
const aprinterDruckt = new Array; // (Printer, druckt)
let serveronline = false;         // Repetierserver online

// interne Druckerübersicht/Druckerauswertung
const aprinter = new Array;
let printerauswertung = false ;

// Druckmodelle
const amodelle = new Array;      // (Printer, ID, Name, intNr, Gruppe)
const aaktdruckid = new Array;   // (Printer, aktID)

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
    onReady(callback) {

        // Initialisierung
        // Sprachen
        Language(this, langnr);

        // Adapterwert 'info.connection' übergeben
        this.setState('info.connection', true, true);
    
	    // Meldung ausgeben
	    //this.log.info(alang[0][sprachen[langnr]]);
        this.log.info("Repetierserver verbunden")
        
        // *******************
        // Adapterwerte prüfen
        // *******************
        
        // Adapterwerte übergeben
        repetierIP = this.config.repIP;
        repetierPort = this.config.repPort;
        repetierApi = this.config.repApiKey;
        repetierModel = this.config.repModel;
        //repetierDelPri = this.config.repDelPri;

        // IP-Adresse prüfen
        if(repetierIP == '' || repetierIP == '0.0.0.0'){
            this.log.info(alang[4][sprachen[langnr]] + ' ' + repetierIP);
            this.log.info(alang[5][sprachen[langnr]]);
            this.setState('info.connection', false, false);
            repIPOK = false;
        }
        else {
            repIPOK = true;
            this.log.info(alang[4][sprachen[langnr]] + ' ' + repetierIP);
        }

        // ApiKey prüfen
        if(repetierApi == ''){
            this.log.info(alang[6][sprachen[langnr]]);
            this.setState('info.connection', false, false);
            repApiKeyOK = false;
        }
        else {
            repApiKeyOK = true;
            this.log.info(alang[7][sprachen[langnr]] + ' ' + repetierApi);
        }

        // Port prüfen --> Defaultwert für Port übergeben, falls keine Angabe
        if(repetierPort == ''){
            repetierPort = '3344';
            this.log.info(alang[8][sprachen[langnr]]);
            repPortOK = true;
        }
        else {
            repPortOK = true;
            this.log.info(alang[9][sprachen[langnr]] + ' ' + repetierPort);
        }
  
        // In Repetierserver gelöschte Drucker automatisch im ioBroker entfernen
        //if (!repetierDelPri){
        //    repetierDelPri = false;
        //    this.log.info("automatische Druckerbereinigung deaktiviert"); // 10
        //}
        //else{
        //    this.log.info("automatische Druckerreinigung aktiviert"); //11
        //}
        //repetierDelPri = true;

        // Modul-Management prüfen
        if (!repetierModel){
            repetierModel = false;
        }

        //repetierModel = true;

        if (repetierModel == true){
            this.log.info(alang[12][sprachen[langnr]]);
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

            // Alle Timer für Zeitsteuerungen löschen
            clearTimeout(tou1);
            clearTimeout(tou2);
            clearTimeout(tou3);
            clearTimeout(tou4);
            clearTimeout(tou5);
            clearTimeout(tou6);
            clearTimeout(tou7);
            clearTimeout(tou8);
            clearTimeout(tou9);
            clearTimeout(tou10);

            // Arrays löschen
            aprinterAktiv.splice(0);
            aprinterDruckt.splice(0);
            aprinter.splice(0);
            amodelle.splice(0);
            aaktdruckid.splice(0);

            // info-Ausgabe
            this.log.info(alang[13][sprachen[langnr]]);

            // info.connection zurücksetzen
            this.setState('info.connection', false, false);

            // info.active zurücksetzen
            this.setState('info.active', {val: '', ack: true});

            // info.printjob zurücksetzen
            this.setState('info.printjob', {val: '', ack: true});

            // Infos ausgeben
            this.log.info("Repetier-Server-Verbindung beendet ..."); //14
            this.log.info("Repetier-Server-Dienst gestoppt ..."); //15
            
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
            let tprintername = '';
            const tmp = id.split('.');

            // Printername vorhanden
            if (tmp.length > 3) {

                // Printername auswerten
                if (tmp[3].search('rinter_') > 0 || tmp[3].search('pdate_Printer') > 0 || tmp[2] == 'info'){  // --> Printer ohne 'P', damit search > 0 sein kann    
                    
                    // Printername aufbauen
                    tprintername = tmp[3].replace('Printer_', '');
                        
                    // Welcher Steuerbefehl des Printers wurde geändert 
                    switch(true){

                    // Druck Stopp
                    case (id.search('Steuern.Signale.Stopp') > 0 && state.val == true):
                        request(
                            {
                                url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + tprintername + '?a=stopJob&apikey=' + repetierApi,
                            },    
                        );
                        this.setState(id, {val: false, ack: true});
                        
                        break;

                    // Drucker NOT-STOP
                    case (id.search('Steuern.Signale.NOTSTOP') > 0 && state.val == true):
                        request(
                            {
                                url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + tprintername + '?a=emergencyStop&apikey=' + repetierApi,
                            },    
                        );
                        this.setState(id, {val: false, ack: true});
                        
                        break;

                        // Printer Aktivieren
                    case (id.search('Steuern.Signale.Aktivieren') > 0 && state.val == true):
                        request(
                            {
                                url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + tprintername + '?a=activate&data={"printer":"' + tprintername + '"}&apikey=' + repetierApi,
                            },    
                        );
                        this.setState(id, {val: false, ack: true});
                        
                        break; 

                    // Printer Deaktivieren
                    case (id.search('Steuern.Signale.Deaktivieren') > 0 && state.val == true):
                        request(
                            {
                                url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + tprintername + '?a=deactivate&data={"printer":"' + tprintername + '"}&apikey=' + repetierApi,
                            },    
                        );
                        this.setState(id, {val: false, ack: true});
                        
                        break;

                    // Druck Pause
                    case (id.search('Steuern.Signale.Pause') > 0 && state.val == true):
                        request(
                            {
                                url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + tprintername + '?a=send&data={"cmd":"@pause"}&apikey=' + repetierApi,
                            },    
                        );
                        this.setState(id, {val: false, ack: true});
                        
                        break;
                    
                    // Druck fortsetzen
                    case (id.search('Steuern.Signale.Fortsetzen') > 0 && state.val == true):
                        request(
                            {
                                url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + tprintername + '?a=continueJob&apikey=' + repetierApi,
                            },    
                        );
                        this.setState(id, {val: false, ack: true});
                        
                        break;

                    // Manueller G-Code-Befehl
                    case (id.search('Befehl.G_Code') > 0 && state.val != '' && state.val != alang[41][sprachen[langnr]]):
                        // Befehl ist korrekt --> dann übergeben
                        if (GCodeCheck(state.val) == true){
                            request(
                                {
                                    url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + tprintername + '?a=send&data={"cmd":"'+ state.val + '"}&apikey=' + repetierApi,
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
                                url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + tprintername + '?a=setFlowMultiply&data={"speed":"'+ state.val + '"}&apikey=' + repetierApi,
                            },    
                        );

                        break;

                    // Druckgeschwindigkeit ändern (10% - 300%)
                    case (id.search('Steuern.Werte.Druckgeschwindigkeit') > 0 && (state.val >= 10) && (state.val <=300)):
                        request(
                            {
                                url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + tprintername + '?a=setSpeedMultiply&data={"speed":"'+ state.val + '"}&apikey=' + repetierApi,
                            },    
                        );

                        break;

                    // Drucker aktiviert/deaktiviert
                    case (id.search('Status.Aktiviert') > 0 ):

                        // info.activeprinter neu ausgeben
                        infoprinter(this);

                        break;

                    // Druckmodelle updaten
                    case (id.search('PrintModel.Update') > 0 && state.val == true):
                        
                        // Modelle neu einlesen
                        refreshModel(this, tprintername, 2000);

                        break;

                    // akt. Druckmodel
                    case (id.search('PrintModel.Modelle') > 0 && state.val >= 0):

                        // Printernummer suchen
                        for (let p = 0; p < amodelle.length; p++) {
                            if (amodelle[p]["Printer"] == tprintername && amodelle[p]["intNr"] == state.val){

                                // Modelname in Beschreibung des Startbuttons schreiben
                                printerdatenpfad = printerpath + 'Printer_' + tprintername + '.Steuern.Signale.Start';
                                let objName = "PrintJob starten" + ' (' + amodelle[p]["Gruppe"] + '/' + amodelle[p]["Name"] + ')' //42
                                this.setObjectNotExists(printerdatenpfad,{
                                    type: 'state',
                                    common:
                                    {
                                        name:   objName,
                                        type:   'boolean',
                                        read:   true,
                                        write:  true,
                                        role:   'button'
                                    },
                                    native: {}
                                });
                                this.extendObject(printerdatenpfad,{common: {name: objName}});

                                // Meldung ausgeben
                                this.log.info("3D-Modell" + amodelle[p]["Gruppe"] + '/' + amodelle[p]["Name"] + ' ' + "3D-Modell" + ' >' + tprintername + '<'); //43
                                PrinterMessage(this, "3D-Modell" + amodelle[p]["Gruppe"] + '/' + amodelle[p]["Name"] + ' ' + "3D-Modell" + ' >' + tprintername + '<'); //43

                                // aktive ModelID setzen
                                SetModelIDPrinter(tprintername, amodelle[p]['ID'])

                                break;
                            }
                        }

                        break;

                    // Druckstarten
                    case (id.search('Steuern.Signale.Start') > 0 && state.val == true):
                        
                        // druckerbezogene Statuswerte holen
                        let paktiv = GetPrinterAktiv(tprintername);
                        let pdruck = GetPrinterPrinted(tprintername);
                        
                        // Drucknur möglich wenn Drucker aktivier und nicht druckt
                        if (paktiv == true && pdruck == false){
                           
                            // Funktion ausfrufen
                            PrinterStart(this, tprintername, 2000);
                        }

                        // info.activeprinter neu ausgeben
                        infoprinter(this);

                        // state zurücksetzen
                        this.setState(id, {val: false, ack: true});

                        break;

                    // update_Printer - neu Printer vorhanden/gelöschte Drucker entfernen (ToDo)
                    case (id.search('Printer_update') > 0 && state.val == true):

                        // Printerauswertung zurücksetzen
                        printerauswertung = false;

                        // Meldung ausgeben
                        PrinterMessage(this, alang[44][sprachen[langnr]]); // 44

                        // Printerupdate durchführen
                        printerUpdate(this, 2000);

                        // state zurücksetzen
                        this.setState(id, {val: false, ack: true});
                    
                        break;
                
                    // update_Server - Serverinformationen aktualisieren (V0.0.5)
                    case (id.search('Server_update') > 0 && state.val == true):
                        
                        // Printerauswertung zurücksetzen
                        printerauswertung = false;

                        // Meldung ausgeben
                        PrinterMessage(this, alang[48][sprachen[langnr]]);

                        // Printerupdate durchführen
                        serverUpdate(this, 2000);

                        // state zurücksetzen
                        this.setState(id, {val: false, ack: true});
                    
                        break;

                    // Sprache wechseln
                    case (id.search('Language') > 0 && (state.val >= 0) && (state.val <=9) && sprachwechselaktiv == false):

                        if (langnr != state.val){
                            // Sprache wechseln
                            Language(this, state.val);

                            // Merker für Sprachwechsel setzen
                            Sprachwechsel(this, state.val);
                            PrinterKanaele(this, tprintername)

                            // Meldung ausgeben
                            PrinterMessage(this,alang[46][sprachen[langnr]]);

                            // bei allen Kanälen die Sprache wechseln

                            // neue Sprache merken
                            langnr = state.val;
                        }
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
    
    // Initialisierung
    // ===============

    // Sprachauswahl init
    //Language(tadapter, langnr);

    // PrinterUpdate Button
    PrinterUpdateButton(tadapter);

    // PrinterUpdate Button
    ServerUpdateButton(tadapter);

    // PrinterUpdate (alle 20 Min.) Timer-ID: tou1
    // Diese Funktion muss vor den folgenden Funktion kompett durchlaufen sein
    // Die Variable "printerauswertung" wird hierzu verwendet
    printerUpdate(tadapter, 120000);
     
    // Serverstatus (alle 5 Min.) Timer-ID: tou2
    refreshServer(tadapter, 300000);

    // Refresh ServerUpdate (1x am Tag) Timer-ID: tou3
    serverUpdate(tadapter, 86400000);

    // Refresh Printer aktiv (alle 5 Sek.) Timer-ID: tou4
    refreshPrinterActive(tadapter, 5000);

    // PrinterMessage
    PrinterMessage(tadapter, '');

    // PrinterStatus (alle 2 Sek.) Timer-ID:tou5
    refreshState(tadapter, 2500);

    // Refresh PrintJob (alle 5 Sek.) Timer-ID: tou6
    refreshPrintJob(tadapter, 5000);

    // 3D Model Management aktiviert
    // =============================

    // Startbutton verteilen wenn aktiv, entfernen wenn inaktiv
    PrinterModelButtons(tadapter, repetierModel, 2000);

    // Modelle initial einlesen, wenn aktiv
    RefreshModelInit(tadapter, repetierModel,2000);

}

// *****************
// Printerfunktionen
// *****************

// neue oder gelöschte Printer
function printerUpdate(tadapter, refreshtime){
 
    // Variable für Printeranzahl
    let fprintercnt = 0;
    let fprintername = '';
    let erl = false;

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
                fprintercnt = content.printers.length;

                // Alle Drucker einlesen
                for (let pp = 0; pp < fprintercnt; pp++) {

                    // Druckername
                    //printername = content.printers[p].slug;

                    // Array aprinter füllen
                    aprinter[pp] = content.printers[pp].slug;

                    // über alle Printer
                    for (let p = 0; p < fprintercnt; p++) {

                        // Printername 
                        fprintername = aprinter[p];

                        if (fprintername){

                            // Kanal anlegen/pflegen
                            PrinterKanaele(tadapter, fprintername)
                            //printerdatenpfad = printerpath + 'Printer_' + fprintername;
                            //SetKanal(tadapter, printerdatenpfad, 'Printer ' + fprintername);

                            // Drucker aktivieren
                            printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Steuern.Signale.Aktivieren';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Drucker aktivieren', 'boolean', true, true, '', 'button', false);
                
                            // Drucker deaktivieren
                            printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Steuern.Signale.Deaktivieren';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Drucker deaktivieren', 'boolean', true, true, '', 'button', false);
                    
                            // Drucker PrintJob Stop
                            printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Steuern.Signale.Stopp';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'PrintJob stoppen', 'boolean', true, true, '', 'button', false);

                            // Drucker NOT-STOP
                            printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Steuern.Signale.NOTSTOP';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', '>>>>> NOT-STOP <<<<<', 'boolean', true, true, '', 'button', false);
                            
                            // Drucker PrintJob Pause
                            printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Steuern.Signale.Pause';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'PrintJob Pause', 'boolean', true, true, '', 'button', false);
                            
                            // Drucker PrintJob Fortsetzen
                            printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Steuern.Signale.Fortsetzen';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'PrintJob fortsetzen', 'boolean', true, true, '', 'button', false); 

                            // Manueller G-Code Befehl
                            printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Befehl.G_Code';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Manueller G-Code', 'string', true, true, '', 'text.command', ''); 

                            // Materialfluss ändern (10% - 200%)
                            printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Steuern.Werte.Materialfluss';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Materialfluss ändern', 'number', true, true, '%', 'value', 100); 

                            // Druckgeschwindigkeit ändern (10% - 300%)
                            printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Steuern.Werte.Druckgeschwindigkeit';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Druckgeschwindigkeit ändern', 'number', true, true, '%', 'value', 100); 
                
                        }
                    }

                    // angelegte Drucker einlesen und in Repetierserver gelöschte Drucker automatisch entfernen
                    if (repetierDelPri == true){
                        let tpfad = printerpath.substring(0, printerpath.length - 1);
                        tadapter.getChannels (tpfad, function (err, obj) {

                            if (err) {
                    
                                tadapter.log.error(err);
                    
                            } else {
                                // alle Drucker im Repetier-Server in eine Prüfstring schreiben
                                let tRSPrinter = '';
                                for (let pcp = 0; pcp < aprinter.length; pcp++) {
                                    tRSPrinter = tRSPrinter + '%&Printer_' + aprinter[pcp] + ',';                           
                                }
                                tRSPrinter = '.'+ tRSPrinter;

                                for (let pc = 0; pc < obj.length; pc++) {
                                    let tmp = obj[pc]._id.split('.');
                                    tmp = '%&' + tmp[3];

                                    // prüfen, welcher Drucker in Repetierserver entfernt wurde und nicht aufgeführt wird
                                    if (tmp != '%&Server'){
                                        if (tRSPrinter.search(tmp) > 0){
                                                
                                            tadapter.log.info(tmp);
                                            
                                        }
                                        else{
                                            tadapter.log.info(tmp + ' löschen');
                                        }
                                    }
                                }
                            }
                        });
                    }

                    // Message ausgeben
                    PrinterMessage(tadapter, 'Printerupdate durchgeführt');

                    // Auswertung merken
                    printerauswertung = true;

                    // Durchlauf erledigt
                    erl = true;
                }
            }
        }
    );
    
    //Funktion erneut nach x Sekunden aufrufen
    if (erl = false){
        clearTimeout(tou1);
        tou1 = setTimeout(() => {
            printerUpdate(tadapter, refreshtime);
        }, refreshtime);
    }
    else{
        clearTimeout(tou1);
    }

}

// Serverdaten aktualisieren
function refreshServer(tadapter, refreshtime){

    // Durchlauf erst nach Printerauswertung
    if (printerauswertung == true){

        // Abfrage und Auswertung
        request(
            {
                url:  'http://' + repetierIP + ':' + repetierPort + '/printer/info',
                json: true
            },

            function (error, response, content){
        
                if (!error && response.statusCode == 200){

                    // Abfrage Serverdaten
                    // Kanal anlegen/pflegen
                    printerdatenpfad = printerpath + 'Server';
                    SetKanal(tadapter, printerdatenpfad, 'Serverinformationen');

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
    }

    // Funktion erneut nach x Sekunden aufrufen
    clearTimeout(tou2);
    tou2 = setTimeout(() => {
        refreshServer(tadapter, refreshtime);
    }, refreshtime);
    
}

// Printerstatus aktualisieren und prüfen, ob Server online
function refreshPrinterActive(tadapter, refreshtime){

    // Hilfsvariablen
    let fprintername = '';

    // Durchlauf erst nach Printerauswertung
    if (printerauswertung == true){

        // Abfrage und Auswertung
        request(
            {
                url:  'http://' + repetierIP + ':' + repetierPort + '/printer/info',
                json: true
            },

            function (error, response, content){
        
                if (!error && response.statusCode == 200){
                
                    // Server erreichbar
                    serveronline = true; 
                    info(tadapter, serveronline);

                    // Alle Drucker einlesen
                    for (let p = 0; p < content.printers.length; p++) {

                        // Druckername
                        fprintername = content.printers[p].slug;

                        // Drucker aktiviert --> Drucker Status
                        printerwert = content.printers[p].active;
                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Status.Aktiviert';
                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Drucker aktiviert', 'boolean', true, false, '', 'info.status', printerwert);

                        // DruckerStatus in Array übergeben
                        SetPrinterAktiv(fprintername, printerwert);

                        // Drucker Online --> Drucker Status
                        printerwert=content.printers[p].online;
                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Status.Online';
                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Drucker Online', 'number', true, false, '', 'info.status', printerwert);
                    }            
                }
                // Server nicht erreichbar
                else{
                    serveronline = false;
                    info(tadapter, serveronline);
                }
            }
        );
    }

    // Funktion erneut nach x Sekunden aufrufen
    clearTimeout(tou4);
    tou4 = setTimeout(() => {
        refreshPrinterActive(tadapter, refreshtime);
    }, refreshtime);
 
}

// Softwareupdate für Server
function serverUpdate(tadapter, refreshtime){

    // Hilfsvariablen
    let fprintername = '';

    // Durchlauf erst nach Printerauswertung
    if (printerauswertung == true){

        // min. 1 Drucker muss vorhanden sein
        if (aprinter.length > 0){

            // ersten Drucker wählen
            fprintername = aprinter[0];

            // Printername vorhanden
            if (fprintername){

                // Abfrage und Auswertung
                request(
                    {
                        url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + fprintername + '?a=updateAvailable&apikey=' + repetierApi,
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
        }
    }

    // Funktion erneut nach x Sekunden aufrufen
    clearTimeout(tou3);
    tou3 = setTimeout(() => {
        serverUpdate(tadapter, refreshtime);
    }, refreshtime);
    
}

// Printerwerte aktualisieren
function refreshState(tadapter, refreshtime){
        
     // Hilfsvariablen
     let fprintername = '';

    // Durchlauf erst nach Printerauswertung
    if (printerauswertung == true){

        // Überhaupt Drucker vorhanden
        if (aprinter.length > 0){

            // über alle Drucker
            for (let p = 0; p < aprinter.length; p++) {

                // Printername
                fprintername = aprinter[p];

                // Printername vorhanden
                if(fprintername){

                    // Abfrage und Auswertung
                    request(
                        {
                            url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + fprintername + '?a=stateList&data&apikey=' + repetierApi,
                            json: true
                        },

                        function (error, response, content){
                        
                            if (!error && response.statusCode == 200){

                                // Printername aus Content suchen
                                for (let pp = 0; pp < aprinter.length; pp++){
                                    if (content.hasOwnProperty(aprinter[pp]) == true){
                                        // Printername übergeben
                                        fprintername = aprinter[pp];
                                        
                                        // gefunden -> raus
                                        break;  
                                    }
                                }

                                if (content && content.hasOwnProperty(fprintername)){
                    
                                    // temporäre Variable, ob Druck läuft
                                    let tdruck_laeuft = false;

                                    // Firmware --> Info
                                    printerwert = content[fprintername].firmware; 
                                    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Info.Firmware';
                                    DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Firmware des Druckers', 'string', true, false, '', 'info', printerwert);
                                    
                                    // Anzahl Extruder --> Info
                                    printerwert = content[fprintername].extruder.length;
                                    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Info.Extruderanzahl';
                                    DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Anzahl der Extruder', 'number', true, false, '', 'info', printerwert);

                                    // Anzahl Heizbeden --> Info
                                    printerwert = content[fprintername].heatedBeds.length;
                                    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Info.Heizbedanzahl';
                                    DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Anzahl der Heizbeden', 'number', true, false, '', 'info', printerwert);

                                    // Anzahl Lüfter --> Info
                                    printerwert = content[fprintername].fans.length; 
                                    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Info.Lüfteranzahl';
                                    DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Anzahl der Lüfter', 'number', true, false, '', 'info', printerwert);

                                    // Anzahl Heizkammern --> Info
                                    printerwert = content[fprintername].heatedChambers.length; 
                                    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Info.Heizkammern';
                                    DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Anzahl der Heizkammern', 'number', true, false, '', 'info', printerwert);

                                    // X-Position --> Positionen
                                    printerwert = content[fprintername].x;
                                    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Koordinaten.Position_X';
                                    DatenAusgabe(tadapter, printerdatenpfad, 'state', 'X-Position', 'number', true, false, 'mm', 'value', printerwert.toFixed(3));
                                    
                                    // Y-Position --> Positionen
                                    printerwert = content[fprintername].y;
                                    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Koordinaten.Position_Y';
                                    DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Y-Position', 'number', true, false, 'mm', 'value', printerwert.toFixed(3));

                                    // Z-Position --> Positionen
                                    printerwert = content[fprintername].z;
                                    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Koordinaten.Position_Z';
                                    DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Z-Position', 'number', true, false, 'mm', 'value', printerwert.toFixed(3));

                                    // X-Homing --> Homing
                                    printerwert = content[fprintername].hasXHome;
                                    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Homing.Achse_X';
                                    DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Referenzfahrt X-Achse erfolgt', 'boolean', true, false, '', 'value', printerwert);

                                    // Y-Homing --> Homing
                                    printerwert = content[fprintername].hasYHome;
                                    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Homing.Achse_Y';
                                    DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Referenzfahrt Y-Achse erfolgt', 'boolean', true, false, '', 'value', printerwert);

                                    // Z-Homing --> Homing
                                    printerwert = content[fprintername].hasZHome;
                                    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Homing.Achse_Z';
                                    DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Referenzfahrt Z-Achse erfolgt', 'boolean', true, false, '', 'value', printerwert);

                                    // Druckertür --> Status
                                    printerwert = content[fprintername].doorOpen;
                                    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Status.Tür_geöffnet';
                                    DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Tür zum Drucker geöffnet', 'boolean', true, false, '', 'value', printerwert);

                                    // Power Ein (M80) --> Status
                                    printerwert = content[fprintername].powerOn;
                                    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Status.Power_Ein';
                                    DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Power (M80) eingeschaltet', 'boolean', true, false, '', 'switch.power', printerwert);

                                    // Lichter --> Status
                                    printerwert = content[fprintername].lights;
                                    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Status.Lichter';
                                    DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Lichter eingeschaltet (Versuch)', 'number', true, false, '', 'value', printerwert);

                                    // Aktiver Extruder --> Status
                                    printerwert = content[fprintername].activeExtruder;
                                    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Status.Aktiver_Extruder';
                                    DatenAusgabe(tadapter, printerdatenpfad, 'state', 'aktuell aktiver Extruder', 'number', true, false, '', 'info.status', printerwert);

                                    // TemperaturIstWerte der Extruder übergeben
                                    for (i=0 ; i < content[fprintername].extruder.length; i++){
                                        printerwert = content[fprintername].extruder[i].tempRead;
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Istwerte.Extruder_' + (i+1) +'_Temperatur';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Temperaturwert Extruder ' + (i + 1), 'number', true, false, '°C', 'value.temperature', printerwert.toFixed(1));
                                    }

                                    // HeizleistungIstWerte der Extruder übergeben
                                    for (i=0 ; i < content[fprintername].extruder.length; i++){
                                        printerwert = content[fprintername].extruder[i].output;
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Istwerte.Extruder_' + (i+1) +'_Heizleistung';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Heizleistung Extruder ' + (i + 1), 'number', true, false, '%', 'value.value', printerwert.toFixed(0));
                                    }

                                    // TemperaturSollWerte der Extruder übergeben
                                    for (i=0 ; i < content[fprintername].extruder.length; i++){
                                        printerwert = content[fprintername].extruder[i].tempSet;
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Sollvorgaben.Extruder_' + (i+1) +'_Temperatur';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Solltemperatur Extruder ' + (i + 1), 'number', true, false, '°C', 'value.temperature.setpoint', printerwert);
                                    }

                                    // Fehlerstatus der Extruder übergeben --> Error
                                    for (i=0 ; i < content[fprintername].extruder.length; i++){
                                        printerwert = content[fprintername].extruder[i].error;
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Error.Extruder_' + (i+1) +'_Error';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Fehlerstatus Extruder ' + (i + 1), 'boolean', true, false, '', 'info.status', printerwert);
                                    }
                                    
                                    // TemperaturIstWerte der Heizbeden übergeben
                                    for (i=0 ; i < content[fprintername].heatedBeds.length; i++){
                                        printerwert = content[fprintername].heatedBeds[i].tempRead;
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Istwerte.Heizbed_' + (i+1) +'_Temperatur';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Temperaturwert Heizbed ' + (i + 1), 'number', true, false, '°C', 'value.temperature', printerwert.toFixed(1));
                                    }

                                    // HeizleistungIstWerte der Heizbeden übergeben
                                    for (i=0 ; i < content[fprintername].heatedBeds.length; i++){
                                        printerwert = content[fprintername].heatedBeds[i].output;
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Istwerte.Heizbed_' + (i+1) +'_Heizleistung';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Heizleistung Heizbed ' + (i + 1), 'number', true, false, '%', 'value.value', printerwert.toFixed(0));
                                    }

                                    // TemperaturSollWerte der Heizbeden übergeben
                                    for (i=0 ; i < content[fprintername].heatedBeds.length; i++){
                                        printerwert = content[fprintername].heatedBeds[i].tempSet;
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Sollvorgaben.Heizbed_' + (i+1) +'_Temperatur';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Solltemperatur Heizbed ' + (i + 1), 'number', true, false, '°C', 'value.temperature.setpoint', printerwert);
                                    }
                                    
                                    // Fehlerstatus der Heizbeden übergeben --> Error
                                    for (i=0 ; i < content[fprintername].heatedBeds.length; i++){
                                        printerwert = content[fprintername].heatedBeds[i].error;
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Error.Heizbed_' + (i+1) +'_Error';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Fehlerstatus Heizbed ' + (i + 1), 'boolean', true, false, '', 'info.status', printerwert);
                                    }

                                    // TemperaturIstWerte der Heizkammern übergeben
                                    for (i=0 ; i < content[fprintername].heatedChambers.length; i++){
                                        printerwert = content[fprintername].heatedChambers[i].tempRead;
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Istwerte.Heizkammer_' + (i+1) +'_Temperatur';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Temperaturwert Heizkammer ' + (i + 1), 'number', true, false, '°C', 'value.temperature', printerwert.toFixed(1));
                                    }

                                    // HeizleistungIstWerte der Heizkammern übergeben
                                    for (i=0 ; i < content[fprintername].heatedChambers.length; i++){
                                        printerwert = content[fprintername].heatedChambers[i].output;
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Istwerte.Heizkammer_' + (i+1) +'_Heizleistung';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Heizleistung Heizkammer ' + (i + 1), 'number', true, false, '%', 'value.value', printerwert.toFixed(0));
                                    }

                                    // TemperaturSollWerte der Heizkammern übergeben
                                    for (i=0 ; i < content[fprintername].heatedChambers.length; i++){
                                        printerwert = content[fprintername].heatedChambers[i].tempSet;
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Sollvorgaben.Heizkammer_' + (i+1) +'_Temperatur';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Solltemperatur Heizkammer ' + (i + 1), 'number', true, false, '°C', 'value.temperature.setpoint', printerwert.toFixed(0));
                                    }

                                    // Lüfter Ein übergeben
                                    for (i=0 ; i < content[fprintername].fans.length; i++){
                                        printerwert = content[fprintername].fans[i].on;
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Status.Lüfter_' + (i+1) +'_Eingeschaltet';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Lüfter ' + (i + 1) + ' eingeschaltet', 'boolean', true, false, '', 'switch.power', printerwert);
                                    }

                                    // Lüfter Output übergeben
                                    for (i=0 ; i < content[fprintername].fans.length; i++){
                                        printerwert = content[fprintername].fans[i].voltage;
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Istwerte.Lüfter_' + (i+1) +'_Drehzahl';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Lüfter ' + (i + 1) + ' Drehzahl in %', 'number', true, false, '%', 'value.value', ((printerwert/255)*100).toFixed(0));
                                    }

                                    // Materialfluss % --> PrintJob
                                    printerwert = content[fprintername].flowMultiply;
                                    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintJob.Materialfluss';
                                    DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Materialfluss in %', 'number', true, false, '%', 'value.flow', printerwert.toFixed(0));

                                    // Druckgeschwindigkeit % --> PrintJob
                                    printerwert = content[fprintername].speedMultiply;
                                    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintJob.Druckgeschwindigkeit';
                                    DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Druckgeschwindigkeit in %', 'number', true, false, '%', 'value.speed', printerwert.toFixed(0));

                                    // prüfen, ob Druck läuft
                                    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Status.Drucker_druckt';
                                    tadapter.getState(printerdatenpfad, function(err, state){
                                        tdruck_laeuft = state.val

                                        // aktuell läuft ein Druck
                                        if (tdruck_laeuft == true){

                                            // Aktueller Layer --> PrintJob
                                            printerwert = content[fprintername].layer;
                                            printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintJob.Layer_Aktuell';
                                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Layer wird aktuell erstellt', 'number', true, false, '', 'value', printerwert);
                                        }
                                    });              
                                }
                            }
                        }
                    );
                }
            }
        } 
    }

    // Funktion erneut nach x Sekunden aufrufen
    clearTimeout(tou5);
    tou5 = setTimeout(() => {
        refreshState(tadapter, refreshtime);
    }, refreshtime);

}

// PrintJob-Daten aktualisieren
function refreshPrintJob(tadapter, refreshtime){
    
    // Hilfsvariablen
    let tStd = '' ; 
    let tMin = '' ;
    let tRStd = '';
    let tRMin = '';
    let fprintername = '';

    // Durchlauf erst nach Printerauswertung
    if (printerauswertung == true){

        // Mehr als 1 Printer vorhanden
        if (aprinter.length > 0){

            // Über alle Printer
            for (let p = 0; p < aprinter.length; p++) {

                // Printername 
                fprintername = aprinter[p];

                // Printername vorhanden
                if (fprintername){
                
                    // Abfrage und Auswertung
                    request(
                        {
                            url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + fprintername + '?a=listPrinter&data&apikey=' + repetierApi,
                            json: true
                        },

                        function (error, response, content){
                    
                            if (!error && response.statusCode == 200){
                            
                                if (content && content.hasOwnProperty(0)){
                                    
                                    // Printername aus Content übernehmen
                                    fprintername = content[0].name;

                                    //Wenn nicht gedruckt wird, keine Anfrage der Zeiten, da im JSON nicht vorhanden
                                    if(content[0].job !== 'none'){

                                        // Druckteilname --> PrintJob
                                        printerwert = content[0].job;
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintJob.Druckteilname';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Name des Druckteils', 'string', true, false, '', 'info.name', printerwert);
                                        
                                        // Druckbeginn --> PrintJob
                                        printerwert = new Date(content[0].printStart * 1000);
                                        tStd = ('00' + printerwert.getHours().toString()).substr(-2);
                                        tMin = ('00' + printerwert.getMinutes().toString()).substr(-2);
                                        printerwert = tStd + ':' + tMin;
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintJob.Uhrzeit_Start';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Uhrzeit bei Druckstart', 'string', true, false, 'Uhr', 'info.time', printerwert);

                                        // Gesamtdruckzeit --> PrintJob
                                        printerwert =  Math.round (1 * content[0].printTime / 60);
                                        tStd = (Math.floor(printerwert / 60));
                                        tMin = (printerwert - (tStd * 60));
                                        tStd = ('00' + tStd.toString()).substr(-2);
                                        tMin = ('00' + tMin.toString()).substr(-2);
                                        printerwert = tStd + ':' + tMin;
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintJob.Gesamtdruckzeit';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Gesamtdruckzeit', 'string', true, false, 'Std.', 'info.time', printerwert);

                                        // Restzeit --> PrintJob
                                        printerwert = Math.round ((1 * content[0].printTime.toFixed(2) / 60)-(1 * content[0].printedTimeComp / 60));
                                        tRStd = (Math.floor(printerwert / 60));
                                        tRMin = (printerwert - (tRStd * 60));
                                        tStd = ('00' + tRStd.toString()).substr(-2);
                                        tMin = ('00' + tRMin.toString()).substr(-2);
                                        printerwert = tStd + ':' + tMin;
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintJob.Restzeit';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Restzeit bis Druckende', 'string', true, false, 'Std.', 'info.time', printerwert);

                                        // Fertigzeit --> PrintJob
                                        printerwert = new Date();
                                        printerwert.setHours(printerwert.getHours() + tRStd);
                                        printerwert.setMinutes(printerwert.getMinutes() + tRMin);
                                        tStd = ('00' + printerwert.getHours().toString()).substr(-2);
                                        tMin = ('00' + printerwert.getMinutes().toString()).substr(-2);
                                        printerwert = tStd + ':' + tMin;
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintJob.Uhrzeit_Fertig';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Uhrzeit wenn Druck fertig', 'string', true, false, 'Uhr', 'info.time', printerwert);

                                        // Fortschritt in % --> PrintJob
                                        printerwert = content[0].done.toFixed(2);
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintJob.Druckfortschritt';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Druckfortschritt in %', 'string', true, false, '%', 'info.status', printerwert);

                                        // Anzahl Layer --> PrintJob
                                        printerwert = content[0].ofLayer;
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintJob.Layer_Gesamt';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Anzahl der Layer', 'number', true, false, '', 'info.status', printerwert);

                                        // Anzahl Lines --> PrintJob
                                        printerwert = content[0].totalLines;
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintJob.Linien_Gesamt';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Gesamtanzahl der Linien', 'number', true, false, '', 'info.status', printerwert);

                                        // Gesendete Lines --> PrintJob
                                        printerwert = content[0].linesSend;
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintJob.Linien_gesendet';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'An Drucker gesendete Linien', 'number', true, false, '', 'info.status', printerwert);

                                        // Druckpause --> Status
                                        printerwert = content[0].paused;
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Status.Druckpause';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Drucker im Pausenmodus', 'boolean', true, false, '', 'info.status', printerwert);

                                        // Druck läuft --> PrintJob
                                        if (content[0].done.toFixed(2) > 0){
                                            printerwert = true;
                                        }
                                        else{
                                            printerwert = false;
                                        }
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Status.Drucker_druckt';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Drucker druckt', 'boolean', true, false, '', 'info.status', printerwert);
                                        
                                        // Drucker druckt in Array schreiben
                                        SetPrinterPrinted(fprintername, printerwert);

                                    }

                                    // Wenn Druckteil fertig, dann Zeiten/Werte löschen 
                                    if(content[0].job === 'none'){

                                        // Druckteilname --> PrintJob
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintJob.Druckteilname';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Name des Druckteils', 'string', true, false, '', 'info.name', '---');
                                        
                                        // Anzahl Layer --> PrintJob
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintJob.Layer_Gesamt';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Anzahl der Layer', 'number', true, false, '', 'info.status', 0);
                                                                    
                                        // Anzahl Lines --> PrintJob
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintJob.Linien_Gesamt';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Gesamtanzahl der Linien', 'number', true, false, '', 'info.status', 0);
                                        
                                        // Gesendete Lines --> PrintJob
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintJob.Linien_gesendet';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'An Drucker gesendete Linien', 'number', true, false, '', 'info.status', 0);
                                        
                                        // Druckpause --> Status
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Status.Druckpause';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Drucker im Pausenmodus', 'boolean', true, false, '', 'info.status', false);

                                        // Gesamtdruckzeit
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintJob.Gesamtdruckzeit';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Gesamtdruckzeit', 'string', true, false, 'Std.', 'info.time', '--:--');
                                        
                                        // Uhrzeit Druckbeginn                                
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintJob.Uhrzeit_Start';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Uhrzeit bei Druckstart', 'string', true, false, 'Uhr', 'info.time', '--:--');

                                        // Restzeit
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintJob.Restzeit';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Restzeit bis Druckende', 'string', true, false, 'Std.', 'info.time', '--:--');

                                        // Uhrzeit Druckende
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintJob.Uhrzeit_Fertig';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Uhrzeit wenn Druck fertig', 'string', true, false, 'Uhr', 'info.time', '--:--');

                                        // Aktueller Layer --> PrintJob
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintJob.Layer_Aktuell';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Layer wird aktuell erstellt', 'number', true, false, '', 'value', 0);

                                        // Fortschritt
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintJob.Druckfortschritt';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Druckfortschritt in %', 'string', true, false, '%', 'info.status', '---');
                                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Status.Drucker_druckt';
                                        DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Drucker druckt', 'boolean', true, false, '', 'info.status', false);

                                        // Drucker druckt in Array schreiben
                                        SetPrinterPrinted(fprintername, false);
                                    }                                
                                }
                            }
                        }
                    );
                }
            }
        }
    }
    // Funktion erneut nach x Sekunden aufrufen
    clearTimeout(tou6);
    tou6 = setTimeout(() => {
        refreshPrintJob(tadapter, refreshtime);
    }, refreshtime);

}

// Erstmalige Einlesen aller Druckermodel nach Adapterstart
function RefreshModelInit(tadapter, ModelEnable, refreshtime){

    // Hilfsvariablen
    let fprintername = '';

    // Model-Management enable
    if (ModelEnable == true){

        // TempVariable
        let erl = false;

        // Durchlauf erst nach Printerauswertung
        if (printerauswertung == true){

            // Mehr als 1 Printer vorhanden
            if (aprinter.length > 0){

                // Über alle Printer
                for (let p = 0; p < aprinter.length; p++) {

                    // Printername 
                    fprintername = aprinter[p];

                    // Printername vorhanden
                    if (fprintername){
                        
                        // Modelle einlesen
                        refreshModel(tadapter, fprintername);
                    }
                }
            }
            // Durchlauf erledigt
            erl=true;
        }

        // Funktion erneut nach x Sekunden aufrufen, wenn noch nicht erledigt
        if (erl == false){
            clearTimeout(tou8);
            tou8 = setTimeout(() => {
                RefreshModelInit(tadapter, ModelEnable, refreshtime);
            }, refreshtime);
        }
        // wenn erledigt, dann nicht mehr aufrufen
        else{
            clearTimeout(tou8);
        }
    }
}

// 3D-Modelle (G-Code-Objecte) einlesen
function refreshModel(tadapter, fprintername){
 
    // Hilfsvariablen für Modelanzahl
    let tanz = 0;

    // Durchlauf erst nach Printerauswertung
    if (printerauswertung == true){

        // Printername vorhanden
        if (fprintername){

            // Abfrage und Auswertung
            request(
                {
                    url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + fprintername + '?a=listModels&apikey=' + repetierApi,
                    json: true
                },
                function (error, response, content){

                    if (!error && response.statusCode == 200){

                        // Modelanzahl ermitteln
                        tanz = content.data.length

                        if (tanz > 0){
            
                            // Array vorbereiten
                            ModelArrayClean(fprintername);

                            // Alle Modelle einlesen
                            printerwert = '';
                            for (let t = 0; t < tanz; t++) {

                                // Neues mehrdimmensionales Array anlegen
                                let newnr = amodelle.length; // nächste freie Nummer festlegen
                                amodelle [newnr]= new Object;
                                amodelle [newnr] ["Printer"] = fprintername;
                                amodelle [newnr] ["ID"] = content.data[t].id;
                                amodelle [newnr] ["Name"] = content.data[t].name;
                                amodelle [newnr] ["intNr"] = t;
                                amodelle [newnr] ["Gruppe"] = content.data[t].group;

                                // Verzeichnis
                                printerwert = printerwert + t + ':' + content.data[t].name + '/' + content.data[t].group + ';';
                            }
                            printerwert = printerwert.substring(0, printerwert.length-1);

                            // Modelle --> Model
                            printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintModel.Modelle';
                            tadapter.setObjectNotExists(printerdatenpfad,{
                                type: 'state',
                                common:
                                {
                                    name:   'Modelle (Name, Gruppe)',
                                    type:   'number',
                                    read:   true,
                                    write:  true,
                                    role:   'value.indicator',
                                    states: printerwert,   // <-- Werteliste
                                    def:    0,
                                    min:    0,
                                    max:    100
                                },
                                native: {}
                            });
                            tadapter.extendObject(printerdatenpfad,{common: {states: printerwert}});
                            tadapter.setState(printerdatenpfad, {val: 0, ack: true});
                            PrinterMessage(tadapter, fprintername + " -> Modelupdate durchgeführt")
                        
                        }
                    }
                }
            );
        }
    }
}

// Printer über ioBroker starten
function PrinterStart(tadapter, fprintername, refreshtime){
             
    // Hilfsvariablen
    let erl = false ;

    // aktuelle DruckteilID holen
    let aktdruckid = GetModelIDPrinter(fprintername);

    // Druckername und ModelID vorhanden
    if (fprintername && aktdruckid){

        // Startbefehl senden
        request(
            {
                url:  'http://' + repetierIP + ':' + repetierPort + '/printer/api/' + fprintername + '?a=copyModel&data={"id":"'+ aktdruckid + '"}&apikey=' + repetierApi,
            },
            function (error, response, content){ 
                if (error){
                    // Fehler
                    PrinterMessage(tadapter, fprintername + ' -> Druck wurde nicht gestartet - Error: ' + error);
                }   
                else{
                    // Kein Fehler
                    PrinterMessage(tadapter, fprintername + ' -> Druck wurde gestartet...');
                }
            }
        );
        // Durchlauf erledigt setzen
        erl = true;
    }   
    else{
        // Meldung ausgeben
        PrinterMessage(tadapter, fprintername + ' -> Druckstart nicht möglich - Daten fehlen!');
        erl = true;
    }

    // Funktion erneut nach x Sekunden aufrufen, wenn noch nicht erledigt
    if (erl == false){
        clearTimeout(tou9);
        tou9 = setTimeout(() => {
            PrinterStart(tadapter, fprintername, refreshtime);
        }, refreshtime);    
    }
    else{
        clearTimeout(tou9);
    }
}

// *********************
// Allgemeine Funktionen
// *********************

// Spracheauswahl anlegen und Sparchen einlesen
function Language(tadapter, tlangnr, refreshtime){

    // Sprachwechsel noch aktiv (true)
    if (sprachwechselaktiv == false){

        // Sprachwechselmerker setzen
        sprachwechselaktiv = true;

        // Sprachen einlesen
        //if (debug == false){
        //    let tdata = fs.readFileSync(tadapter.adapterDir + '/languages.json', 'utf8');
        //}
        //else {
        //    let tdata = fs.readFileSync('C:/Program Files/iobroker/Testsystem1/node_modules/iobroker.repetierserver/languages.json', 'utf8');
        //}
        //alang = JSON.parse(tdata);
    
        // Sprachauswahl anlegen
        printerdatenpfad = 'info.Language';
        tadapter.setObjectNotExists(printerdatenpfad,{
            type: 'state',
            common:
            {
                name:   alang[3][sprachen[langnr]],
                type:   'number',
                read:   true,
                write:  true,
                role:   'value.language',
                states: sprachen,
                def:    0,
                min:    0,
                max:    10
            },
            native: {}
        });
        tadapter.extendObject(printerdatenpfad,{common: {states: sprachen, name: alang[3][sprachen[tlangnr]]}});
        tadapter.setState(printerdatenpfad, {val: tlangnr, ack: true});

        // Sprachwechselmerker durch
        sprachwechselaktiv = false;

    }

    // Funktion erneut nach x Sekunden aufrufen, wenn noch nicht erledigt
    if (sprachwechselaktiv == true){
        clearTimeout(tou10);
        tou10 = setTimeout(() => {
            Language(tadapter, tlangnr, refreshtime);
        }, refreshtime);
    }
    // wenn erledigt, dann nicht mehr aufrufen
    else{
        clearTimeout(tou10);
    }
}

// Kanäle entsprechend ausprägen
function PrinterKanaele(tadapter, fprintername){

    // Adapter
    SetKanal(tadapter, '', alang[20][sprachen[langnr]]);

    // Repetierserver
    printerdatenpfad = printerpath.substring(0, printerpath.length-1);
    SetKanal(tadapter, printerdatenpfad, alang[21][sprachen[langnr]]);

    // Kanal Printer
    printerdatenpfad = printerpath + 'Printer_' + fprintername;
    SetKanal(tadapter, printerdatenpfad, '3D-' + alang[22][sprachen[langnr]] + ' ' + fprintername);

    // Kanal Befehl
    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Befehl' ;
    SetKanal(tadapter, printerdatenpfad, alang[23][sprachen[langnr]]);
 
    // Kanal Error
    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Error' ;
    SetKanal(tadapter, printerdatenpfad, alang[24][sprachen[langnr]]);

    // Kanal Homing
    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Homing' ;
    SetKanal(tadapter, printerdatenpfad, alang[25][sprachen[langnr]]);

    // Kanal Info
    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Info' ;
    SetKanal(tadapter, printerdatenpfad, alang[26][sprachen[langnr]]);

    // Kanal Istwerte
    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Istwerte' ;
    SetKanal(tadapter, printerdatenpfad, alang[27][sprachen[langnr]]);

    // Kanal Koordinaten
    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Koordinaten' ;
    SetKanal(tadapter, printerdatenpfad, alang[28][sprachen[langnr]]);

    // Kanal PrintJob
    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintJob' ;
    SetKanal(tadapter, printerdatenpfad, alang[29][sprachen[langnr]]); //29

    // PrintModel, falls aktiv
    if (repetierModel == true){
      // Kanal PrintModel
      printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintModel' ;
      SetKanal(tadapter, printerdatenpfad, alang[30][sprachen[langnr]]); //30
    }

    // Kanal Sollvorgaben
    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Sollvorgaben' ;
    SetKanal(tadapter, printerdatenpfad, alang[31][sprachen[langnr]]); //31

    // Kanal Status
    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Status' ;
    SetKanal(tadapter, printerdatenpfad, alang[32][sprachen[langnr]]); //32

    // Kanal Steuern
    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Steuern' ;
    SetKanal(tadapter, printerdatenpfad, alang[33][sprachen[langnr]]); //33

    // Kanal Steuern.Signale
    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Steuern.Signale' ;
    SetKanal(tadapter, printerdatenpfad, alang[34][sprachen[langnr]]); //34

    // Kanal Steuern.Werte
    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Steuern.Werte' ;
    SetKanal(tadapter, printerdatenpfad, alang[35][sprachen[langnr]]); //35

}

// Updatebutton Printer anlegen und initialisieren
function PrinterUpdateButton(tadapter){
    
    // 'update_Printer' anlegen
    DatenAusgabe(tadapter, printerpath + 'Printer_update', 'state', "Drucker aktualisieren", 'boolean', true, true, '', 'button', false); //36
}

// Updatebutton Server anlegen und initialisieren (V0.0.5)
function ServerUpdateButton(tadapter){

    // 'update_Server' anlegen
    DatenAusgabe(tadapter, printerpath + 'Server_update', 'state', "Serveraktualisierung wird durchgeführt", 'boolean', true, true, '', 'button', false); //47
}
// Startbutton initialisieren oder löschen
function PrinterModelButtons(tadapter, InitDel, refreshtime){

    // Hilfsvariablen
    let fprintername = '';

    // nur einmal durchlaufen
    let erl = false;

    // Durchlauf erst nach Printerauswertung
    if (printerauswertung == true){

        // Überhaupt Drucker vorhanden
        if (aprinter.length > 0){

            // über alle Drucker
            for (let p = 0; p < aprinter.length; p++) {

                // Printername
                fprintername = aprinter[p];

                // Printername vorhanden
                if(fprintername){
                    // Startbutton
                    // Pfad aufbauen
                    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Steuern.Signale.Start';

                    // 'Start' anlegen wenn InitDel = true
                    if (InitDel == true){
                        // Startbutton anlegen
                        DatenAusgabe(tadapter, printerdatenpfad, 'state', "Drucker starten (ID erforderlich!)", 'boolean', true, true, '', 'button', false); //37
                    }
                    // sonst löschen
                    else{
                        DatenpunktLoeschen(tadapter, printerdatenpfad);
                    }

                    // ModelUpdateButton
                    // Pfad aufbauen
                    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintModel.Update';

                    // 'Start' anlegen wenn InitDel = true
                    if (InitDel == true){
                        // Startbutton anlegen
                        DatenAusgabe(tadapter, printerdatenpfad, 'state', "Lesen Sie neue 3D-Modelle ein", 'boolean', true, true, '', 'button', false); //38
                    
                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintModel.Modelle';
                        tadapter.setObjectNotExists(printerdatenpfad,{
                            type: 'state',
                            common:
                            {
                                name:   "3D-Modelle (Name, Gruppe)", //39
                                type:   'number',
                                read:   true,
                                write:  true,
                                role:   'value.indicator',
                                states: '',   // <-- Werteliste
                                def:    0,
                                min:    0,
                                max:    100
                            },
                            native: {}
                        });
                        tadapter.extendObject(printerdatenpfad,{common: {states: '', name: "3D-Modelle (Name, Gruppe)"}}); //39
                        tadapter.setState(printerdatenpfad, {val: '?', ack: true});

                    }
                    // sonst löschen
                    else{
                        DatenpunktLoeschen(tadapter, printerdatenpfad);
                    }

                    // Datenpunkte PrintModel -> Modelle löschen wenn Model-Management aus
                    if (InitDel == false){
                        printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintModel.Modelle';
                        DatenpunktLoeschen(tadapter, printerdatenpfad);
                    }

                    // Durchlauf erledigt
                    erl = true;

                }
            }
        }
    }

    // Funktion erneut nach x Sekunden aufrufen, wenn noch nicht erledigt
    if (erl == false){
        clearTimeout(tou7);
        tou7 = setTimeout(() => {
            PrinterModelButtons(tadapter, InitDel, refreshtime);
        }, refreshtime);    
    }
    else{
        clearTimeout(tou7);
    }
}

// Updatebutton anlegen und initialisieren
function PrinterMessage(tadapter, tMessage){

    // 'Message_Printer' anlegen
    DatenAusgabe(tadapter, printerpath + 'Nachricht', 'state', "Meldung", 'string', true, true, '', 'text', tMessage); //40
}

// Datenübergabe an ioBroker 
function DatenAusgabe(tadapter, d_Pfad, d_Type, c_Name, c_Type, c_Read, c_Write, c_Unit, c_Role, d_Wert){

    tadapter.setObjectNotExists(d_Pfad,{
        type: d_Type,
        common:
        {
            name:   c_Name,
            type:   c_Type,
            read:   c_Read,
            write:  c_Write,
            unit:   c_Unit,
            role:   c_Role
        },
        native: {}
    });

    tadapter.setState(d_Pfad, {val: d_Wert, ack: true});
}    

// Kanal anlegen
function SetKanal(tadapter, d_Pfad, c_Name){

    tadapter.setObjectNotExists(d_Pfad,{
        type: 'channel',
        common:
        {
            name:   c_Name
        },
        native: {}
    });

    tadapter.extendObject(d_Pfad, {common: {name: c_Name}});

}

// Datenpunkt löschen
function DatenpunktLoeschen(tadapter, d_pfad){

    // Prüfen, ob Datenpunkt vorhanden
    tadapter.getObject(d_pfad, function (err, obj){
        
        // wenn Fehler, dann Fehler ausgeben
        if (err){
            tadapter.log.error(alang[16][sprachen[langnr]] + ' ' + err); //16
        }

        // kein Fehler und Object vorhanden, dann löschen
        if (!err && obj){
            tadapter.delObject(obj._id);
       }
   })
}

// grobe G-Code-Überprüfung
function GCodeCheck(tadapter, G_Code){

    // Prüfen, og G-Code mit 'G', 'M', 'T', oder '@' beginnt
    if (G_Code.substr(0,1)=='G' || G_Code.substr(0,1)=='M' || G_Code.substr(0,1)=='T' || G_Code.substr(0,1)=='@'){

        PrinterMessage(tadapter, alang[17][sprachen[langnr]]); //17
        return true;    // Prüfung bestanden, dann 'true' zurück
    }
    else{

        PrinterMessage(tadapter, alang[41][sprachen[langnr]]); //41
        return false;   // sonst 'false' als Rückgabewert
    }
}

// Modelarray aufräumen
function ModelArrayClean(fprintername){

    // Printername vorhanden
    if (fprintername && amodelle.length > 0){

        // Eintrag mit Printername suchen und löschen
        for (let p = amodelle.length-1; p >= 0; p--) {
            if (amodelle[p]["Printer"] == fprintername){
                amodelle.splice(p, 1);
            }
        }
    }
}

// aktive ModelID setzen
function SetModelIDPrinter(fprintername, id){

    // Variable Drucker gefunden
    let gef = false;

    // Werte vorhanden und gültig
    if (fprintername && id){

        // über alle Drucker suchen
        for (let p = 0; p < aaktdruckid.length; p++){

            // Drucker gefunden
            if (aaktdruckid[p]["Printer"] == fprintername){
                aaktdruckid[p]["ModelID"] = id;
                
                // gefunden merken
                gef = true; 

                // und raus
                break;
            }
        }
        // nicht gefunden - dann anlegen
        if (gef == false){
            let newnr = aaktdruckid.length;
            aaktdruckid[newnr]=new Object;
            aaktdruckid[newnr]["Printer"] = fprintername;
            aaktdruckid[newnr]["ModelID"] = id;
            //aaktdruckidcnt=aaktdruckidcnt+1
        }
    }
}

// aktive ModelID holen
function GetModelIDPrinter(fprintername){
     
    // Werte vorhanden und gültig
    if (fprintername){

        // über alle Drucker suchen
        for (let p = 0; p < aaktdruckid.length; p++){

            // Drucker gefunden
            if (aaktdruckid[p]["Printer"] == fprintername){
                return aaktdruckid[p]["ModelID"];
            }
        }
    }
    // ungültiger Printername
    else{
        return -1;
    }
}

// Printer aktiviert setzen
function SetPrinterAktiv (fprintername, aktiv){

    // Hilfsvariablen
    let gef = false;

    // Werte vorhanden und gültig
    if (fprintername){

        // über alle Drucker suchen
        for (let p = 0; p < aprinterAktiv.length; p++){

            // Drucker gefunden
            if (aprinterAktiv[p]["Printer"] == fprintername){
                aprinterAktiv[p]["Aktiviert"] = aktiv;
                
                // gefunden merken
                gef = true; 

                // und raus
                break;
            }
        }
        // nicht gefunden - dann anlegen
        if (gef == false){
            let newnr = aprinterAktiv.length;
            aprinterAktiv[newnr]=new Object;
            aprinterAktiv[newnr]["Printer"] = fprintername;
            aprinterAktiv[newnr]["Aktiviert"] = aktiv;
        }
    }
}

// Printer aktiviert holen
function GetPrinterAktiv (fprintername){

    // Werte vorhanden und gültig
    if (fprintername){

        // über alle Drucker suchen
        for (let p = 0; p < aprinterAktiv.length; p++){

            // Drucker gefunden
            if (aprinterAktiv[p]["Printer"] == fprintername){
                return aprinterAktiv[p]["Aktiviert"];
            }
        }
    }
    // ungültiger Printername
    else{
        return -1;
    }
}

// Printer druckt setzen
function SetPrinterPrinted (fprintername, printed){

    // Hilfsvariablen
    let gef = false;

    // Werte vorhanden und gültig
    if (fprintername){

        // über alle Drucker suchen
        for (let p = 0; p < aprinterDruckt.length; p++){

            // Drucker gefunden
            if (aprinterDruckt[p]["Printer"] == fprintername){
                aprinterDruckt[p]["druckt"] = printed;
                
                // gefunden merken
                gef = true; 

                // und raus
                break;
            }
        }
        // nicht gefunden - dann anlegen
        if (gef == false){
            let newnr = aprinterDruckt.length;
            aprinterDruckt[newnr]=new Object;
            aprinterDruckt[newnr]["Printer"] = fprintername;
            aprinterDruckt[newnr]["druckt"] = printed;
        }
    }
}

// Printer druckt abfragen
function GetPrinterPrinted (fprintername){

    // Werte vorhanden und gültig
    if (fprintername){

        // über alle Drucker suchen
        for (let p = 0; p < aprinterDruckt.length; p++){

            // Drucker gefunden
            if (aprinterDruckt[p]["Printer"] == fprintername){
                return aprinterDruckt[p]["druckt"];
            }
        }
    }
    // ungültiger Printername
    else{
        return -1;
    }
}

// info.connection
function info(tadapter, tserveronline){

    // info.connection
    tadapter.getState('info.connection', (err, state) => {
        if (state){
            // kein Fehler, Wert vorhanden und Wert ungleich status
            if (!err && (state.val != tserveronline)){
                // dann ausgeben
                tadapter.setState('info.connection', tserveronline, true);
            }
        }
    });
}

// info.activeprinter und info.activeprintjob
function infoprinter(tadapter){

    // info.activeprinter
    // ******************
    tadapter.getState('info.activeprinter', (err, state) => {
        if (!state.val){
            state.val = '';
        }
        if (!err && state.val){
            let aprint='';
            for (let p = 0; p < aprinterAktiv.length; p++) {
                if (aprinterAktiv[p]["Aktiviert"] == true){
                    aprint = aprint + aprinterAktiv[p]["Printer"] + '; ';
                }
            }
            // Sting anpassen
            if (aprint.length > 0){
                aprint = aprint.substring(0, aprint.length-2);
            }

            // Sting anpassen
            if (aprint.length == 0){
                aprint = '-';
            }
        }
    });

    // info.activeprintjob
    // *******************
    tadapter.getState('info.activeprintjob', (err, state) => {
        if (!state.val){
            state.val = '';
        }    
        if (!err && state.val){
            let pprint='';
            for (let p = 0; p < aprinterDruckt.length; p++) {
                if (aprinterDruckt[p]["druckt"] == true){
                    pprint = pprint + aprinterDruckt[p]["Printer"] + '; ';
                }
            }
            // Sting anpassen
            if (pprint.length >0 ){
                pprint = pprint.substring(0, pprint.length-2);
            }

            // Sting anpassen
            if (pprint.length == 0){
                pprint = '-';
            }

            // Ausgeben
            if (state.val != pprint){
                DatenAusgabe(tadapter,'info.activeprintjob', 'state', alang[19][sprachen[langnr]], 'string', true, false, '', 'text', pprint)
            }
        }
    });
}

// Sprache aktualisieren
function Sprachwechsel(tadapter, snr) {
    tadapter.extendObject('info.activeprintjob',{common: {name: alang[19][sprachen[snr]]}});
    tadapter.extendObject('info.activeprinter',{common: {name: alang[18][sprachen[snr]]}});
    tadapter.extendObject('info.connection',{common: {name: alang[0][sprachen[snr]]}});





    sprachwechsel = false;
    
}
