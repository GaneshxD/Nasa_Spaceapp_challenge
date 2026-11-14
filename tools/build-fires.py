#!/usr/bin/env python3
"""Builds assets/nasa-fires.js from NASA FIRMS downloads.

Every fire in Orbit Ranger is a real fire detected by NASA's MODIS instruments
(Terra and Aqua satellites) and published by FIRMS, the Fire Information for
Resource Management System.

Inputs, downloaded into one folder (no account needed):
  https://firms.modaps.eosdis.nasa.gov/data/country/modis/2023/modis_2023_<Country>.csv
      for: Canada United_States Russian_Federation Brazil Australia Angola
           Ghana Chile Portugal Greece Thailand Indonesia
  https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_7d.csv

Usage:  python3 tools/build-fires.py <folder-with-csv-files>
"""
import csv, json, os, sys, datetime

SRC = sys.argv[1] if len(sys.argv) > 1 else '.'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'nasa-fires.js')

# name, FIRMS country file, (lat min, lat max, lon min, lon max)
ZONES = [
    ('California, USA', 'United_States', (35.0, 42.0, -124.5, -118.0)),
    ('western Canada', 'Canada', (53.0, 60.0, -123.0, -108.0)),
    ('Alaska, USA', 'United_States', (62.0, 68.0, -160.0, -141.0)),
    ('the Amazon, Brazil', 'Brazil', (-13.0, -5.0, -66.0, -54.0)),
    ('central Chile', 'Chile', (-40.0, -34.0, -74.0, -70.5)),
    ('Portugal', 'Portugal', (37.0, 42.2, -9.6, -6.2)),
    ('Greece', 'Greece', (35.0, 41.5, 20.0, 27.0)),
    ('Ghana, West Africa', 'Ghana', (6.0, 11.2, -3.2, 1.2)),
    ('Angola, central Africa', 'Angola', (-15.0, -6.0, 13.0, 24.0)),
    ('Siberia, Russia', 'Russian_Federation', (57.0, 67.0, 100.0, 130.0)),
    ('Thailand, Southeast Asia', 'Thailand', (13.0, 20.4, 97.6, 105.0)),
    ('Borneo, Indonesia', 'Indonesia', (-4.0, 1.0, 109.5, 117.0)),
    ('northern Australia', 'Australia', (-19.0, -12.0, 127.0, 138.0)),
    ('southeast Australia', 'Australia', (-38.5, -32.0, 144.0, 152.5)),
]
# Fire radiative power (megawatts) measured by MODIS for one 1 km pixel.
CLASSES = [('small', 8, 30), ('medium', 40, 150), ('large', 200, 1e9)]
MIN_CONFIDENCE = 60

def rows(path):
    with open(path, newline='') as f:
        for r in csv.DictReader(f):
            yield r

def pick_spread(cands, n):
    """n detections from different days, spread through the fire season."""
    cands.sort(key=lambda r: (r['acq_date'], r['acq_time']))
    out, days = [], set()
    for q in [(i + 0.5) / n for i in range(n)]:
        i = int(q * len(cands))
        for j in list(range(i, len(cands))) + list(range(i - 1, -1, -1)):
            if cands[j]['acq_date'] not in days:
                days.add(cands[j]['acq_date']); out.append(cands[j]); break
    return out

cache = {}
zones_out = []
for name, country, (la0, la1, lo0, lo1) in ZONES:
    if country not in cache:
        cache[country] = list(rows(os.path.join(SRC, 'modis_2023_%s.csv' % country)))
    box = [r for r in cache[country]
           if la0 <= float(r['latitude']) <= la1 and lo0 <= float(r['longitude']) <= lo1
           and r.get('type', '0') == '0' and int(r['confidence']) >= MIN_CONFIDENCE]
    fires, lat_sum, lon_sum, n = {}, 0.0, 0.0, 0
    for cls, lo, hi in CLASSES:
        cands = [r for r in box if lo <= float(r['frp']) < hi]
        if len(cands) < 3:  # a quiet zone: take its strongest fires for this class
            cands = sorted(box, key=lambda r: -float(r['frp']))[:12]
        chosen = pick_spread(cands, 3)
        fires[cls] = [{
            'lat': round(float(r['latitude']), 3), 'lon': round(float(r['longitude']), 3),
            'date': r['acq_date'], 'frp': round(float(r['frp']), 1),
            'sat': r['satellite'], 'night': r['daynight'] == 'N'
        } for r in chosen]
        for f in fires[cls]:
            lat_sum += f['lat']; lon_sum += f['lon']; n += 1
    zones_out.append({'name': name, 'country': country.replace('_', ' '), 'detections2023': len(box),
                      'lat': round(lat_sum / n, 1), 'lon': round(lon_sum / n, 1), 'fires': fires})
    print('%-26s %7d fires in box | centre %6.1f %7.1f | FRP picks %s' % (
        name, len(box), lat_sum / n, lon_sum / n,
        ' '.join('/'.join(str(f['frp']) for f in fires[c]) for c, _, _ in CLASSES)))

# This week's fires around the world, for the globe on the title and briefing screens.
recent = [r for r in rows(os.path.join(SRC, 'MODIS_C6_1_Global_7d.csv')) if int(r['confidence']) >= 70]
dates = sorted(set(r['acq_date'] for r in recent))
step = max(1, len(recent) // 1600)
pts = []
for r in recent[::step]:
    pts += [round(float(r['latitude']), 1), round(float(r['longitude']), 1)]
print('recent: %d confident detections, %s to %s, kept %d' % (len(recent), dates[0], dates[-1], len(pts) // 2))

data = {
    'source': 'NASA FIRMS, MODIS Collection 6.1 active fire product (Terra and Aqua satellites)',
    'url': 'https://firms.modaps.eosdis.nasa.gov/',
    'archiveYear': 2023,
    'built': datetime.date.today().isoformat(),
    'zones': zones_out,
    'recent': {'from': dates[0], 'to': dates[-1], 'total': len(recent), 'points': pts},
}
with open(OUT, 'w') as f:
    f.write('/* Generated by tools/build-fires.py. Do not edit by hand.\n'
            ' * Real fire detections from NASA FIRMS (MODIS on Terra and Aqua). Public domain. See CREDITS.md. */\n'
            '(function (root) {\n  var RG = (root.RG = root.RG || {});\n  RG.NASA_FIRES = ')
    f.write(json.dumps(data, separators=(',', ':')))
    f.write(';\n})(typeof window !== \'undefined\' ? window : globalThis);\n')
print('wrote', os.path.normpath(OUT), os.path.getsize(OUT) // 1024, 'KB')
