# ioBroker.repetierserver
=========================

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

Some data points are only created when the 3D printer has been activated or the first print job has started. 


## Configuration:

- IP-Adresse of the Repetier-Server
- Port of the Repetier-Server
- API-Key of then Repetier-Server
