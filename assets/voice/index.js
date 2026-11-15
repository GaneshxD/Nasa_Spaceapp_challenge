/* Orbit Ranger — the guide's recordings. Written by tools/voice/lines.js --index; the words of every line are in
 * tools/voice/lines.json and tools/voice/README.md says how the recordings are made.
 * Voice: Higgsfield preset "Nadine", model Seed Audio 1.0. */
(function (root) {
  var RG = (root.RG = root.RG || {});
  // recordings with a name: the first clips of level 6, and two short ones used in front of a quiz answer
  RG.VOICE_CLIPS = {
      "plan": "Plan your Moon landing! Pick a landing site, pack your science kit, then press go.",
      "sit1": "There are no seats! Apollo astronauts flew standing up.",
      "sit2": "See the yellow ring on the ground? That is where we want to land.",
      "sit3a": "The computer runs the engine. You lean the lander. Just follow the arrows!",
      "sit3m": "You have the engine and the steering. Follow the arrows, and good luck!",
      "descent": "Here we go! Lean back to slow down.",
      "alarm": "Program alarm! Don’t worry. Mission control says: go!",
      "boulders": "Boulders on the target! Fly on to the new ring.",
      "fuel30": "Thirty seconds of fuel!",
      "dust": "We are kicking up dust. Nice and slow now.",
      "touchdown": "Touchdown! You are on the Moon!",
      "crash": "Oh no! Let’s see what went wrong, and try again.",
      "egress": "One small step! Walk to the glowing rings.",
      "earth": "Look at the sky! That blue ball is Earth, our home.",
      "jump": "What a jump! Gravity on the Moon is six times weaker than on Earth.",
      "flag": "The flag of Nepal is on the Moon! There is no wind here, so it stands perfectly still.",
      "rocks": "Moon rocks! They show the Moon is four and a half billion years old.",
      "seismo": "The moonquake sensor is listening. Yes, the Moon has quakes!",
      "mirror": "The laser mirror is ready. Scientists on Earth can bounce lasers off it.",
      "drill": "Drilling done. The Moon is still warm inside!",
      "o2low": "Oxygen is getting low. Head back to the lander!",
      "done": "Every job is done. Walk back to the lander and climb in.",
      "report": "Mission complete! Great work, Ranger.",
      "heavy": "Too heavy! Leave something behind.",
      "s11": "Apollo eleven. The Sea of Tranquility. Flat and safe. The very first Moon landing happened here.",
      "s12": "Apollo twelve. The Ocean of Storms. Flat ground, with lots of craters.",
      "s14": "Apollo fourteen. The Fra Mauro hills. Bumpy ground, and very old rocks.",
      "s15": "Apollo fifteen. Hadley Rille. Tall mountains and a deep canyon. Great science!",
      "s16": "Apollo sixteen. The Descartes highlands. Rough, bright, ancient ground.",
      "s17": "Apollo seventeen. A narrow valley between giant mountains. The hardest landing.",
      "k_flag": "The flag of Nepal, and a TV camera so the whole world can watch.",
      "k_rocks": "Rock boxes. Bring Moon rocks home for scientists.",
      "k_seismo": "A moonquake sensor. It feels the Moon shake.",
      "k_mirror": "A laser mirror. It measures how far away the Moon is.",
      "k_drill": "A heat drill. It is heavy, but it is great science.",
      "k_oxygen": "Extra oxygen. One more minute to explore.",
      "yes": "Yes!",
      "notquite": "Not quite."
  };
  // recordings of the guide's lines, named from their words (RG.Voice.key): assets/voice/<name>.mp3
  RG.VOICE_LINES = 'g1pwpfn5 g0ndvrkf g1hdr41f g1c9v902 g18hrtd5 g014tg55 g1aeebmj g0c5bsx9 g1rz6sv6 g0norwq6 g1gkaw2w g18m8zsj g0p0vehx g0a2hmns g1ehfoid g0bkp3sm g1vjar9g g14dc3sp g0t1yb3r g10xcqws g1awh1ar g1hsmy5k g1nxq62u g15ijlwb g1ymd12g g0vewncc g0h34i99 g0u41os9 g0qygefx g19k7nqg g0pe8ke5 g1bu5vys g0vdv0e9 g1fxd01y g1ahq73t g1i9x95w g1rs70wh g0d9oyns g0zv3sbw g0s1vdxu g1t332eb g0zvzz4l g0rhp93d g1wfo74s g135l0yu g04fo3a0 g1xbgnym g1ksfrwq g0eob4o3 g1b9o25o g09tpjo2 g1c83yyq g1m841kh g0oizpgs g036wpo8 g1wpbfek g1beol22 g1drwh7l g1pelot9 g0dgr6uq g0ortq8w g1azcuab g0shyp3e g136l3cd g06arkxx g1t7q1lp g1v1ubji g1fbxv12 g1ridbkx g1cxwcdo g0q70wem g09yppjp g0sxgsuo g02mrvzt g0k4kz8t g0zjp3jc g00h67y4 g08pmfv7 g0259kvh g01jua3j g0py1dav g1de1n6x g1xqtwu6 g1m07ez9 g1x7per3 g0bv4zns g1nawgyk g0uautm0 g1vshdov g1c6b1mu g0hmyacy g0h092h6 g1eqcsle g1shoflt g1y729xf g1qqzpbk g1ndb86e g1yhg5q2 g1lyeny7 g1x79kuw g1lxtse5 g0akn3ys g0mvjfm1 g0m4g0oh g03ilf9d g0mzq4nw g00g1aax g14kpfj4 g1ehinsv g1veotdm g1htypgj g01fmg0e g0x6zk4w g0wqvbof g01twzb4 g0b4z15h g19oa356 g0wef5ky g0t6h6rn g1qvixtj g17tripg g06w5pak g1ofmwc5 g1uyubjh g1wk771i g1yhn9g6 g179whtd g0xch4q2 g0b4ek7e'.split(' ');
  // recordings of word explanations: assets/voice/words/<word>.mp3, fetched when first asked for
  RG.VOICE_WORDS = 'thrust weight mass twr propellant lox lh2 mixture engine isp booster staging separation fairing payload upperstage gyro altitude speed velocity vspeed hspeed accel gforce pitch yaw roll attitude gravityturn maxq q karman meco wind throttle orbit orbitalv apoapsis periapsis period burn prograde retrograde deltav circularize leo polar geo parking pixel swath infrared eclipse downlink station watt wh bus radiation gb mbps frp wheel firms modis comms telemetry tracking uplink lineofsight los aos farside delay missioncontrol capcom antenna callout lm deorbit doi pdi moongravity hover hovertime range glidepath guidance alarm redesignate gear contact autopilot eva lifesupport regolith mare highlands seismometer retroreflector heatflow sample vacuum gonogo margin tradeoff budget requirement pilot engineer checklist'.split(' ');
  // true: a line with no recording is read by the browser's own voice instead of staying silent
  RG.VOICE_FALLBACK = false;
})(typeof window !== "undefined" ? window : globalThis);
