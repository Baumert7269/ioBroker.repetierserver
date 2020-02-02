![Logo](admin/repetier.png)
# ioBroker.repetierserver
=========================

ioBroker Adapter für Repetier-Server (3D-Drucker). Er soll die Einbindung und Steuerung eines 3D-Druckers, der über Repetier-Server läuft, in die Homeautomatisierung ermöglichen. 

Folgende Funktionen stehen zur Verfügung:

- Allgegemeine Informationen zum Repetier-Server
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

Einige Datenpunkte werden erst erstellt, wenn der 3D-Drucker aktiviert wurde bzw. der erste Druckauftrag gestartet wurde. 


## Konfiguration:

- IP -Adresse des Repetier-Server
- Port (default 3344)
- API-Key zum Repetier-Server


## Changelog

### 1.0.0
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
