import json

with open('shot-20.json', 'r') as f:
    d = json.load(f)

phases = [p['phaseName'] for p in d['phaseTransitions']]

print('milliseconds,phase,current_temp,target_temp,pressure,flow')
for s in d['samples']:
    print(s['t'], phases[s['phaseNumber']], s['ct'], s['tt'], s['cp'], s['fl'], sep=',')
