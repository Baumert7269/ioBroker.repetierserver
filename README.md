![Logo](admin/repetier.png)
# ioBroker.repetierserver
[![NPM version](http://img.shields.io/npm/v/iobroker.repetierserver.svg)](https://www.npmjs.com/package/iobroker.repetierserver)
[![Downloads](https://img.shields.io/npm/dm/iobroker.repetierserver.svg)](https://www.npmjs.com/package/iobroker.repetierserver)
[![Build Status](https://www.travis-ci.org/Baumert7269/ioBroker.repetierserver.svg?branch=master)](https://www.travis-ci.org/Baumert7269/ioBroker.repetierserver)

[![NPM](https://nodei.co/npm/iobroker.repetierserver.png?downloads=true)](https://nodei.co/npm/iobroker.repetierserver/)

ioBroker Adapter für Repetier-Server (3D-Drucker). Er soll die Einbindung und Steuerung eines 3D-Druckers, der über Repetier-Server läuft, in die Homeautomatisierung ermöglichen. 

Folgende Funktionen stehen zur Verfügung:

- Allgemeine Informationen zum Repetier-Server
- Erkennen und Einlesen der angelegten 3D-Drucker
- Aufbau der Kanäle und Datenpunkte entsprechend der Druckerkonfiguration 
- Ausgabe der Werte
  - Druckerkonfigurationsdaten
  - Sollwertvorgaben
  - Istwerte
  - Koordinaten
  - Statusdaten
- Steuerung des Druckers
  - Steuersignale
  - Sollwertanpassungen
- Druckauftrag
  - Informationen zum Druckobjekt
  - Informationen zum Druckauftrag
  - Zeitinformationen
- Übergabe von G-Code Befehlen

Einige Datenpunkte werden erst erstellt, wenn der 3D-Drucker aktiviert wurde bzw. der erste Druckauftrag gestartet wurde. 
Es werden nur Werte vom Drucker empfangen, wenn dieser 'aktiviert' ist!

## Konfiguration:

- IP -Adresse des Repetier-Server
- Port (default 3344)
- API-Key zum Repetier-Server

**************************************

# ioBroker.repetierserver

ioBroker adapter for Repetier-Server (3D printer). It is intended to enable the integration and control of a 3D printer that runs via Repetier-Server in the home automation. 

The following functions are available:

- General information about the Repetier-Server
- Recognize and read in the created 3D printer
- Structure of the channels and data points according to the printer configuration 
- Output of the values
  - printer configuration data
  - setpoints
  - actual values
  - coordinates
  - state data
- Control the printer
  - control signals
  - Setpoint adjustments
- print job
  - Information about the print object
  - Information about the print job
  - time information
- handover from C-Gode commands

Some data points are only created when the 3D printer has been activated or the first print job has started. 


## Configuration:

- IP-Adresse of the Repetier-Server
- Port of the Repetier-Server
- API-Key of then Repetier-Server

**************************************


## Changelog

### 0.0.1
* (Baumert7269) initial release


## License

The MIT License (MIT)

Copyright (c) 2020 Baumert7269 <thomas.baumert@live.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
