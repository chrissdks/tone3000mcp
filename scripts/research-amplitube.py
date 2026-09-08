"""Extract factual gear identities from the user's installed IK manual.

Usage: python scripts/research-amplitube.py <inventory.pdf> <gear-manual.pdf>
Does not copy descriptions, controls prose, or redistribute the source manuals.
"""
import sys, re, json, unicodedata
from pathlib import Path
from collections import Counter
from pypdf import PdfReader

def clean(s):
    return unicodedata.normalize('NFKC',s.replace('®', '').replace('™', '')).replace('\ufffd', '').strip()

def key(s):
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD', clean(s)).lower())

inventory = PdfReader(sys.argv[1])
manual = PdfReader(sys.argv[2])
pages = [p.extract_text() for p in manual.pages]
categories = {'STOMP':'stomp', 'AMP':'amp', 'CAB':'cabinet', 'SPEAKER':'speaker', 'MIC':'microphone', 'RACK':'rack', 'ROOM':'room'}
toc = []
category = None
for text in pages[2:19]:
    for line in text.splitlines():
        m = re.match(r'(.+?)\s+(\d+)\s*$', line)
        if not m: continue
        name, page = m.group(1).strip(), int(m.group(2))
        for title, cat in [('Stomp Box Effects','stomp'), ('Amplifiers','amp'), ('Cabinets','cabinet'), ('Microphones','microphone'), ('Rack Effects','rack'), ('Speakers','speaker'), ('Rooms','room')]:
            if name == title: category = cat
        if category: toc.append((category, name, page))

aliases = {'trexmoller':'mller', 'trexmudhoney':'mudhoney', 'trexreplica':'replica', '2x12rectohorizontal':'2x12rectifierhorizontal', '1x10vibratone':'vibratone', '1x15svxb15r':'1x15svx15r', '2x12svx212h':'2x12svx212', '4x12e412proxxl':'e412proxxl', '4x12e412standard':'e412standard', '4x12svx410s':'4x10svx410s', 'md1bfet':'md1b', 'vc670':'model670', 'vintageprogrameq1a':'vintageeq1a'}
rows = []
for i, p in enumerate(inventory.pages[1:], 2):
    lines = [s.strip() for s in p.extract_text().splitlines() if s.strip()]
    cat = next((categories[s] for s in lines if s in categories), None)
    assert cat, i
    for name in lines:
        if name in categories: cat = categories[name]
        if name.startswith('Gear included') or name in categories or name.isdigit(): continue
        matches = [(n, pg) for c,n,pg in toc if c == cat and key(n) == aliases.get(key(name), key(name))]
        exact = [(n,pg) for n,pg in matches if clean(n) == clean(name)]
        if exact: matches = exact
        if matches: matches = [min(matches, key=lambda x:x[1])]
        if cat == 'cabinet' and name=='3300W': matches=[('Leslie 3300W',463)]
        rows.append({'category':cat,'name':name,'inventoryPage':i,'matches':matches})

# Numeric rotary amp/cab names are gear, not page counters.
for cat, page in [('amp',6),('cabinet',10)]:
    for name in ['122','122A','147']:
        if any(r['category']==cat and r['name']==name for r in rows): continue
        rows.append({'category':cat,'name':name,'inventoryPage':page,'matches':[(n,pg) for c,n,pg in toc if c==cat and key(n)==key(name)]})

out=Path('tmp/pdfs')
(out/'manual-index.json').write_text(json.dumps(toc,indent=2),encoding='utf8')
(out/'research-matches.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf8')
print('Inventory counts:',Counter(r['category'] for r in rows))
for r in rows:
    if len(r['matches']) != 1: print('MATCH',r['category'],r['name'],r['matches'])
print('TOC category counts:',Counter(c for c,n,p in toc))
records=[]
occurrences=Counter()
manual_name='AmpliTube 5 Custom Shop Gear Models.pdf'
inventory_url='https://www.ikmultimedia.com/products/include/at5/gear_list_pdf/AmpliTube_5_MAX_gear.pdf'
fulltone_url='https://www.ikmultimedia.com/products/fulltone/'
notes_by_name={
    '4x12 SVX-410S':'Inventory says 4x12; manual says 4x10 SVX-410S (Ampeg SVT-410H). Treat the inventory size as a source discrepancy.',
    '1x15 SVX-B15N':'Inventory name differs from manual 1x15 SVX-115; B-15N identity is consistent, but alias association is inferred.',
    'VC-670':'Inventory name corresponds to manual Model 670; alias association is inferred.',
    'Vintage Program EQ 1A':'Inventory name corresponds to manual Vintage EQ-1A; alias association is inferred.',
    'MD1b-FET':'Manual heading uses MD1-b; the hardware line explicitly specifies MD1b-FET.',
    'Envelope Filter':'The inventory repeats this name twice. Both occurrences are retained; it does not identify their collections. Manual has Envelope Filter (p.43) and SVX Envelope Filter (p.76).',
}
manual_overrides={
    ('cabinet','2x12 BM 30 H70'):('VOX AC30 cabinet setup / Celestion G12H Anniversary speakers','official'),
    ('rack','Filter C'):('Curtis CEM3320 filter circuit (Prophet-5 / Oberheim OB-Xa)','official'),
    ('rack','Filter M'):('Moog transistor ladder filter (Minimoog / Modular Moog)','official'),
    ('rack','Filter O'):('Oberheim SEM state-variable filter','official'),
    ('rack','Filter R'):('Roland IR3109 filter circuit (Juno-60 / Jupiter-8)','official'),
    ('rack','Black 76'):('UREI / Universal Audio 1176LN family','inferred'),
    ('rack','White-2A'):('Teletronix / Universal Audio LA-2A family','inferred'),
    ('rack','EQ 81'):('Neve 1081-style equalizer (candidate; exact identity unconfirmed)','inferred'),
    ('rack','EQ PG'):('API 560-style graphic equalizer (candidate; exact identity unconfirmed)','inferred'),
}
for r in rows:
    hardware=None
    confidence='not-stated'
    page=None
    matched_name=None
    note=notes_by_name.get(r['name'],'')
    if len(r['matches'])==1:
        matched_name,page=r['matches'][0]
        lines=[clean(s) for s in pages[page-1].splitlines() if s.strip()]
        identities=[s for s in lines[:9] if re.match(r'(Based? on|Officiall[yi] Certified)',s)]
        if identities:
            hardware=re.sub(r'^(Based? on (the )?|Officiall[yi] Certified )','',identities[0]).rstrip('.*')
            confidence='official'
            if 'AmpliTube' in hardware or r['name']=='Star Gate':
                hardware=None
                confidence='not-stated'
        if 'proprietary' in ' '.join(lines[:9]): confidence='original'
        if r['category']=='amp' and 320 <= page <= 327 and hardware and 'Fender' not in hardware:
            hardware='Fender '+hardware
        if r['category']=='cabinet' and 426 <= page <= 446 and hardware and 'Fender' not in hardware:
            hardware='Fender '+hardware
    if r['name']=='SSTE - Solid State Tape Echo':
        hardware='Fulltone Solid State Tape Echo (SSTE)'
        confidence='official'
        note='Inventory lists this under stomp; IK Fulltone documentation describes a virtual rack format. Category retained from the requested inventory.'
    if r['name']=='1x15 SVX-B15N':
        hardware='Ampeg Heritage B-15N 1x15 cabinet'
        confidence='inferred'
        page=413
        matched_name='1x15 SVX-115'
    if (r['category'],r['name']) in manual_overrides:
        hardware,confidence=manual_overrides[(r['category'],r['name'])]
    if r['name'] in ['VC-670','Vintage Program EQ 1A','4x12 SVX-410S']: confidence='inferred'
    if r['name']=='Envelope Filter':
        hardware=None
        confidence='unresolved'
        page=None
        matched_name=None
    if r['category']=='speaker':
        note='Inventory confirms this speaker name; no explicit speaker-to-hardware mapping was found in the installed gear manual or targeted official-site searches. Cabinet speaker descriptions alone do not establish this alias.'
        confidence='unresolved'
    if r['category']=='room':
        note='Acoustic space rather than a hardware unit. No named real-world venue established by the inventory.'
        confidence='not-applicable'
    if r['name'].startswith('Custom ') and r['category']=='amp':
        hardware=None
        confidence='original'
        note='IK custom amp model; no exact external hardware identity asserted.'
    if hardware: hardware=hardware.replace('Wahmmy','Whammy').replace('AmplificationZ','Amplification Z')
    occurrences[(r['category'],key(r['name']))]+=1
    records.append({'id':f"{r['category']}-{key(r['name'])}-{occurrences[(r['category'],key(r['name']))]}",
        'category':r['category'],'displayName':unicodedata.normalize('NFKC',r['name']),
        'hardwareEquivalent':hardware,'mappingConfidence':confidence,
        'inventoryPage':r['inventoryPage'],'manualPage':page,'manualName':matched_name,
        'source':fulltone_url if r['name']=='SSTE - Solid State Tape Echo' else manual_name if page else inventory_url,
        'notes':note})

expected={'stomp':107,'amp':107,'cabinet':101,'speaker':31,'microphone':18,'rack':48,'room':8}
assert Counter(x['category'] for x in records)==expected
assert len(records)==420 and len({x['id'] for x in records})==420
dest=Path('docs/research'); dest.mkdir(parents=True,exist_ok=True)
payload={'scope':'AmpliTube 5 MAX original edition; inventory version 5.0.3 dated 2021-05-03',
    'researchedOn':'2026-09-07','inventoryUrl':inventory_url,
    'manualSource':manual_name,'manualPageCount':len(pages),
    'method':'Inventory names matched to the installed official IK gear manual. Explicit hardware identity lines have official status; inferred aliases and unknowns remain distinct. This research is not wired into the runtime catalog.',
    'categoryCounts':expected,'mappingCounts':dict(Counter(x['mappingConfidence'] for x in records)),'gear':records}
(dest/'amplitube-max-cross-reference.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
md=['# AmpliTube 5 MAX: complete inventory cross-reference','',
    'Scope: the linked original MAX inventory, version 5.0.3 (2021-05-03), **420 entries**. This is not MAX v2 (435 entries), nor a claim about installed licenses. Research date: 2026-09-07.','',
    f'[Official inventory]({inventory_url}). Identities primarily come from IK’s **{manual_name}**, the 562-page manual installed with AmpliTube on this PC. Page references below use PDF page numbers, which match the printed gear pages. Find that manual in the AmpliTube installation directory or IK Product Manager resources. The newer manual also includes gear outside the linked inventory; those extra models are excluded.','',
    'Official = explicit hardware identity in IK documentation, not necessarily a licensed/endorsed model. Inferred = candidate identity or cross-version alias association requiring confirmation. Not-stated = manual entry found but no exact hardware named. Original = IK custom/proprietary model. Unresolved = insufficient evidence to assign an identity. Not-applicable = a room rather than hardware. No marketing descriptions or manual illustrations are reproduced.','',
    'The screenshot needs corrections: American Tube Clean 1 = Fender Super Reverb (p.231); American Tube Clean 2 = Fender Deluxe Reverb ’65 (p.232); British Tube Lead 1 = Marshall JCM800 (p.248). Inventory names are Brit 8000 / Brit 9000. A similar name or sonic role does not establish an exact hardware match.','',
    'Source ambiguities are preserved: duplicate Envelope Filter entries, 4x12 SVX-410S versus the manual’s 4x10, and renamed rack/cab entries. All 31 speaker aliases are included but remain unresolved; do not silently turn guesses into official mappings.','',
    'Counts: '+', '.join(f'{k}: {v}' for k,v in expected.items())+'.','',
    'Mapping status: '+', '.join(f'{k}: {v}' for k,v in payload['mappingCounts'].items())+'.','',
    'Machine-readable companion: [JSON](amplitube-max-cross-reference.json). This is a research deliverable; the existing MCP still uses its 19-item starter catalog.','']
for cat in ['amp','cabinet','stomp','speaker','microphone','rack','room']:
    md += [f'## {cat.title()} ({expected[cat]})','','| AmpliTube name | Hardware equivalent / basis | Status | Evidence |','|---|---|---|---|']
    for x in sorted((x for x in records if x['category']==cat),key=lambda x:key(x['displayName'])):
        source=f"Manual p.{x['manualPage']}" if x['manualPage'] else '[IK Fulltone]('+fulltone_url+')' if x['source']==fulltone_url else f"Inventory PDF p.{x['inventoryPage']}"
        hardware=x['hardwareEquivalent'] or ('Acoustic space: '+x['displayName'] if cat=='room' else 'No exact hardware identity verified')
        if x['notes']: source+='; '+x['notes']
        md.append('| '+' | '.join(str(v).replace('|',' / ').replace('\n',' ') for v in [x['displayName'],hardware,x['mappingConfidence'],source])+' |')
    md += ['']
(dest/'amplitube-max-cross-reference.md').write_text('\n'.join(md),encoding='utf8')
print('Written 420 records:',payload['mappingCounts'])
