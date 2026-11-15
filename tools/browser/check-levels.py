import sys, os, json; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import Game
g = Game(w=1100, h=700)
def step(name, fn):
    n = len(g.errs())
    try: fn()
    except Exception as e: print("STEP FAILED", name, str(e)[:300])
    new = g.errs()[n:]
    print(("ok   " if not new else "ERR  ") + name, *[e for e in new])
step("title", lambda: g.shot("s01-title"))
step("words dialog", lambda: (g.click('[data-act="words"]'), g.wait(0.4), g.shot("s02-words"), print("   terms listed:", g.js("document.querySelectorAll('.gl-item').length")), g.click('#dialog [data-act="close"]'), g.wait(0.2)))
step("map", lambda: (g.click('[data-act="play"]'), g.wait(0.4), g.click('[data-lv="unlock"]'), g.wait(0.3)))
# the freeze: straight from the map into level 3
def l3():
    g.js("RG.Levels.actions.go({dataset:{id:'3'}})"); g.wait(1.5)
    g.js("window.__n=0; RG.Stage.onFrame(function(){window.__n++})"); g.wait(1.5)
    print("   frames still running after entering level 3 from the map:", g.js("window.__n") > 0, "| view:", g.js("RG.Views.name"), "| frameErr:", g.js("String(RG.Stage.frameErr||'none')"))
    g.shot("s03-l3-pad")
    g.click('[data-lv="launch"]'); g.wait(5)
    g.js("document.querySelector('#da-q-box').click()"); g.wait(0.5)
    print("   popover open:", g.js("document.querySelector('#explain.is-on .ex-head b').textContent"), "| paused:", g.js("RG.LevelKit.paused"))
    g.shot("s04-l3-explain")
    g.p.keyboard.press("Escape"); g.wait(0.3)
    print("   after Esc paused:", g.js("RG.LevelKit.paused"), "| alt:", g.text('#al-n'), "| v:", g.text('#da-v'), g.text('#da-vv'), g.text('#da-vh'), "| g:", g.text('#da-g'), "| q:", g.text('#da-q'))
step("level 3 from the map (the freeze)", l3)
def l1():
    g.js("RG.Levels.actions.go({dataset:{id:'1'}})"); g.wait(1.3)
    g.js("document.querySelectorAll('.pin-btn')[4].click()"); g.wait(0.9); g.shot("s05-l1")
    print("   pip says:", g.text('#lv-say'))
step("level 1", l1)
def l2():
    g.js("RG.Levels.actions.go({dataset:{id:'2'}})"); g.wait(1.2)
    g.click('.tile[data-group="tank"][data-key="M"]'); g.wait(0.4)   # a plain tap
    g.click('.tile[data-group="engines"][data-key="E3"]'); g.wait(0.4)
    g.click('.tile[data-group="boosters"][data-key="two"]'); g.wait(0.6); g.shot("s06-l2")
    print("   picked by tapping:", g.js("JSON.stringify(Array.from(document.querySelectorAll('.tile[aria-pressed=true]')).map(function(e){return e.dataset.key}))"))
    g.click('[data-lv="test"]'); g.wait(0.6); print("   test flight sheet:", g.text('#lv-sheet h2')); g.shot("s07-l2-done")
step("level 2 (tap to pick)", l2)
def l4():
    g.js("RG.Levels.actions.go({dataset:{id:'4'}})"); g.wait(2.5); g.shot("s08-l4")
    print("   readouts:", g.text('#da-v'), "|", g.text('#da-vn'), "| peri", g.text('#da-p'), "| apo", g.text('#da-a'), "|", g.text('#da-l'))
step("level 4", l4)
print("total errors:", len(g.errs())); [print("  ", e) for e in g.errs()]
g.close()
