# ioBroker.repetierserver
=========================

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

Einige Datenpunkte werden erst erstellt, wenn der 3D-Drucker aktiviert wurde bzw. der erste Druckauftrag gestartet wurde. 


## Konfiguration:

- IP-Adresse des Repetier-Server
- Port des Repetier-Server
- API-Key zum Repetier-Server
