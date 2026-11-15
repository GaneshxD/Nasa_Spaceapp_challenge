"""Serve the game, open it headless, collect console errors, take screenshots. The software renderer here draws
under one frame a second, so warp() makes each drawn frame advance the game by the real time that passed, in
1/30 s steps: game time then runs at true speed (times `__speed`) however slowly the pictures come."""
import http.server, socketserver, threading, socket, json
from playwright.sync_api import sync_playwright
import os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SHOTS = os.path.join(HERE, "shots"); os.makedirs(SHOTS, exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(self, *a): pass
def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p
ARGS = ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--autoplay-policy=no-user-gesture-required"]
WARP = """(function(){ if (window.__warped) return; window.__warped = true; window.__speed = window.__speed || 1;
  var fns = RG.Stage.frameFns, orig = fns.slice(), last = performance.now(); fns.length = 0;
  fns.push(function (dt, time) { var now = performance.now(), real = Math.min(2.5, (now - last) / 1000) * window.__speed; last = now;
    var n = Math.max(1, Math.min(300, Math.round(real * 30)));
    for (var i = 0; i < n; i++) for (var j = 0; j < orig.length; j++) orig[j](1 / 30, time); }); })()"""
class Game:
    def __init__(self, w=900, h=600, mobile=False, query="?quality=low", pre=None):
        self.port = free_port()
        socketserver.TCPServer.allow_reuse_address = True
        self.srv = socketserver.ThreadingTCPServer(("127.0.0.1", self.port), Quiet); self.srv.daemon_threads = True
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.pw = sync_playwright().start(); self.b = self.pw.chromium.launch(args=ARGS)
        self.ctx = self.b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, has_touch=mobile, is_mobile=mobile, service_workers="block")
        self.p = self.ctx.new_page(); self.errors = []
        self.p.on("console", lambda m: self.errors.append(("console." + m.type, m.text)) if m.type in ("error", "warning") else None)
        self.p.on("pageerror", lambda e: self.errors.append(("pageerror", str(e) + " :: " + (getattr(e, "stack", "") or "")[:400])))
        self.p.on("requestfailed", lambda r: self.errors.append(("requestfailed", r.url)))
        self.p.goto(f"http://127.0.0.1:{self.port}/index.html{query}")
        self.p.wait_for_function("window.RG && window.RG.App && window.RG.Stage && window.RG.Stage.ready", timeout=90000)
        if pre: self.js(pre)      # frame callbacks that must run inside every sub-step go in before the warp
        self.js(WARP); self.wait(0.5)
    def wait(self, s): self.p.wait_for_timeout(int(s * 1000))
    def js(self, code): return self.p.evaluate(code)
    def speed(self, x): self.js(f"window.__speed = {x}")
    def shot(self, name): self.p.screenshot(path=os.path.join(SHOTS, name + ".png"))
    def click(self, sel, **k): self.p.click(sel, **k)
    def text(self, sel): return self.js(f"(function(){{var e=document.querySelector({json.dumps(sel)}); return e?e.textContent:null}})()")
    def errs(self):
        skip = ("GL Driver Message", "GPU stall", "swiftshader", "Service Worker registration blocked")
        return [e for e in self.errors if not any(s.lower() in e[1].lower() for s in skip)]
    def close(self):
        try: self.b.close(); self.pw.stop()
        finally: self.srv.shutdown(); self.srv.server_close()
