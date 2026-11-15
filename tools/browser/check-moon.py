"""A whole Moon mission in a real browser: the plan, the pass around the back of the Moon, the deorbit burn, the
descent flown by holding whichever button the screen lights up, the walk and the report.
  python3 tools/browser/check-moon.py [auto|manual|full] [seconds the burn is late] [phone|wide]
"""
import sys, os, json; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import Game
MODE = sys.argv[1] if len(sys.argv) > 1 else "auto"
LATE = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0
SIZE = sys.argv[3] if len(sys.argv) > 3 else "desk"
PHONE = SIZE in ("phone", "wide")
W, H = {"desk": (1100, 700), "phone": (390, 780), "wide": (780, 390)}[SIZE]
TAG = MODE + ("" if SIZE == "desk" else "-" + SIZE)
# A player who does what the screen says: holds whichever control is lit, and fires the engine when told to.
# It also notes every change in the radio link, so the order of events can be printed afterwards.
AP = """window.__log = []; RG.Stage.onFrame(function(){ var c = RG.LevelKit.cur; if (!c || c.id !== 6 || RG.LevelKit.paused) return; var k = RG.LevelKit.keys, s = c.peek();
  function lit(id) { var b = document.getElementById(id); return !!b && b.classList.contains('is-want'); }
  function txt(id) { var e = document.getElementById(id); return e ? e.textContent : ''; }
  if (s.phase === 'fly') { k.left = lit('mn-b-left'); k.right = lit('mn-b-right'); k.up = lit('mn-b-up'); k.down = lit('mn-b-down'); }
  if (s.phase === 'orbit' && s.pass) {
    if (window.__late != null && s.pass.armed() && s.pass.toBurn() <= -window.__late) c.fire();
    if (s.pass.status !== window.__st) { window.__st = s.pass.status;
      window.__log.push(s.pass.status + ': link ' + txt('or-link-t') + ', ' + txt('or-alt') + ' km up, ' + txt('or-v') + ' km/h, low point ' + txt('or-pe') + ' km, clock ' + txt('or-clock') + ', ' + txt('or-warp')); } } })"""
g = Game(w=W, h=H, mobile=PHONE, pre=AP)
peek = lambda expr: g.js("(function(){var s=RG.LevelKit.cur.peek(); return " + expr + "})()")
def fits(sel):
    return g.js("(function(){var e=document.querySelector(%s); if(!e) return 'missing'; var r=e.getBoundingClientRect(); return (r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1)?'fits':'OFF SCREEN '+[r.left|0,r.top|0,r.right|0,r.bottom|0].join(',')})()" % json.dumps(sel))
def clear(a, b):
    return g.js("(function(){var x=document.querySelector(%s), y=document.querySelector(%s); if(!x||!y) return 'missing'; x=x.getBoundingClientRect(); y=y.getBoundingClientRect(); return (x.right<=y.left||y.right<=x.left||x.bottom<=y.top||y.bottom<=x.top)?'clear':'OVERLAP'})()" % (json.dumps(a), json.dumps(b)))
press = lambda sel: g.js("document.querySelector(%s).click()" % json.dumps(sel))
until = lambda expr, t=120: g.p.wait_for_function("(function(){var c=RG.LevelKit.cur; if(!c||!c.peek) return false; var s=c.peek(); return " + expr + "})()", timeout=t * 1000, polling=200)

press('[data-act="play"]'); g.wait(0.3); press('[data-lv="unlock"]'); g.wait(0.3)
press('.node[data-id="6"]'); g.wait(2.0)
press('[data-lv="mode"][data-key="%s"]' % MODE); press('[data-lv="kit"][data-key="mirror"]'); g.wait(0.3)
print("plan: mode", peek("s.plan.mode"), "| kit", peek("s.plan.kit.join('+')"), "| things that explain themselves on the sheet:", g.js("document.querySelectorAll('#lv-side [data-term]').length"))
print("  checks:", g.js("Array.from(document.querySelectorAll('.mn-check')).map(function(e){return e.dataset.level+': '+e.textContent.slice(0,60)}).join(' | ')"))
g.js("document.querySelector('.mn-dial[data-term=margin]').scrollIntoView({block:'center'})"); press('.mn-dial[data-term=margin]'); g.wait(0.4)
print("  margin gauge:", g.text('#explain.is-on .ex-head b'), "|", (g.text('#explain .ex-now') or '')[:120])
g.shot("m0-plan-" + TAG); g.p.keyboard.press("Escape")
press('[data-lv="board"]'); g.wait(0.8)

# ---- the pass around the back of the Moon ----
print("orbit: phase", peek("s.phase"), "| picture", fits('.or-pic'), "| panel", fits('.or-panel'), "| button", fits('[data-lv="startPass"]'), "| guide and picture", clear('.lv-coach', '.mn-orbit'))
press('.or-rows li[data-term=telemetry]'); g.wait(0.3)
print("  a link row explains itself:", g.text('#explain.is-on .ex-head b')); g.shot("m1-orbit-start-" + TAG); g.p.keyboard.press("Escape")
press('[data-lv="startPass"]'); g.wait(1.5)
press('#or-v-box'); g.wait(0.3); t0 = peek("s.pass.t"); g.wait(0.6)
print("  a tapped read-out pauses the pass:", g.js("RG.LevelKit.paused"), "| clock stood still:", abs(peek("s.pass.t") - t0) < 0.01)
g.p.keyboard.press("Escape"); g.js("window.__late = %s" % LATE); g.speed(2)
until("s.pass.status === 'dark'"); g.speed(1); g.shot("m2-orbit-dark-" + TAG)
print("  behind the Moon:", g.text('#or-link-t'), "| red line stops at the Moon:", g.js("document.getElementById('or-block').style.display !== 'none'"), "| guide and picture", clear('.lv-coach', '.mn-orbit'), "|", (g.text('#lv-say') or '')[:60])
g.speed(2); until("s.pass.status === 'burning' || s.pass.status === 'coast'"); g.shot("m3-orbit-burn-" + TAG)
until("!!s.doi", 180); g.speed(1); g.wait(0.3)
for line in g.js("window.__log"): print("   ", line)
doi = json.loads(peek("JSON.stringify(s.doi)"))
print("  deorbit burn: %.1f s %s, on time: %s, cost %d kg, out of contact %.0f min" % (abs(doi["err"]), "late" if doi["err"] > 0 else "early", doi["onTime"], doi["cost"], doi["darkMin"]))
print("  Mission Control:", (g.text('#lv-say') or '')[:170])
g.shot("m4-orbit-go-" + TAG)
press('[data-lv="descend"]'); g.wait(0.8)

# ---- the cabin and the descent ----
plan_fuel = g.js("RG.Lunar.plan(RG.LevelKit.cur.peek().plan).fuel")
n = 0
while peek("s.phase") == "sit" and n < 5: press('[data-lv="sitNext"]'); g.wait(0.4); n += 1
print("descent: starts with %.0f kg of propellant (the plan's %.0f minus %d for the burn) | cards at the window: %d | instruments: %d | panel %s | controls %s | panel and controls %s" % (
    peek("s.sim.fuel0"), plan_fuel, doi["cost"], n, g.js("document.querySelectorAll('.mn-panel .rd').length"), fits('.mn-panel'), fits('#lv-controls'), clear('.mn-panel', '#lv-controls')))
g.wait(1.0); press('#mn-vs-box'); g.wait(0.3)
print("  an instrument pauses the flight:", g.js("RG.LevelKit.paused"), "|", g.text('#explain.is-on .ex-head b'), "|", (g.text('#explain .ex-now') or '')[:90])
g.p.keyboard.press("Escape"); g.wait(0.2); g.shot("m5-fly-" + TAG)
g.speed(2.5); until("s.phase !== 'fly'", 240); g.speed(1); g.wait(0.3); g.shot("m6-landing-" + TAG)
print("  landing sheet:", g.text('#lv-sheet h2'), "|", " · ".join(g.js("Array.from(document.querySelectorAll('.mn-stats .chip')).map(function(e){return e.textContent})")))
if peek("s.phase") == "landed":
    press('[data-lv="egress"]'); g.wait(1.5); press('#mn-o2-box'); g.wait(0.3)
    print("walk: oxygen explains itself:", g.text('#explain.is-on .ex-head b'), "| job rows with a word:", g.js("document.querySelectorAll('.mn-jobs li[data-term]').length"), "| standing still:", peek("Math.hypot(s.walk.vx, s.walk.vz) < 0.01"))
    g.shot("m7-walk-" + TAG); g.p.keyboard.press("Escape"); g.wait(0.2)
    press('#mn-in'); g.wait(1.0); g.shot("m8-report-" + TAG)
    print("report:", g.text('#lv-sheet h2'), "| words to tap again:", g.js("document.querySelectorAll('#lv-sheet .learned .term').length"), "| sheet", fits('#lv-sheet'))
    for line in g.js("Array.from(document.querySelectorAll('.mn-debrief li')).map(function(e){return e.textContent})")[:2]: print("   ", line[:150])
    press('[data-lv="replan"]'); g.wait(0.8)
    print("new plan: phase", peek("s.phase"), "| the next mission starts in orbit again:", peek("s.doi === null"))
print("errors:", g.errs(), "| frame error:", g.js("String(RG.Stage.frameErr||'none')"))
g.close()
