# Build the manifest of every NASA asset the game uses, and download previews, printable STL models and textures.
import json, os, re, urllib.parse, urllib.request, concurrent.futures as cf
ROOT='./work'
T=json.load(open('./work/tree.json'))['tree']
blobs={e['path']:e.get('size',0) for e in T if e['type']=='blob'}
BASE='https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/'
def slug(s): return re.sub(r'-+','-',re.sub(r'[^a-z0-9]+','-',s.lower())).strip('-')
folders={}
for p in blobs:
    parts=p.split('/')
    if len(parts)>=3: folders.setdefault(parts[0]+'/'+parts[1],[]).append(p)
def preview_for(folder, base):
    imgs=[f for f in folders.get(folder,[]) if f.lower().endswith(('.png','.webp','.jpg'))]
    for ext in ('.png','.webp','.jpg'):
        for f in imgs:
            if os.path.basename(f).lower()==(base+ext).lower(): return f
    for f in imgs:
        if 'preview' in os.path.basename(f).lower(): return f
    pngs=[f for f in imgs if f.lower().endswith('.png')]
    return pngs[0] if pngs else None
man=[]; seen=set(); jobs=[]
def add(e):
    i=e['id']; n=2
    while e['id'] in seen: e['id']=i+'-'+str(n); n+=1
    seen.add(e['id']); man.append(e)
HERO=re.compile(r'^(Apollo Lunar Module|Astronaut|Saturn V|International Space Station \(ISS\)|Hubble Space Telescope \(B\)|James Webb Space Telescope \(A\)|Terra|Aqua \(B\)|Suomi.*|Mars 2020 Perseverance Rover|Ingenuity Mars Helicopter|Gateway Core|Space Exploration Vehicle|Space Shuttle \(A\)|Crawler|Vehicle Assembly Building \(VAB\)|Mobile Launcher \(assembled\)|Deep Space Network 34-meter|Tracking and Data Relay Satellites \(TDRS\) \(C\)|Landsat 8|Geostationary Operational Environmental Satellites|Lunar Reconnaissance Orbiter \(B\)|Extravehicular Mobility Unit|Cassini-Huygens \(A\)|Voyager Probe \(B\)|Z2 Spacesuit|Robonaut 2|Regolith Advanced.*)$')
for e in json.load(open(ROOT+'/index.json')):
    p=e['path']; name=os.path.basename(p)[:-4]; folder=os.path.dirname(p)
    hero=bool(HERO.match(name))
    ent={'id':slug(name),'name':name,'kind':'glb','src':'%s/raw/%03d.glb'%(ROOT,e['i']),'size':e['size'],'folder':folder.split('/',1)[1],'hero':hero,
         'budget':28000 if hero else 8000,'tex':1024 if hero else 512}
    add(ent)
    pv=preview_for(folder,name)
    if pv: ent['prev']=ROOT+'/prev/'+ent['id']+os.path.splitext(pv)[1].lower(); jobs.append((pv,ent['prev']))
# 3D-printable models that have no GLB twin: (folder, title, smooth normals?, triangle budget)
STL=[('Apollo 11 - Landing Site','Apollo 11 landing site',1,24000),('Apollo 12 - Landing Site','Apollo 12 landing site',1,24000),('Apollo 14 - Landing Site','Apollo 14 landing site',1,24000),
 ('Apollo 15 - Landing Site','Apollo 15 landing site',1,24000),('Apollo 16 - Landing Site','Apollo 16 landing site',1,24000),('Apollo 17 - Landing Site','Apollo 17 landing site',1,24000),
 ('Asteroid 101955 Bennu','Asteroid Bennu',1,12000),('Asteroid 433 Eros','Asteroid Eros',1,12000),('Asteroid 25143 Itokawa','Asteroid Itokawa',1,12000),('Asteroid 1620 Geographos','Asteroid Geographos',1,8000),
 ('Asteroid 216 Kleopatra','Asteroid Kleopatra',1,8000),('Asteroid 4179 Toutatis','Asteroid Toutatis',1,8000),('Asteroid 6489 Golevka','Asteroid Golevka',1,8000),('Asteroid 4 Vesta (B)','Asteroid Vesta',1,14000),
 ('Space Launch System (SLS) Block 1','Space Launch System Block 1',0,20000),('Landsat 9','Landsat 9',0,10000),('Double Asteroid Redirection Test (DART)','DART',0,12000),
 ('Curiosity Rover (Simplified)','Curiosity rover',0,20000),('Block Island','Block Island meteorite',1,8000),('Moon - Tycho','Tycho crater',1,16000),('Moon - Copernicus Crater','Copernicus crater',1,16000),
 ('Moon - Mount Hadley','Mount Hadley',1,16000),('Mars - Gale Crater','Gale crater',1,16000),('Mars - Victoria Crater','Victoria crater',1,16000),('Mars - Valles Marineris (C)','Valles Marineris',1,16000),
 ('Hurricane Katrina','Hurricane Katrina',1,14000),('Nancy Grace Roman Space Telescope','',0,0)]
for folder,title,smooth,budget in STL:
    if not budget: continue
    f='3D Printing/'+folder
    stls=sorted([x for x in folders.get(f,[]) if x.lower().endswith('.stl')], key=lambda x:-blobs[x])
    if not stls: print('NO STL',folder); continue
    ent={'id':slug(title),'name':title,'kind':'stl','folder':folder,'size':blobs[stls[0]],'smooth':smooth,'budget':budget,'hero':False}
    add(ent); ent['src']=ROOT+'/stl/'+ent['id']+'.stl'; jobs.append((stls[0],ent['src']))
    pv=preview_for(f,os.path.basename(stls[0])[:-4])
    if pv: ent['prev']=ROOT+'/prev/'+ent['id']+os.path.splitext(pv)[1].lower(); jobs.append((pv,ent['prev']))
GLOBES=['Moon','Mars','Venus','Jupiter','Saturn','Uranus','Neptune','Pluto','Earth (A)','Mars - Phobos','Mars - Deimos','Jupiter - Io (A)','Jupiter - Europa','Jupiter - Ganymede','Jupiter - Callisto',
 'Saturn - Mimas','Saturn - Enceladus','Saturn - Tethys','Saturn - Dione','Saturn - Rhea','Saturn - Titan','Saturn - Iapetus','Uranus - Miranda','Uranus - Ariel','Uranus - Umbriel','Uranus - Titania','Uranus - Oberon','Neptune - Triton','Pluto - Charon']
for g in GLOBES+['Tycho Star Map','Moon - Apollo Astronaut Bootprint']:
    f='Images and Textures/'+g
    jpg=[x for x in folders.get(f,[]) if x.lower().endswith('.jpg')]
    if not jpg: print('NO JPG',g); continue
    title=g.split(' - ')[-1].replace(' (A)','')
    ent={'id':'globe-'+slug(title),'name':title,'kind':'globe' if g in GLOBES else 'image','folder':g,'size':blobs[jpg[0]],'hero':False}
    add(ent); ent['src']=ROOT+'/tex/'+ent['id']+'.jpg'; jobs.append((jpg[0],ent['src']))
for d in ('prev','stl','tex','opt'): os.makedirs(ROOT+'/'+d,exist_ok=True)
json.dump(man,open(ROOT+'/manifest.json','w'),indent=0)
def get(job):
    path,dst=job
    if os.path.exists(dst) and os.path.getsize(dst)==blobs[path]: return None
    url=BASE+urllib.parse.quote(path)
    for k in range(3):
        try:
            urllib.request.urlretrieve(url,dst)
            if os.path.getsize(dst)==blobs[path]: return None
        except Exception as ex: err=str(ex)
    return 'FAIL '+path
with cf.ThreadPoolExecutor(10) as ex:
    bad=[r for r in ex.map(get,jobs) if r]
print('manifest',len(man),'downloads',len(jobs),'failed',bad)
