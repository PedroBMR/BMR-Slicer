; Tiny square test fixture
G90 ; absolute positioning
M82 ; absolute extrusion
G92 E0 ; reset extruder

G1 F1800 ; set feed rate to 30mm/s
G1 X10 Y0 E0.5 ; move east and extrude
G1 X10 Y10 E1.0 ; move north
G1 X0 Y10 E1.5 ; move west
G1 X0 Y0 E2.0 ; move south
G0 X0 Y0 ; travel move without extrusion

G1 X0 Y0 Z0.2 F600 ; lift Z with slower feed rate
G0 Z0.2 ; travel only move with comment (should be ignored)
G1 X10 Y0 E2.5 ; resume extrusion at slower speed
G0 X0 Y0 ; travel back home
G92 E0 ; reset extruder again

G1 X0 Y0.2 E0.1 F1200 ; short extrusion after reset
G1 X0 Y0.4 E0.0 ; extrusion decreases (should not count)
