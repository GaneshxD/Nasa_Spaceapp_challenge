/* Orbit Ranger — game catalog.
 * Every part, orbit, rocket and piece of teaching text lives here, so the
 * numbers can be tuned (or translated) without touching game logic.
 *
 * Numbers are simplified, but each one is scaled from a real mission or a
 * real class of hardware (see README.md, "Where the numbers come from").
 * Units: mass kg, power W, cost $ million, data GB per day.
 */
(function (root) {
  'use strict';
  var RG = (root.RG = root.RG || {});

  var MISSION = {
    name: 'Wildfire Watch',
    satellite: 'Ranger-1',
    years: 3,
    goalHours: 12,
    fastHours: 6,
    opsCost: 6, // mission control team for three years
    goals: [
      { id: 'everywhere', text: 'See fires anywhere on Earth' },
      { id: 'small', text: 'Spot fires while they are still small' },
      { id: 'fast', text: 'Warn firefighters within 12 hours' },
      { id: 'survive', text: 'Keep working for 3 years in space' },
      { id: 'budget', text: 'Stay inside the budget' }
    ]
  };

  var DIFFICULTY = {
    cadet: {
      name: 'Cadet',
      budget: 200,
      note: 'Plenty of money and the coach explains every warning.',
      hints: true
    },
    engineer: {
      name: 'Engineer',
      budget: 120,
      note: 'A normal budget. You will have to give something up.',
      hints: true
    },
    chief: {
      name: 'Chief designer',
      budget: 80,
      note: 'A tight budget and no automatic hints.',
      hints: false
    },
    sandbox: {
      name: 'Sandbox',
      budget: Infinity,
      note: 'No budget limit. Try wild ideas and see what happens.',
      hints: true
    }
  };

  // Crew roles for team play (1–4 players share these four consoles).
  var ROLES = {
    science: { name: 'Science lead', color: '#D43D20', job: 'Chooses what the satellite looks with.' },
    nav: { name: 'Flight navigator', color: '#2563C9', job: 'Chooses the orbit and the rocket.' },
    eng: { name: 'Spacecraft engineer', color: '#128A5E', job: 'Builds the body and the power system.' },
    comms: { name: 'Data officer', color: '#8A4FBF', job: 'Chooses the computer, steering and radio.' }
  };
  var ROLE_ORDER = ['science', 'nav', 'eng', 'comms'];

  /* ---------- Step 1: fire sensor (pick one) ---------- */
  var SENSORS = {
    mini: {
      name: 'Pocket heat camera',
      icon: 'cam',
      mass: 8, power: 12, cost: 4, data: 2,
      ifov: 0.98e-3, scanHalfDeg: 45,
      blurb: 'A small camera that feels heat. Light and cheap, with a medium-wide view. Its pixels are big, so it has to fly low to catch small fires.',
      real: 'The NASA-funded HyTI CubeSat, launched in 2024, carries a heat camera inside a satellite the size of a shoebox.'
    },
    wide: {
      name: 'Wide heat scanner',
      icon: 'scan',
      mass: 95, power: 110, cost: 26, data: 40,
      ifov: 0.455e-3, scanHalfDeg: 56,
      blurb: 'A mirror sweeps side to side and paints a strip of Earth thousands of kilometres wide. Sharp enough to catch small fires.',
      real: 'Scaled from VIIRS on the NASA/NOAA Suomi NPP satellite: 375 m fire pixels across a 3,000 km strip.'
    },
    giant: {
      name: 'Giant heat telescope',
      icon: 'scope',
      mass: 300, power: 420, cost: 60, data: 120,
      ifov: 0.056e-3, scanHalfDeg: 9,
      blurb: 'A huge telescope with super-sharp pixels. Up close it only sees a thin strip, so it is built for watching from very far away.',
      real: 'Scaled from the Advanced Baseline Imager on the GOES weather satellites, which NASA builds and launches for NOAA: 2 km heat pixels from 35,786 km up.'
    }
  };

  /* ---------- Step 1b: bonus science tools (pick any) ---------- */
  var EXTRAS = {
    color: {
      name: 'Colour camera',
      icon: 'eye',
      mass: 12, power: 20, cost: 4, data: 15,
      blurb: 'Takes ordinary colour photos. Shows smoke clouds and burned land so crews can plan.',
      real: 'The NASA and USGS Landsat satellites have taken colour pictures of Earth since 1972.'
    },
    smoke: {
      name: 'Smoke sniffer',
      icon: 'cloud',
      mass: 22, power: 30, cost: 8, data: 4,
      blurb: 'Measures smoke and gases in the air, so towns downwind can be warned about bad air.',
      real: 'NASA’s TEMPO instrument measures air pollution over North America every hour.'
    },
    lightning: {
      name: 'Lightning spotter',
      icon: 'bolt',
      mass: 18, power: 25, cost: 7, data: 3,
      blurb: 'Counts lightning flashes. Lightning starts many wildfires, so this tells crews where to look next.',
      real: 'NASA’s Lightning Imaging Sensor counted lightning from the Space Station from 2017 to 2023.'
    }
  };

  /* ---------- Step 2: orbit ---------- */
  var ORBITS = {
    leo: {
      name: 'Low Earth orbit',
      short: 'Low orbit',
      alt: 500, inc: 51.6, raanDeg: 0, kind: 'leo',
      blurb: 'Close to Earth and tilted, like the Space Station’s path. Easy for rockets to reach. It never flies over the far north or far south.',
      real: 'The International Space Station flies a path like this, about 400 km up.'
    },
    sso: {
      name: 'Polar sun-synchronous orbit',
      short: 'Polar orbit',
      alt: 700, inc: 98.19, raanDeg: 22.5, kind: 'sso',
      blurb: 'Flies over the poles while Earth turns underneath, so every place slides into view. It crosses each spot at the same clock time, early afternoon and deep night.',
      real: 'NASA’s Terra and Aqua, Landsat and Suomi NPP all fly polar sun-synchronous orbits. Terra and Aqua found every fire in this game.'
    },
    geo: {
      name: 'Geostationary orbit',
      short: 'Far orbit',
      alt: 35786, inc: 0, raanDeg: 0, kind: 'geo', lon: -75,
      blurb: 'So high that one lap takes exactly one day, so the satellite seems to hang over one spot (here, the Americas). It stares at one third of Earth non-stop, from 70 times farther away.',
      real: 'GOES-East watches the Americas from this orbit, parked above 75° west. NASA’s TDRS relay satellites sit in far orbit too.'
    }
  };

  /* ---------- Step 3: body (the “bus”) ---------- */
  var BUSES = {
    mini: {
      name: 'Mini body', icon: 'box',
      mass: 40, payloadCap: 35, power: 12, cost: 5, panels: ['S', 'M'],
      size: [0.6, 0.8, 0.6],
      blurb: 'About the size of a washing machine. Cheap and light, but there is not much room on board.',
      real: 'NASA’s CubeSat Launch Initiative gives small satellites like this shared rides to orbit.'
    },
    midi: {
      name: 'Midi body', icon: 'box',
      mass: 170, payloadCap: 160, power: 45, cost: 16, panels: ['S', 'M', 'L'],
      size: [1.2, 1.6, 1.2],
      blurb: 'About the size of a fridge-freezer. Room for a serious instrument and a few extras.',
      real: 'NASA’s ICON and TESS science satellites are about this size, around 300 kg.'
    },
    maxi: {
      name: 'Maxi body', icon: 'box',
      mass: 620, payloadCap: 600, power: 130, cost: 42, panels: ['M', 'L'],
      size: [2.1, 3.0, 2.1],
      blurb: 'As big as a van. Carries the heaviest instruments, and needs a big rocket to match.',
      real: 'Weather satellites such as GOES are in this heavyweight class.'
    }
  };

  /* ---------- Step 4: power ---------- */
  var PANELS = {
    S: { name: 'Small solar wings', icon: 'sun', watts: 150, mass: 5, cost: 0.8, segs: 1,
         blurb: 'Two short wings. Enough to run a small camera and a small radio.' },
    M: { name: 'Medium solar wings', icon: 'sun', watts: 500, mass: 18, cost: 2.5, segs: 2,
         blurb: 'Two long wings. Enough for one big instrument.' },
    L: { name: 'Large solar wings', icon: 'sun', watts: 1600, mass: 60, cost: 7, segs: 4,
         blurb: 'Huge wings for power-hungry telescopes. Heavy, and too big for a mini body.' }
  };
  var BATTERIES = {
    S: { name: 'Small battery', icon: 'batt', wh: 100, mass: 1.5, cost: 0.3,
         blurb: 'Stores a little energy for the dark side of each lap.' },
    M: { name: 'Medium battery', icon: 'batt', wh: 400, mass: 6, cost: 1,
         blurb: 'Stores enough to keep a mid-sized satellite awake in the dark.' },
    L: { name: 'Large battery', icon: 'batt', wh: 1500, mass: 22, cost: 3,
         blurb: 'A big energy tank for big, hungry satellites.' }
  };

  /* ---------- Step 5: brain and steering ---------- */
  var COMPUTERS = {
    basic: { name: 'Basic computer', icon: 'chip', mass: 1.5, power: 8, cost: 0.8, storage: 32, radHard: false, ai: false,
             blurb: 'Like a phone’s brain. Cheap, but space radiation can make it crash, and it only holds 32 GB.' },
    rad: { name: 'Shielded computer', icon: 'chip', mass: 4, power: 15, cost: 3.5, storage: 128, radHard: true, ai: false,
           blurb: 'Built to shrug off radiation, and holds 128 GB of pictures until they can be sent home.' },
    ai: { name: 'Smart computer', icon: 'chip', mass: 5, power: 35, cost: 7, storage: 256, radHard: true, ai: true,
          blurb: 'Shielded, holds 256 GB, and finds fires by itself. It sends a tiny alert through relay satellites within minutes, without waiting for a ground station.' }
  };
  var POINTING = {
    magnets: { name: 'Magnetic steering', icon: 'magnet', mass: 1, power: 2, cost: 0.5, blur: 2, spare: false, wheels: 0,
               blurb: 'Electromagnets push gently against Earth’s magnetic field. Simple, with nothing to wear out, but the satellite wobbles, so pictures come out twice as blurry.' },
    wheels3: { name: 'Three reaction wheels', icon: 'wheel', mass: 6, power: 12, cost: 2.5, blur: 1, spare: false, wheels: 3,
               blurb: 'Spinning wheels hold the satellite rock-steady for sharp pictures. If one wheel breaks, there is no spare.' },
    wheels4: { name: 'Four wheels and a star tracker', icon: 'wheel', mass: 9, power: 16, cost: 4.5, blur: 1, spare: true, wheels: 4,
               blurb: 'Rock-steady pointing plus a spare wheel, and a tiny camera that steers by the stars.' }
  };

  /* ---------- Step 6: radio and ground stations ---------- */
  var RADIOS = {
    sband: { name: 'Small radio', icon: 'radio', mbps: 4, mass: 2, power: 10, cost: 0.8, cloud: 0,
             blurb: 'A simple, reliable radio. Slow: one phone photo takes it about six seconds to send.' },
    xband: { name: 'Fast dish', icon: 'dish', mbps: 150, mass: 10, power: 45, cost: 3.5, cloud: 0,
             blurb: 'A dish antenna that sends data nearly 40 times faster than the small radio.' },
    laser: { name: 'Laser link', icon: 'laser', mbps: 1200, mass: 14, power: 60, cost: 9, cloud: 0.3,
             blurb: 'Sends data on a beam of light, 300 times faster than the small radio. Clouds over the station block the beam about one pass in three.',
             real: 'In 2023 NASA’s tiny TBIRD satellite sent data to the ground by laser at 200 gigabits per second.' }
  };
  var STATIONS = {
    // Four ground stations of NASA's Near Space Network.
    wallops: { name: 'Wallops, USA', lat: 37.94, lon: -75.46 },
    mcmurdo: { name: 'McMurdo, Antarctica', lat: -77.85, lon: 166.67 },
    alaska: { name: 'Fairbanks, Alaska', lat: 64.86, lon: -147.85 },
    whitesands: { name: 'White Sands, USA', lat: 32.50, lon: -106.61 }
  };
  var NETWORKS = {
    one: { name: 'One station', icon: 'pin', sites: ['wallops'], cost: 1.5,
           blurb: 'NASA’s Wallops station in Virginia, USA. The satellite can only send data while it is flying past.',
           real: 'Wallops Flight Facility has tracked NASA satellites since the 1960s.' },
    two: { name: 'Two stations', icon: 'pin', sites: ['wallops', 'mcmurdo'], cost: 3,
           blurb: 'Adds NASA’s McMurdo station in Antarctica. A polar-orbit satellite flies past it on every lap.',
           real: 'NASA’s McMurdo Ground Station, near the South Pole, collects data from polar-orbit satellites.' },
    four: { name: 'Four stations', icon: 'pin', sites: ['wallops', 'mcmurdo', 'alaska', 'whitesands'], cost: 6,
            blurb: 'Adds NASA’s stations in Fairbanks, Alaska and White Sands, New Mexico. More places to listen means shorter waits.',
            real: 'Together these sites are part of NASA’s Near Space Network.' }
  };

  /* ---------- Step 7: rocket ---------- */
  var ROCKETS = {
    rideshare: { name: 'Shared ride', icon: 'rocket', cost: 2.5, cap: { sso: 315 }, style: 'medium',
                 blurb: 'Buy one seat on a big rocket carrying many small satellites. Very cheap, but it only goes to the polar orbit and your satellite must be light.' },
    small: { name: 'Small rocket', icon: 'rocket', cost: 9, cap: { leo: 320, sso: 220 }, style: 'small',
             blurb: 'Your own little rocket. It goes exactly where you want in low orbit, if your satellite is light enough.' },
    medium: { name: 'Medium rocket', icon: 'rocket', cost: 32, cap: { leo: 2500, sso: 1600, geo: 350 }, style: 'medium',
              blurb: 'Lifts a fridge-sized satellite anywhere near Earth, or a small one all the way to far orbit.' },
    heavy: { name: 'Heavy rocket', icon: 'rocket', cost: 68, cap: { leo: 16000, sso: 10000, geo: 4500 }, style: 'heavy',
             blurb: 'A giant with extra boosters. The only way to carry a heavy satellite to far orbit.' }
  };

  /* ---------- The world: 14 fire zones, built from real NASA fire detections ----------
   * assets/nasa-fires.js holds nine real 2023 fires for each zone, taken from
   * NASA FIRMS (MODIS on the Terra and Aqua satellites). Each zone's position
   * here is the middle of its nine fires. */
  if (!RG.NASA_FIRES) throw new Error('Load assets/nasa-fires.js before js/data.js');
  var FIRE_ZONES = RG.NASA_FIRES.zones.map(function (z) {
    return { name: z.name, lat: z.lat, lon: z.lon, country: z.country, detections2023: z.detections2023 };
  });

  // Size comes from the real fire's heat output as MODIS measured it (fire
  // radiative power, in megawatts). The rule for which pixels can catch which
  // size, early enough to matter, is a game model: maxPixel is in metres.
  var FIRE_SIZES = {
    small: { name: 'small', maxPixel: 500, perYear: 6, frp: 'under 30 megawatts' },
    medium: { name: 'medium', maxPixel: 2500, perYear: 5, frp: '40 to 150 megawatts' },
    large: { name: 'large', maxPixel: 10000, perYear: 3, frp: 'over 200 megawatts' }
  };

  /* ---------- Surprises during the mission ---------- */
  var EVENTS = {
    storm: {
      title: 'Solar storm',
      story: 'The Sun throws a blast of radiation at Earth.',
      good: 'Your shielded computer does not even blink.',
      bad: 'Your basic computer crashes. The satellite is blind for {h} hours while engineers restart it.',
      lesson: 'Space is full of radiation. Parts built for it cost more, and keep working when the Sun acts up.'
    },
    wheel: {
      title: 'A reaction wheel wears out',
      story: 'After millions of spins, one steering wheel stops turning.',
      good: 'The spare wheel takes over. Pictures stay sharp.',
      bad: 'With only two wheels the satellite wobbles. Pictures are twice as blurry from now on.',
      none: 'Your magnetic steering has no spinning parts, so there is nothing to break.',
      lesson: 'A spare is extra mass and money you hope never to use. NASA’s Kepler telescope lost two of its four wheels and had to change its whole mission.'
    },
    station: {
      title: 'Storm at Wallops',
      story: 'A hurricane shuts the Virginia ground station for 12 hours.',
      good: 'Your other stations keep listening. Nothing is lost.',
      bad: 'It was your only station. For 12 hours the satellite has nobody to talk to.',
      relay: 'It was your only station, but the smart computer keeps sending alerts through relay satellites.',
      lesson: 'More ground stations means no single storm can cut you off.'
    },
    panel: {
      title: 'Space dust strike',
      story: 'A speck of dust moving faster than a bullet punches through a solar wing. The wings now make 20% less power.',
      good: 'You had power to spare. Everything stays on.',
      bad: 'There is no longer enough power. The battery will run flat in the dark.',
      lesson: 'Engineers always pack a little more than they need. That extra is called margin.'
    }
  };

  /* ---------- Words kids can tap to get explained ---------- */
  var GLOSSARY = {
    orbit: ['Orbit', 'The path a satellite follows around Earth. It is falling the whole time, but moving sideways so fast that it keeps missing the ground.'],
    payload: ['Payload', 'The instruments that do the mission’s real job. Everything else on board exists to keep the payload working.'],
    pixel: ['Pixel', 'One tiny square of a picture. From space, each pixel covers a patch of ground. Smaller patches mean sharper pictures and smaller fires found.'],
    swath: ['Swath', 'The strip of ground a satellite sees as it flies along, like the stripe a paint roller leaves.'],
    infrared: ['Infrared', 'Light our eyes cannot see, given off by warm things. Fires glow brightly in infrared, even at night and through thin smoke.'],
    eclipse: ['Eclipse', 'The part of each lap spent in Earth’s shadow. No sunlight reaches the solar wings, so the battery takes over.'],
    downlink: ['Downlink', 'Sending data from the satellite down to a dish on the ground.'],
    station: ['Ground station', 'A big dish antenna on Earth that listens to satellites as they fly past.'],
    mass: ['Mass', 'How much stuff something is made of. We measure it in kilograms (kg). Every extra kilogram needs more rocket.'],
    watt: ['Watt', 'A unit of power: how fast energy is used. A bright LED bulb uses about 10 watts (W).'],
    bus: ['Bus', 'The body of a satellite: the frame and all the support systems that carry the payload.'],
    radiation: ['Radiation', 'Fast, tiny particles from the Sun and deep space. They can flip bits in computer chips and slowly damage electronics.'],
    margin: ['Margin', 'Spare capacity kept on purpose, in case something turns out heavier, hungrier or more expensive than planned.'],
    gb: ['Gigabyte', 'A unit of data. One gigabyte (GB) holds roughly 300 phone photos.'],
    frp: ['Fire power', 'How much heat a fire gives off, measured in megawatts (MW). NASA satellites measure it from orbit and call it fire radiative power. One megawatt is about the heat of 500 kitchen ovens.']
  };

  /* ---------- The design steps, in order ---------- */
  var STEPS = [
    {
      id: 'sensor', role: 'science', title: 'Choose the fire sensor',
      nav: 'Sensor',
      coach: 'Fires glow in {infrared} light. Pick a camera that feels heat.',
      why: 'The sensor decides how small a fire you can see ({pixel} size) and how wide a strip of Earth you see on each pass ({swath}). Bigger, sharper sensors need more {mass}, more power and more money.',
      groups: [
        { key: 'sensor', label: 'Fire sensor', pick: 'one', from: 'SENSORS' },
        { key: 'extras', label: 'Bonus science tools', pick: 'any', from: 'EXTRAS',
          help: 'Optional. Each adds science points, and adds mass, power, cost and data.' }
      ]
    },
    {
      id: 'orbit', role: 'nav', title: 'Choose the orbit',
      nav: 'Orbit',
      coach: 'Pick an {orbit}. The blue paint shows what your sensor sees in one day.',
      why: 'Low orbits give sharp pictures but only a moving stripe of view. A far orbit sees a third of the planet at once, but from so far away that everything is blurry. Height also changes how long the satellite sits in Earth’s shadow and how often it passes a {station}.',
      groups: [{ key: 'orbit', label: 'Orbit', pick: 'one', from: 'ORBITS' }]
    },
    {
      id: 'bus', role: 'eng', title: 'Choose the body',
      nav: 'Body',
      coach: 'Pick a body, called the {bus}, big enough for your instruments.',
      why: 'A bigger body can carry a heavier {payload}, but it is heavier and uses more power itself. Every extra kilogram has to be lifted by the rocket.',
      groups: [{ key: 'bus', label: 'Body', pick: 'one', from: 'BUSES' }]
    },
    {
      id: 'brain', role: 'comms', title: 'Choose the brain and the steering',
      nav: 'Brain',
      coach: 'Pick a computer, and steering to hold the camera steady.',
      why: 'Space {radiation} can crash ordinary computers. And a camera that wobbles takes blurry pictures, which makes its pixels act twice as big.',
      groups: [
        { key: 'computer', label: 'Computer', pick: 'one', from: 'COMPUTERS' },
        { key: 'pointing', label: 'Steering', pick: 'one', from: 'POINTING' }
      ]
    },
    {
      id: 'radio', role: 'comms', title: 'Choose the radio and ground stations',
      nav: 'Radio',
      coach: 'Pick a radio, and how many dishes on Earth listen.',
      why: 'The satellite can only {downlink} while a {station} can see it. Your radio must empty the memory faster than the instruments fill it, or pictures get deleted. Alerts also have to wait for the next station pass.',
      groups: [
        { key: 'radio', label: 'Radio', pick: 'one', from: 'RADIOS' },
        { key: 'network', label: 'Ground stations', pick: 'one', from: 'NETWORKS' }
      ]
    },
    {
      id: 'power', role: 'eng', title: 'Choose the power system',
      nav: 'Power',
      coach: 'Solar wings for sunlight, a battery for Earth’s shadow. You need enough of both.',
      why: 'In low orbits the satellite spends about a third of every lap in {eclipse}. The wings must run the satellite and refill the battery before the next shadow. Power is measured in {watt}s.',
      groups: [
        { key: 'panels', label: 'Solar wings', pick: 'one', from: 'PANELS' },
        { key: 'battery', label: 'Battery', pick: 'one', from: 'BATTERIES' }
      ]
    },
    {
      id: 'rocket', role: 'nav', title: 'Choose the rocket',
      nav: 'Rocket',
      coach: 'Pick a rocket strong enough to lift it all.',
      why: 'Higher orbits need much more speed, so the same rocket can carry far less to them. Polar orbits are a little harder than tilted ones, because the rocket gets no free push from Earth’s spin.',
      groups: [{ key: 'rocket', label: 'Rocket', pick: 'one', from: 'ROCKETS' }]
    }
  ];

  RG.DATA = {
    MISSION: MISSION, DIFFICULTY: DIFFICULTY, ROLES: ROLES, ROLE_ORDER: ROLE_ORDER,
    SENSORS: SENSORS, EXTRAS: EXTRAS, ORBITS: ORBITS, BUSES: BUSES,
    PANELS: PANELS, BATTERIES: BATTERIES, COMPUTERS: COMPUTERS, POINTING: POINTING,
    RADIOS: RADIOS, STATIONS: STATIONS, NETWORKS: NETWORKS, ROCKETS: ROCKETS,
    FIRE_ZONES: FIRE_ZONES, FIRE_SIZES: FIRE_SIZES, EVENTS: EVENTS,
    GLOSSARY: GLOSSARY, STEPS: STEPS
  };

  // An empty design. Keys match the `key` fields in STEPS.
  RG.blankDesign = function () {
    return {
      sensor: null, extras: [], orbit: null, bus: null, panels: null, battery: null,
      computer: null, pointing: null, radio: null, network: null, rocket: null
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
