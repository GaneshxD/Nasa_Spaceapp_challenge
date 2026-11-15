"""The ways in, and the two-player launch, in a real browser.
A locked level offers a choice; the map and the home screen start the co-op mission; two scripted players then fly it:
the pilot holds whichever arrow is lit, the engineer watches the lamps on the right-hand console and works the switches.
  python3 tools/browser/check-coop.py [desk|phone|wide] [seconds the engineer waits before dropping the boosters]
"""
import sys, os, json; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import Game
SIZE = sys.argv[1] if len(sys.argv) > 1 else "desk"
SEP = float(sys.argv[2]) if len(sys.argv) > 2 else 0.6
W, H = {"desk": (1100, 700), "phone": (390, 780), "wide": (780, 390)}[SIZE]
AP = """RG.Stage.onFrame(function(dt){ var c = RG.LevelKit.cur; if (!c || c.id !== 'coop1' || RG.LevelKit.paused) return; var s = c.peek(), k = RG.LevelKit.keys;
  if (s.phase !== 'fly' || s.ended) return;
  function el(id) { return document.getElementById(id) || { dataset: {}, classList: { contains: function () { return false; } } }; }
  k.left = el('st-l').classList.contains('is-want'); k.right = el('st-r').classList.contains('is-want');
  if (el('co-lamp-b').dataset.state === 'act') { window.__tb = (window.__tb || 0) + dt; if (window.__tb >= window.__sep) c.dropB(); }
  if (el('co-lamp-f').dataset.state === 'act' && el('co-steady').dataset.state === 'go') { window.__tf = (window.__tf || 0) + dt; if (window.__tf >= 0.5) c.dropF(); } })"""
g = Game(w=W, h=H, mobile=SIZE != "desk", pre=AP)
press = lambda sel: g.js("document.querySelector(%s).click()" % json.dumps(sel))
def fits(sel):
    return g.js("(function(){var e=document.querySelector(%s); if(!e) return 'missing'; var r=e.getBoundingClientRect(); return (r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1)?'fits':'OFF SCREEN '+[r.left|0,r.top|0,r.right|0,r.bottom|0].join(',')})()" % json.dumps(sel))
def clear(a, b):
    return g.js("(function(){var x=document.querySelector(%s), y=document.querySelector(%s); if(!x||!y) return 'missing'; x=x.getBoundingClientRect(); y=y.getBoundingClientRect(); return (x.right<=y.left||y.right<=x.left||x.bottom<=y.top||y.bottom<=x.top)?'clear':'OVERLAP'})()" % (json.dumps(a), json.dumps(b)))
peek = lambda expr: g.js("(function(){var s=RG.LevelKit.cur.peek(); return " + expr + "})()")

# ---- ways in ----
print("home screen has a 2 players button:", g.js("!!document.querySelector('.hero [data-lv=go][data-id=coop1]')"))
press('[data-act="play"]'); g.wait(0.4)
print("map: 2 players button", fits('.coop-btn'), "| clear of the level stops:", g.js("(function(){var c=document.querySelector('.coop-btn').getBoundingClientRect(); return Array.from(document.querySelectorAll('.w-stop')).every(function(s){var r=s.getBoundingClientRect(); return r.right<=c.left||c.right<=r.left||r.bottom<=c.top||c.bottom<=r.top})})()"))
g.shot("c0-map-" + SIZE)
press('.node[data-id="4"]'); g.wait(0.4)
print("a locked level offers a choice:", g.text('#dialog-title'), "|", g.text('.lock-why'), "|", g.js("Array.from(document.querySelectorAll('#dialog .actions button')).map(function(b){return b.textContent}).join(' / ')"))
g.shot("c1-locked-" + SIZE)
press('#dialog [data-lv="lockGo"][data-id="4"]'); g.wait(1.5)
print("  skip ahead starts it:", g.js("RG.LevelKit.cur && RG.LevelKit.cur.id"), "| dialog closed:", g.js("!document.getElementById('dialog').open"))
g.js("RG.Levels.showMap()"); g.wait(0.4)

# ---- the launch crew ----
press('.coop-btn'); g.wait(1.5)
print("co-op: tag", g.text('.lv-tag'), "| rocket", peek("JSON.stringify(s.launch.build)"), "| pilot console", fits('.co-con.is-left'), "| engineer console", fits('.co-con.is-right'), "| consoles apart:", clear('.co-con.is-left', '.co-con.is-right'),
      "| guide over a console:", clear('.lv-coach', '.co-con.is-left'), clear('.lv-coach', '.co-con.is-right'), "| buttons under consoles:", clear('.co-con.is-left', '.co-pad.is-left'), clear('.co-con.is-right', '.co-pad.is-right'))
print("  each console has only its own gauges: pilot", g.js("Array.from(document.querySelectorAll('.co-con.is-left [data-term]')).map(function(e){return e.dataset.term}).join(',')"), "| engineer", g.js("Array.from(document.querySelectorAll('.co-con.is-right [data-term]')).map(function(e){return e.dataset.term}).join(',')"))
g.p.keyboard.down('w'); g.wait(0.6)
print("  poll: pilot holds W:", g.text('#co-steady'), "/", g.text('#co-lamp-b'), "| phase", peek("s.phase"))
g.shot("c2-poll-" + SIZE)
g.p.keyboard.down('Enter'); g.wait(1.0)
print("  both held:", peek("s.phase")); g.p.keyboard.up('w'); g.p.keyboard.up('Enter')
g.p.wait_for_function("RG.LevelKit.cur.peek().phase === 'fly'", timeout=20000); g.wait(1.0)
g.p.keyboard.press('ArrowDown'); g.wait(0.3); print("  engineer too early on the boosters:", (g.text('#lv-say') or '')[:60])
g.p.keyboard.press('ArrowUp'); g.wait(0.3); print("  engineer too early on the fairing:", (g.text('#lv-say') or '')[:60])
g.js("document.getElementById('co-q-box').click()"); g.wait(0.3)
print("  a gauge pauses the launch:", g.js("RG.LevelKit.paused"), "|", g.text('#explain.is-on .ex-head b')); g.p.keyboard.press("Escape")
g.js("window.__sep = %s" % SEP); g.shot("c3-fly-" + SIZE); g.speed(2)
g.p.wait_for_function("RG.LevelKit.cur.peek().sim.fairingGone || RG.LevelKit.cur.peek().ended", timeout=150000); g.speed(1); g.wait(0.4)
print("  after the fairing: lamps", g.text('#co-lamp-b'), "/", g.text('#co-lamp-f'), "| nose cone falling in the scene:", g.js("RG.Rocket.fairT >= 0"), "|", (g.text('#lv-say') or '')[:70])
g.shot("c4-fairing-" + SIZE); g.speed(2.5)
g.p.wait_for_function("RG.LevelKit.cur.peek().ended", timeout=150000); g.speed(1); g.wait(0.6)
print("result:", g.text('#lv-sheet h2'), "| stars:", g.js("document.querySelectorAll('#lv-sheet .stars.is-big .is-on').length"), "| sheet", fits('#lv-sheet'))
for line in g.js("Array.from(document.querySelectorAll('.co-lines li')).map(function(e){return e.textContent})"): print("   ", line)
print("  saved off the numbered path:", g.js("JSON.stringify(RG.Progress.data.coop)"), "| level stars untouched:", g.js("JSON.stringify(RG.Progress.data.stars)"), "| words to tap again:", g.js("document.querySelectorAll('#lv-sheet .learned .term').length"),
      "| buttons:", g.js("Array.from(document.querySelectorAll('#lv-sheet .actions button')).map(function(b){return b.textContent}).join(' / ')"))
g.shot("c5-done-" + SIZE)
print("errors:", g.errs(), "| frame error:", g.js("String(RG.Stage.frameErr||'none')"))
g.close()
