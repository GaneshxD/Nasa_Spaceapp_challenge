# Turn NASA's 3D-printable Apollo landing-site models (made from Lunar Reconnaissance Orbiter data)
# into small height grids the Moon level can fly over and walk on.
import numpy as np, base64, json, io, sys
from PIL import Image
R='./work'; N=96
SITES=['apollo-11','apollo-12','apollo-14','apollo-15','apollo-16','apollo-17']
out={}; tiles=[]
for sid in SITES:
    b=open(f'{R}/stl/{sid}-landing-site.stl','rb').read()
    n=int(np.frombuffer(b[80:84],dtype='<u4')[0]); n=min(n,(len(b)-84)//50)
    rec=np.frombuffer(b[84:84+n*50],dtype=np.dtype([('n','<f4',3),('v','<f4',(3,3)),('a','<u2')]))
    v=rec['v'].reshape(-1,3).astype(np.float64)
    lo=v.min(0); hi=v.max(0); span=hi-lo
    side=min(span[0],span[1])*0.94; cx=(lo[0]+hi[0])/2; cy=(lo[1]+hi[1])/2
    u=(v[:,0]-(cx-side/2))/side; w=(v[:,1]-(cy-side/2))/side
    ok=(u>=0)&(u<1)&(w>=0)&(w<1)
    iu=(u[ok]*N).astype(int); iw=(w[ok]*N).astype(int)
    grid=np.full((N,N),-np.inf)
    np.maximum.at(grid,(N-1-iw,iu),v[ok,2])   # row 0 = north (top of the print), column 0 = west
    # fill holes from neighbours
    for _ in range(40):
        bad=~np.isfinite(grid)
        if not bad.any(): break
        pad=np.pad(grid,1,constant_values=-np.inf); best=np.full_like(grid,-np.inf)
        for dy in (0,1,2):
            for dx in (0,1,2): best=np.maximum(best,pad[dy:dy+N,dx:dx+N])
        grid[bad]=best[bad]
    # the base of the print shows up as very low cells at the rim: clamp to the 1st percentile
    lo_z=np.percentile(grid,1.0); grid=np.maximum(grid,lo_z)
    # light smoothing (3x3) to take printing steps out
    pad=np.pad(grid,1,mode='edge'); sm=sum(pad[dy:dy+N,dx:dx+N] for dy in (0,1,2) for dx in (0,1,2))/9
    h=(sm-sm.min())/(sm.max()-sm.min())
    gy,gx=np.gradient(h); slope=np.hypot(gx,gy)
    k=7; pad=np.pad(slope,k//2,mode='edge'); avg=sum(pad[dy:dy+N,dx:dx+N] for dy in range(k) for dx in range(k))/(k*k)
    box=np.full((N,N),np.inf); a=int(N*0.5); c=int(N*0.68); r0=int(N*0.34); r1=int(N*0.66)
    box[r0:r1,a:c]=avg[r0:r1,a:c]
    ty,tx=np.unravel_index(np.argmin(box),box.shape)
    rough=float(avg[max(0,ty-8):ty+9,max(0,tx-8):tx+9].mean())
    q=np.round(h*65535).astype('<u2')
    out[sid.replace('-','')]={'n':N,'tx':round((tx+0.5)/N,4),'tz':round((ty+0.5)/N,4),'rough':round(rough*1000,2),'h':base64.b64encode(q.tobytes()).decode()}
    print(sid,'tris',n,'span',np.round(span,1),'zrange',round(float(sm.min()),2),round(float(sm.max()),2),'target',tx,ty,'rough',round(rough*1000,2),'profile-max-ahead',round(float(h[ty,:tx].max()-h[ty,tx]),3))
    # hillshade preview
    sh=np.clip(0.5+(gx*-1.0+gy*0.4)*40,0,1); im=(sh*255).astype(np.uint8); im=np.stack([im]*3,-1); im[max(0,ty-1):ty+2,max(0,tx-1):tx+2]=[255,60,60]; im[ty,:tx:3]=[255,220,0]
    tiles.append(Image.fromarray(im).resize((288,288),Image.NEAREST))
sheet=Image.new('RGB',(288*6,288)); [sheet.paste(t,(288*i,0)) for i,t in enumerate(tiles)]; sheet.save('./work/sites.png')
boot=Image.open(f'{R}/tex/globe-apollo-astronaut-bootprint.jpg').convert('RGB'); boot.thumbnail((420,420)); bb=io.BytesIO(); boot.save(bb,'WEBP',quality=70)
js='/* Orbit Ranger — the six Apollo landing sites as height grids.\n * Made by tools/nasa3d/gen-sites.py from NASA 3D Resources\' printable landing-site models (Lunar Reconnaissance Orbiter data).\n * n: cells per side. h: heights 0..65535 (row 0 = north, column 0 = west), base64. tx, tz: the flat spot chosen as the landing target.\n * The game sets the real-world width and the height range itself (js/core/lunar.js). */\n(function (root) {\n  var RG = (root.RG = root.RG || {});\n  RG.MOON_SITES = '+json.dumps(out,separators=(',',':'))+';\n  RG.MOON_BOOTPRINT = "data:image/webp;base64,'+base64.b64encode(bb.getvalue()).decode()+'";\n})(typeof window !== "undefined" ? window : globalThis);\n'
open('../../assets/moon-sites.js','w').write(js); print('moon-sites.js',len(js)//1024,'KB','boot',boot.size)
