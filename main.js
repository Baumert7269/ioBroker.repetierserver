'use strict';

/*
 * 
 * repetierserver adapter Copyright 2020, Baumert7269 <thomas.baumert@live.de>
 *
 */

/*
* Codeänderungen:
*
* Vorschau V0.0.7
*
* - alle Datenpunkte bei Adapterstart prüfen und ggf. anlegen
* - Sprachumschaltung 
* 
* V0.0.6
* - Umstellung von 'request' auf 'axios'
* - Umstellung auf async/await bei Kommunikation
* - einie Datenpunkte umstrukturiert
*
* V0.0.5
* - Implementierung Sprachumschaltung (wird verschoben)
*
* V0.0.4
* - Datenpunkte 'info.activeprinter' und 'info.activeprintjob' implementiert
* - Datenpunkt 'letzte Nachrichten' implementier
*
* V0.0.3
* - Problem "Cannot read property 'val' of null" behoben 
*
* V0.0.2
* - 3D-Model-Management implenemtiert
* - Errorcodes implementiert
*
* V0.0.1
* - Erstauslieferung
*/

// ******************************
// Definitionen und Vorbelegungen
// ******************************

const utils = require('@iobroker/adapter-core');
const axios = require('axios');
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
let tou11 ;

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
        //Language(this, langnr, 2500);

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
            this.log.info("Repetier IP:" + ' ' + repetierIP); //this.log.info(alang[4][sprachen[langnr]] + ' ' + repetierIP);
            this.log.info("Keine korrekte IP angegeben!");  //this.log.info(alang[5][sprachen[langnr]]);
            this.setState('info.connection', false, false);
            repIPOK = false;
        }
        else {
            repIPOK = true;
            this.log.info("Repetier IP:" + ' ' + repetierIP);  //this.log.info(alang[4][sprachen[langnr]] + ' ' + repetierIP);
        }

        // ApiKey prüfen
        if(repetierApi == ''){
            this.log.info("Kein ApiKey angegeben!");  //this.log.info(alang[6][sprachen[langnr]]);
            this.setState('info.connection', false, false);
            repApiKeyOK = false;
        }
        else {
            repApiKeyOK = true;
            this.log.info("Repetier ApiKey:" + ' ' + repetierApi); //this.log.info(alang[7][sprachen[langnr]] + ' ' + repetierApi);
        }

        // Port prüfen --> Defaultwert für Port übergeben, falls keine Angabe
        if(repetierPort == ''){
            repetierPort = '3344';
            this.log.info("Repetier Standard Port 3344 wurde akzeptiert!"); //this.log.info(alang[8][sprachen[langnr]]);
            repPortOK = true;
        }
        else {
            repPortOK = true;
            this.log.info("Repetier-Port:" + ' ' + repetierPort);  // this.log.info(alang[9][sprachen[langnr]] + ' ' + repetierPort);
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
            this.log.info("Repetier 3D-Modellverwaltung aktiv");  //12
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
            this.log.info("Repetier-Server-Service bereinigt ..."); //13

            // info.connection zurücksetzen
            this.setState('info.connection', false, false);

            // info.activeprinter zurücksetzen
            this.setState('info.activeprinter', {val: '---', ack: true});

            // info.activeprintjob zurücksetzen
            this.setState('info.activeprintjob', {val: '---', ack: true});

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

    async onStateChange(id, state) {
        if (state) {

            // The state was changed
            // Printername ermitteln
            let tprintername = '';
            let response = '';
            const tmp = id.split('.');

            // Printername vorhanden
            if (tmp.length > 3) {

                // Printername auswerten
                if (tmp[3].search('rinter_') > 0 || tmp[3].search('_update') > 0 || tmp[2] == 'info'){  // --> Printer ohne 'P', damit search > 0 sein kann    
                    
                    // Printername aufbauen
                    tprintername = tmp[3].replace('Printer_', '');
                        
                    // Welcher Steuerbefehl des Printers wurde geändert 
                    switch(true){

                    // Druck Stopp
                    case (id.search('Steuern.Signale.Stopp') > 0 && state.val == true):
                        response = await axios.get('http://' + repetierIP + ':' + repetierPort + '/printer/api/' + tprintername + '?a=stopJob&apikey=' + repetierApi);
                        if (response.status == 200){
                            this.setState(id, {val: false, ack: true});
                            PrinterMessage(this, "Druckstopp durchgeführt"); // 44
                        }
                        break;

                    // Drucker NOT-STOP
                    case (id.search('Steuern.Signale.NOTSTOP') > 0 && state.val == true):
                        response = await axios.get('http://' + repetierIP + ':' + repetierPort + '/printer/api/' + tprintername + '?a=emergencyStop&apikey=' + repetierApi);
                        if (response.status == 200){
                            this.setState(id, {val: false, ack: true});
                            PrinterMessage(this, "NOTSTOP durchgeführt"); // 44
                        }
                        break;

                        // Printer Aktivieren
                    case (id.search('Steuern.Signale.Aktivieren') > 0 && state.val == true):
                        response = await axios.get('http://' + repetierIP + ':' + repetierPort + '/printer/api/' + tprintername + '?a=activate&data={"printer":"' + tprintername + '"}&apikey=' + repetierApi);
                        if (response.status == 200){
                            this.setState(id, {val: false, ack: true});
                            PrinterMessage(this, "Drucker '" + tprintername + "' aktiviert"); // 44
                        }
                        break; 

                    // Printer Deaktivieren
                    case (id.search('Steuern.Signale.Deaktivieren') > 0 && state.val == true):
                        response = await axios.get('http://' + repetierIP + ':' + repetierPort + '/printer/api/' + tprintername + '?a=deactivate&data={"printer":"' + tprintername + '"}&apikey=' + repetierApi);
                        if (response.status == 200){
                            this.setState(id, {val: false, ack: true});
                            PrinterMessage(this, "Drucker '" + tprintername + "' deaktiviert"); // 44
                        }
                        break;

                    // Druck Pause
                    case (id.search('Steuern.Signale.Pause') > 0 && state.val == true):
                        response = await axios.get('http://' + repetierIP + ':' + repetierPort + '/printer/api/' + tprintername + '?a=send&data={"cmd":"@pause"}&apikey=' + repetierApi);
                        if (response.status == 200){
                            this.setState(id, {val: false, ack: true});
                            PrinterMessage(this, "Druckpause betätigt"); // 44
                        }
                        break;
                    
                    // Druck fortsetzen
                    case (id.search('Steuern.Signale.Fortsetzen') > 0 && state.val == true):
                        response = await axios.get('http://' + repetierIP + ':' + repetierPort + '/printer/api/' + tprintername + '?a=continueJob&apikey=' + repetierApi);
                        if (response.status == 200){
                            this.setState(id, {val: false, ack: true});
                            PrinterMessage(this, "Druck wird fortgesetzt"); // 44
                        }
                        break;

                    // Manueller G-Code-Befehl
                    case (id.search('Befehl.G_Code') > 0 && state.val != '' && state.val != "Unbekannter G-Code"): //41
                        // Befehl ist korrekt --> dann übergeben
                        if (GCodeCheck(state.val) == true){
                            response = await axios.get('http://' + repetierIP + ':' + repetierPort + '/printer/api/' + tprintername + '?a=send&data={"cmd":"'+ state.val + '"}&apikey=' + repetierApi);
                            if (response.status == 200){
                                this.setState(id, {val: '', ack: true});
                                PrinterMessage(this, "G-Code '" + state.val + "' übergeben"); // 44
                            }
                        }
                        else{   // Befehl nicht korrekt --> abbrechen und Rückmeldung
                            this.setState(id, {val: '', ack: true});
                        }

                        break;

                    // Materialfluss ändern (10% - 200%)
                    case (id.search('Steuern.Werte.Materialfluss') > 0 && (state.val >= 10) && (state.val <=200)):
                        response = await axios.get('http://' + repetierIP + ':' + repetierPort + '/printer/api/' + tprintername + '?a=setFlowMultiply&data={"speed":"'+ state.val + '"}&apikey=' + repetierApi);

                        if (response.status == 200){
                            PrinterMessage(this, "Materialflusswert übergeben"); // 44
                        }
                        else{
                            PrinterMessage(this, "Materialflusswert wurde nicht übernommen"); // 44 
                        }
                        break;

                    // Druckgeschwindigkeit ändern (10% - 300%)
                    case (id.search('Steuern.Werte.Druckgeschwindigkeit') > 0 && (state.val >= 10) && (state.val <=300)):
                        response = await axios.get('http://' + repetierIP + ':' + repetierPort + '/printer/api/' + tprintername + '?a=setSpeedMultiply&data={"speed":"'+ state.val + '"}&apikey=' + repetierApi);
                        
                        if (response.status == 200){
                            PrinterMessage(this, "Druckgeschwindigkeit übergeben"); // 44
                        }
                        else{
                            PrinterMessage(this, "Druckgeschwindigkeit wurde nicht übernommen"); // 44 
                        }

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
                        PrinterMessage(this, "Druckeraktualisierung wird durchgeführt"); // 44

                        // Printerupdate durchführen
                        printerUpdate(this, 120000);

                        // state zurücksetzen
                        this.setState(id, {val: false, ack: true});
                    
                        break;
                
                    // update_Server - Serverinformationen aktualisieren (V0.0.5)
                    case (id.search('Server_update') > 0 && state.val == true):
                        
                        // Meldung ausgeben
                        PrinterMessage(this, "Serveraktualisierung wird durchgeführt"); //48

                        // Printerupdate durchführen
                        serverUpdate(this, 86400000);

                        // state zurücksetzen
                        this.setState(id, {val: false, ack: true});
                    
                        break;

                    // Sprache wechseln
                    case (id.search('Language') > 0 && (state.val >= 0) && (state.val <=9) && sprachwechselaktiv == false):

                        // Sprache wechseln
                        Language(this, state.val, 2500);

                        // Meldung ausgeben
                        //(this, "Geänderte Sprache"); //46

                        // bei allen Kanälen die Sprache wechseln
                        
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
    // Logmeldung ausgeben 
    tadapter.subscribeStates('*');
    tadapter.log.debug('RepetierServer states subscribed');
    tadapter.log.info("Adapterversion " + tadapter.version + " gestartet");   
    tadapter.log.info("Initialisierung wird durchgeführt ...");

    // Initialisierung
    // ===============

    // Sprachauswahl init
    //Language(tadapter, langnr, 2500);

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
    PrinterMessage(tadapter, '---');

    // PrinterStatus (alle 2,5 Sek.) Timer-ID:tou5
    refreshState(tadapter, 2500);

    // Refresh PrintJob (alle 5 Sek.) Timer-ID: tou6
    refreshPrintJob(tadapter, 5000);

    // Refresh Steuerwerte (alle 2 Sek.) Timer-ID tou11
    //neuewerte(tadapter, 2000);

    // 3D Model Management aktiviert
    // =============================

    // Startbutton verteilen wenn aktiv, entfernen wenn inaktiv
    PrinterModelButtons(tadapter, repetierModel, 200000);

    // Modelle initial einlesen, wenn aktiv
    RefreshModelInit(tadapter, repetierModel,200000);

    // Logmeldung ausgeben 
    tadapter.log.info("Initialisierung beendet ...");

    // Nachricht ausgeben
    PrinterMessage(tadapter, "Initialisierung duchgeführt ..."); // 44

}

// *****************
// Printerfunktionen
// *****************

// neue oder gelöschte Printer
async function printerUpdate(tadapter, refreshtime){
 
    // Variable für Printeranzahl
    let fprintercnt = 0;
    let fprintername = '';
    let erl = false;

    // Abfrage und Auswertung
    let response = await axios.get('http://' + repetierIP + ':' + repetierPort + '/printer/info');
    let content = response.data;

    if (response.status == 200){

        //Druckeranzahl
        fprintercnt = content.printers.length;

        // Durchlauf startet
        erl = false;

        // Alle Drucker einlesen
        for (let pp = 0; pp < fprintercnt; pp++) {

            // Druckername
            // Array aprinter füllen
            aprinter[pp] = content.printers[pp].slug;

            // Printername 
            fprintername = aprinter[pp];

            if (fprintername){

                // **********************
                // Kanal anlegen/pflegen
                // Datenpunkte vorbelegen
                // **********************

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
                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Materialfluss ändern (%)', 'number', true, true, '%', 'value'); 

                // Druckgeschwindigkeit ändern (10% - 300%)
                printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Steuern.Werte.Druckgeschwindigkeit';
                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Druckgeschwindigkeit ändern (%)', 'number', true, true, '%', 'value'); 

                // Statusmeldung 'Drucker druckt' vorbelegen
                printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Status.Drucker_druckt';
                DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Drucker druckt', 'boolean', true, false, '', 'info.status');

                // Datenpunkt AktiveprinterJob anlegen
                DatenAusgabe(tadapter,'info.activeprintjob', 'state', "Drucker mit aktivem Druckauftrag", 'string', true, false, '', 'text', '---') //19

                // Datenpunkt Aktiveprinter anlegen
                DatenAusgabe(tadapter,'info.activeprinter', 'state', "Namen der aktivierten Drucker", 'string', true, false, '', 'text', '---')  //18 

                // Datenpunkt Aktiveprinter anlegen
                DatenAusgabe(tadapter,'info.Adapterversion', 'state', "Adapterversion", 'string', true, false, '', 'text', tadapter.version)  //18 
            }
        }

        // Message ausgeben
        PrinterMessage(tadapter, 'Printerupdate durchgeführt');

        // Auswertung merken
        printerauswertung = true;

        // Durchlauf erledigt
        erl = true;
    }

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
async function refreshServer(tadapter, refreshtime){

    // Durchlauf erst nach Printerauswertung
    if (printerauswertung == true){

        // Abfrage und Auswertung
    let response = await axios.get('http://' + repetierIP + ':' + repetierPort + '/printer/info');
    let content = response.data;

    if (response.status == 200){

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

    // Funktion erneut nach x Sekunden aufrufen
    clearTimeout(tou2);
    tou2 = setTimeout(() => {
        refreshServer(tadapter, refreshtime);
    }, refreshtime);
}
}
// Printerstatus aktualisieren und prüfen, ob Server online
async function refreshPrinterActive(tadapter, refreshtime){

    // Hilfsvariablen
    let fprintername = '';

    // Durchlauf erst nach Printerauswertung
    if (printerauswertung == true){

        // Abfrage und Auswertung
        let response = await axios.get('http://' + repetierIP + ':' + repetierPort + '/printer/info');
        let content = response.data;
    
        if (response.status == 200){
        
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

    // Funktion erneut nach x Sekunden aufrufen
    clearTimeout(tou4);
    tou4 = setTimeout(() => {
        refreshPrinterActive(tadapter, refreshtime);
    }, refreshtime);
}

// Softwareupdate für Server
async function serverUpdate(tadapter, refreshtime){

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
                let response = await axios.get('http://' + repetierIP + ':' + repetierPort + '/printer/api/' + fprintername + '?a=updateAvailable&apikey=' + repetierApi);
                let content = response.data;
            
                if (response.status == 200){
            
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
        }
    }

    // Funktion erneut nach x Sekunden aufrufen
    clearTimeout(tou3);
    tou3 = setTimeout(() => {
        serverUpdate(tadapter, refreshtime);
    }, refreshtime);
    
}

// Printerwerte aktualisieren
async function refreshState(tadapter, refreshtime){
        
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
                    let response = await axios.get('http://' + repetierIP + ':' + repetierPort + '/printer/api/' + fprintername + '?a=stateList&data&apikey=' + repetierApi);
                    let content = response.data;
                
                    if (response.status == 200){
                
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

                            // Materialfluss ändern (10% - 200%)
                            printerwert = content[fprintername].flowMultiply; 
                            printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Istwerte.Materialfluss';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Materialfluss in %', 'number', true, true, '%', 'value', printerwert); 

                            // Druckgeschwindigkeit ändern (10% - 300%)
                            printerwert = content[fprintername].speedMultiply; 
                            printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Istwerte.Druckgeschwindigkeit';
                            DatenAusgabe(tadapter, printerdatenpfad, 'state', 'Druckgeschwindigkeit in %', 'number', true, true, '%', 'value', printerwert); 

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
async function refreshPrintJob(tadapter, refreshtime){
    
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
                    let response = await axios.get('http://' + repetierIP + ':' + repetierPort + '/printer/api/' + fprintername + '?a=listPrinter&data&apikey=' + repetierApi);
                    let content = response.data;
                
                    if (response.status == 200){
                                            
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
async function RefreshModelInit(tadapter, ModelEnable, refreshtime){

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
async function refreshModel(tadapter, fprintername){
 
    // Hilfsvariablen für Modelanzahl
    let tanz = 0;

    // Durchlauf erst nach Printerauswertung
    if (printerauswertung == true){

        // Printername vorhanden
        if (fprintername){

            // Abfrage und Auswertung
            let response = await axios.get('http://' + repetierIP + ':' + repetierPort + '/printer/api/' + fprintername + '?a=listModels&apikey=' + repetierApi);
            let content = response.data;
        
            if (response.status == 200){
        
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
    }
}

// Printer über ioBroker starten
async function PrinterStart(tadapter, fprintername, refreshtime){
             
    // Hilfsvariablen
    let erl = false ;

    // aktuelle DruckteilID holen
    let aktdruckid = GetModelIDPrinter(fprintername);

    // Druckername und ModelID vorhanden
    if (fprintername && aktdruckid){

        // Startbefehl senden
        let response = await axios.get('http://' + repetierIP + ':' + repetierPort + '/printer/api/' + fprintername + '?a=copyModel&data={"id":"'+ aktdruckid + '"}&apikey=' + repetierApi);
        let content = response.data;
        
        if (response.status != 200){
            // Fehler
            PrinterMessage(tadapter, fprintername + ' -> Druck wurde nicht gestartet...');
        }   
        else{
            // Kein Fehler
            PrinterMessage(tadapter, fprintername + ' -> Druck wurde gestartet...');
        }

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
        if (debug == false){
            let tdata = fs.readFileSync('languages.json', 'utf8');
        }
        else {
            let tdata = fs.readFileSync('C:/Program Files/iobroker/Testsystem1/node_modules/iobroker.repetierserver/languages.json', 'utf8');
        }
        alang = JSON.parse(tdata);
    
        // Sprachauswahl anlegen
        printerdatenpfad = 'info.Language';
        tadapter.setObjectNotExists(printerdatenpfad,{
            type: 'state',
            common:
            {
                name:   "Sprachauswahl", // 3
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
    SetKanal(tadapter, '', "Repetier-Server für den 3D-Druck"); //20

    // Repetierserver
    printerdatenpfad = printerpath.substring(0, printerpath.length-1);
    SetKanal(tadapter, printerdatenpfad, "Serveradresse"); //21
   
    // Kanal Printer
    printerdatenpfad = printerpath + 'Printer_' + fprintername;
    SetKanal(tadapter, printerdatenpfad, '3D-' + "Drucker" + ' ' + fprintername); //22

    // Kanal Befehl
    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Befehl' ;
    SetKanal(tadapter, printerdatenpfad, "G-Code-Befehl"); //23
 
    // Kanal Error
    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Error' ;
    SetKanal(tadapter, printerdatenpfad, "Fehlerstatus Extruder + Heizbett"); //24

    // Kanal Homing
    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Homing' ;
    SetKanal(tadapter, printerdatenpfad, "Referenzierungsstatus"); //25

    // Kanal Info
    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Info' ;
    SetKanal(tadapter, printerdatenpfad, "Druckerinfo"); //26

    // Kanal Istwerte
    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Istwerte' ;
    SetKanal(tadapter, printerdatenpfad, "aktuelle Werte"); //27

    // Kanal Koordinaten
    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Koordinaten' ;
    SetKanal(tadapter, printerdatenpfad, "aktuelle Positionen"); //28

    // Kanal PrintJob
    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintJob' ;
    SetKanal(tadapter, printerdatenpfad, "aktueller Druckauftrag"); //29

    // PrintModel, falls aktiv
    if (repetierModel == true){
      // Kanal PrintModel
      printerdatenpfad = printerpath + 'Printer_' + fprintername + '.PrintModel' ;
      SetKanal(tadapter, printerdatenpfad, "3D-Modelle zum Drucken"); //30
    }

    // Kanal Sollvorgaben
    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Sollvorgaben' ;
    SetKanal(tadapter, printerdatenpfad, "Zielwerte vom Server"); //31

    // Kanal Status
    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Status' ;
    SetKanal(tadapter, printerdatenpfad, "einige Druckerstatus"); //32

    // Kanal Steuern
    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Steuern' ;
    SetKanal(tadapter, printerdatenpfad, "Drucker bedienen"); //33

    // Kanal Steuern.Signale
    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Steuern.Signale' ;
    SetKanal(tadapter, printerdatenpfad, "Steuersignale"); //34

    // Kanal Steuern.Werte
    printerdatenpfad = printerpath + 'Printer_' + fprintername + '.Steuern.Werte' ;
    SetKanal(tadapter, printerdatenpfad, "Steuerwerte"); //35

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
    DatenAusgabe(tadapter, printerpath + 'Nachricht', 'state', "letzte Meldung", 'string', true, true, '', 'text', tMessage); //40
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

    pause (50);

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
            tadapter.log.error("Datenpunkt löschen fehlgeschlagen ->" + ' ' + err); //16
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

        PrinterMessage(tadapter, "G-Code angenommen"); //17
        return true;    // Prüfung bestanden, dann 'true' zurück
    }
    else{

        PrinterMessage(tadapter, "Unbekannter G-Code"); //41
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

    // info.Adapterversion
    // *******************
   
    // Ausgeben
    DatenAusgabe(tadapter,'info.Adapterversion', 'state', "Adapterversion", 'string', true, false, '', 'text', tadapter.version);

    // info.activeprinter
    // ******************
    tadapter.getState('info.activeprinter', (err, state) => {
        if (!err && state){
            let aprint='';
            for (let p = 0; p < aprinterAktiv.length; p++) {
                if (aprinterAktiv[p]["Aktiviert"] == true){
                    aprint = aprint + aprinterAktiv[p]["Printer"] + '; ';
                }
            }
            // Sting anpassen
            if (aprint.length >0 ){
                aprint = aprint.substring(0, aprint.length-2);
            }
            // Ausgeben
            if (state.val != aprint){
                DatenAusgabe(tadapter,'info.activeprinter', 'state', "Namen der aktivierten Drucker", 'string', true, false, '', 'text', aprint)  //18 
            }
        }
    });

    // info.activeprintjob
    // *******************
    tadapter.getState('info.activeprintjob', (err, state) => {
        if (!err && state){
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
            // Ausgeben
            if (state.val != pprint){
                DatenAusgabe(tadapter,'info.activeprintjob', 'state', "Drucker mit aktivem Druckauftrag", 'string', true, false, '', 'text', pprint) //19
            }
        }
    });
}

// Funktion für Pause
// *******************
function pause(numberMillis) { 
    var now = new Date(); 
    var exitTime = now.getTime() + numberMillis; 
    while (true) { 
        now = new Date(); 
        if (now.getTime() > exitTime) 
            return; 
    } 
}