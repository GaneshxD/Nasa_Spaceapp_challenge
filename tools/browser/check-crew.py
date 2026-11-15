"""The crew mission over the real room server: three browsers on three "devices" make a crew through a shared link and
a typed code, say go, and fly to orbit. Each seat is played by a script that does what its own console shows.
Needs Node (it starts server/src/index.js on a free port) and Python with Playwright.
  python3 tools/browser/check-crew.py
"""
import sys, os, json, subprocess, time, urllib.request; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import ARGS, ROOT, SHOTS, free_port
from playwright.sync_api import sync_playwright
port = free_port()
srv = subprocess.Popen(["node", os.path.join(ROOT, "server", "src", "index.js")], env=dict(os.environ, PORT=str(port)), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
base = "http://127.0.0.1:%d" % port
for _ in range(60):
    try: urllib.request.urlopen(base + "/healthz", timeout=1); break
    except Exception: time.sleep(0.25)
BOT = """window.__bot = setInterval(function () { var N = RG.CrewNet, s = N.state; if (!N.active || !s || s.stage !== 'flight' || !s.m) return; var m = s.m, c = m.c, o = m.o, now = Date.now();
  var keys = RG.LevelKit.keys; // the script holds the same buttons a player would; the game sends them
  if (N.mine('pilot')) { keys.left = m.phase === 'climb' && c.err > 2.5; keys.right = m.phase === 'climb' && c.err < -2.5; }
  if (N.mine('navigator')) keys.burn = !!o && (m.phase === 'coast' || m.phase === 'orbit') && !o.inOrbit && o.vr < 80;
  if (now - (window.__last || 0) < 350) return;
  if (N.mine('engineer')) { if (c.bOn && c.bEmpty) { N.act('boosters'); window.__last = now; } else if (m.phase === 'staging') { N.act('separate'); window.__last = now; } }
  if (N.mine('payload')) { if (m.phase === 'climb' && c.alt >= 101 && !c.fair && c.steady) { N.act('fairing'); window.__last = now; } else if (m.phase === 'orbit' && !o.burning) { N.act('deploy'); window.__last = now; } } }, 60)"""
errs = {}
def page(b, name, w, h, mobile, url):
    ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, has_touch=mobile, is_mobile=mobile, service_workers="block")
    p = ctx.new_page(); errs[name] = []
    p.on("pageerror", lambda e: errs[name].append(str(e)[:300]))
    p.on("console", lambda m: errs[name].append(m.text[:200]) if m.type == "error" and "GL Driver" not in m.text and "swiftshader" not in m.text.lower() else None)
    p.goto(url, timeout=150000, wait_until="domcontentloaded"); p.wait_for_function("window.RG && window.RG.App && window.RG.Stage && window.RG.Stage.ready", timeout=150000)
    # Drawing 3D in software takes over a second a frame, and three pages share one processor: a script could not
    # steer in time. So the picture is drawn only for the screenshots; everything else runs at full speed.
    p.evaluate("(function(){var r=RG.Stage.renderer; window.__draw=r.render.bind(r); r.render=function(){};})()")
    return p
js = lambda p, code: p.evaluate(code)
press = lambda p, sel: p.evaluate("document.querySelector(%s).click()" % json.dumps(sel))
def shot(p, name):
    p.evaluate("(function(){ RG.Stage.renderer.render = window.__draw; })()"); p.wait_for_timeout(1600)
    p.screenshot(path=os.path.join(SHOTS, name + ".png")); p.evaluate("(function(){ RG.Stage.renderer.render = function(){}; })()")
def fits(p, sel):
    return js(p, "(function(){var es=document.querySelectorAll(%s); if(!es.length) return 'missing'; return Array.from(es).every(function(e){var r=e.getBoundingClientRect(); return r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1})?'fits':'OFF SCREEN'})()" % json.dumps(sel))
try:
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=ARGS)
        # ---- the first player makes the crew ----
        a = page(b, "Asha", 1100, 700, False, base + "/?quality=low")
        press(a, '[data-act="play"]'); a.wait_for_timeout(400); print("map has a Crew online button:", fits(a, '.crewnet-btn'))
        press(a, '.crewnet-btn'); a.wait_for_selector('#cr-name', timeout=45000)
        js(a, "document.getElementById('cr-name').value = 'Asha'"); press(a, '[data-lv="crewCreate"]')
        a.wait_for_function("RG.CrewNet.active && document.getElementById('cr-link') && document.getElementById('cr-link').value.length > 5", timeout=45000)
        code = js(a, "RG.CrewNet.state.code"); link = js(a, "document.getElementById('cr-link').value")
        print("crew", code, "| link to share:", link, "| alone, Asha has:", js(a, "RG.CrewNet.seats().join(', ')"))
        # ---- the second joins on a phone, through the shared link; the third types the code ----
        ben = page(b, "Ben", 390, 780, True, base + "/?crew=" + code.lower() + "&quality=low")
        ben.wait_for_selector('#cr-code', timeout=45000)
        print("the link opens the door with the code filled in:", js(ben, "document.getElementById('cr-code').value"), "| door", fits(ben, '#lv-side'))
        js(ben, "document.getElementById('cr-name').value = 'Ben'"); shot(ben, "n0-door-phone"); press(ben, '[data-lv="crewJoin"]')
        ben.wait_for_function("RG.CrewNet.active", timeout=45000)
        chen = page(b, "Chen", 900, 600, False, base + "/?quality=low")
        press(chen, '[data-act="play"]'); chen.wait_for_timeout(300); press(chen, '.crewnet-btn'); chen.wait_for_selector('#cr-code', timeout=45000)
        js(chen, "document.getElementById('cr-name').value = 'Chen'; document.getElementById('cr-code').value = 'zzzz'"); press(chen, '[data-lv="crewJoin"]')
        chen.wait_for_function("document.getElementById('cr-err') && document.getElementById('cr-err').textContent.length > 3", timeout=45000)
        print("a wrong code:", js(chen, "document.getElementById('cr-err').textContent"))
        js(chen, "document.getElementById('cr-name').value = 'Chen'; document.getElementById('cr-code').value = %s" % json.dumps(code)); press(chen, '[data-lv="crewJoin"]')
        chen.wait_for_function("RG.CrewNet.active", timeout=45000)
        a.wait_for_function("RG.CrewNet.state.players.length === 3", timeout=45000); a.wait_for_timeout(500)
        print("seats:", js(a, "RG.Crew.SEATS.map(function(k){return k+': '+RG.CrewNet.nameOf(RG.CrewNet.state.seats[k])}).join(' | ')"))
        shot(a, "n1-lobby"); shot(ben, "n1-lobby-phone")
        # ---- the poll ----
        press(a, '[data-lv="crewGo"]'); press(ben, '[data-lv="crewGo"]'); a.wait_for_timeout(500)
        print("two of three are go:", js(a, "RG.CrewNet.state.stage"), "|", js(a, "document.getElementById('cr-wait').textContent"))
        for p in (a, ben, chen): js(p, BOT)
        press(chen, '[data-lv="crewGo"]')
        a.wait_for_function("RG.CrewNet.state.stage === 'flight'", timeout=20000)
        t0 = time.time(); a.wait_for_timeout(6000)
        print("in flight after the count. consoles: Asha", js(a, "document.querySelectorAll('.cr-con').length"), fits(a, '.cr-con'), "| Ben", js(ben, "document.querySelectorAll('.cr-con').length"), fits(ben, '.cr-con'), "| Chen", js(chen, "document.querySelectorAll('.cr-con').length"), fits(chen, '.cr-con'),
              "| controls:", fits(a, '.co-pad button'), fits(ben, '.co-pad button'), fits(chen, '.co-pad button'))
        print("  the same flight on every screen: altitude", [js(p, "RG.CrewNet.state.m.c.alt") for p in (a, ben, chen)], "km")
        shot(a, "n2-climb-pilot"); shot(ben, "n2-climb-engineer-phone"); shot(chen, "n2-climb-navigator")
        a.wait_for_function("RG.CrewNet.state.m.o || RG.CrewNet.state.stage === 'over'", timeout=90000); a.wait_for_timeout(5000)
        print("after main engine cut-off: phase", js(a, "RG.CrewNet.state.m.phase"), "| view", js(a, "RG.LevelKit.cur.peek().view"), "/", js(a, "RG.Views.name"))
        shot(chen, "n3-orbit-navigator")
        a.wait_for_function("RG.CrewNet.state.stage === 'over'", timeout=120000); a.wait_for_timeout(1500)
        r = js(a, "RG.CrewNet.state.result")
        print("flight over in %.0f s: ok %s, crew stars %s, orbit %s" % (time.time() - t0, r["ok"], r["stars"], json.dumps(r["orbit"])))
        for k in ("pilot", "engineer", "navigator", "payload"): print("   %-9s %-5s %s stars  %s" % (k, r["seats"][k]["who"], r["seats"][k]["stars"], r["seats"][k]["line"]))
        print("  the guide's last words:", (js(a, "document.getElementById('lv-say').textContent") or "")[:80], "| events:", js(a, "RG.CrewNet.state.ev.map(function(e){return e[1]}).join(',')"))
        print("  result sheet: Asha", js(a, "(document.querySelector('#lv-sheet h2')||{}).textContent"), fits(a, '#lv-sheet'), "| Ben", fits(ben, '#lv-sheet'), "| Chen", fits(chen, '#lv-sheet'))
        shot(a, "n4-result"); shot(ben, "n4-result-phone")
        press(chen, '[data-lv="crewAgain"]'); a.wait_for_function("RG.CrewNet.state.stage === 'lobby'", timeout=45000); a.wait_for_timeout(500)
        print("back in the briefing room for everyone:", [js(p, "RG.LevelKit.cur.peek().screen") for p in (a, ben, chen)])
        # a reloaded page goes back to its own seat
        ben.reload(timeout=150000, wait_until="domcontentloaded"); ben.wait_for_function("window.RG && RG.CrewNet && RG.CrewNet.active", timeout=150000)
        print("Ben reloads the page and is back in his seat:", js(ben, "RG.CrewNet.seats().join(', ')"), "| players:", js(a, "RG.CrewNet.state.players.length"))
        press(a, '[data-lv="quit"]'); chen.wait_for_function("RG.CrewNet.state.players.length === 2", timeout=45000)
        print("Asha leaves; the seats are dealt again:", js(chen, "RG.Crew.SEATS.map(function(k){return k+': '+RG.CrewNet.nameOf(RG.CrewNet.state.seats[k])}).join(' | ')"))
        print("page errors:", {k: v for k, v in errs.items() if v} or "none")
        b.close()
finally:
    srv.terminate()
    try: print("server said:", (srv.communicate(timeout=5)[0] or "").strip().replace("\n", " / ")[:600])
    except Exception: pass
