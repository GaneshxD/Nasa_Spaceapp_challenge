# The guide's voice

Every line the guide says, and (once recorded) the explanation of every word in the Space words list, is an MP3 in
`assets/voice/`, made with Higgsfield's speech model and played by `js/ui/voice.js`.

- Model: Seed Audio 1.0 (`seed_audio`)
- Voice: preset "Nadine" (`voice_id` 165d9309-bb17-56ff-964a-5d6a38dab92f)
- One generation for each line. When the first clips were made a line cost 0.3 credits.

## How the game finds a recording

A guide line has no hand-written name. Its file is named from its spoken words: `RG.Voice.key(text)` gives a `g`
followed by seven letters or digits, and the clip is `assets/voice/<that>.mp3`. So a line can be used anywhere in the
game and still find its clip, and changing a line's words makes it a new line that needs a new recording.

- Words in `[[double brackets]]` are shown on screen but not spoken. Put live numbers there, so the spoken words never
  change: `'Ignition, [[' + seconds + ' seconds ]]late.'` shows "Ignition, 4.0 seconds late." and says "Ignition, late."
- A word explanation is `assets/voice/words/<key>.mp3` (id `w_<key>`). These are not stored for offline play in
  advance; each is fetched, and kept, the first time it is asked for.
- The 36 first clips of level 6 (`plan`, `touchdown`, …) keep their names in `RG.VOICE_CLIPS` and are used only where a
  line has no recording of its own.
- `RG.VOICE_FALLBACK` in `assets/voice/index.js`: when true, a line with no recording is read by the browser's own
  voice. When false it is simply not spoken (the words are always on screen).

## Adding or changing recordings

```sh
node tools/voice/lines.js            # what still has no recording, and any line that cannot have one
node tools/voice/lines.js --json     # tools/voice/lines.json: id, file, text, and `say`, the text to send to the model
```

For each missing line, generate `say` (units and abbreviations are written out there: "5,865 kilometres per hour")
with the model and voice above, then trim, level and convert it:

```sh
ffmpeg -i new.wav -af "silenceremove=start_periods=1:start_threshold=-48dB,areverse,silenceremove=start_periods=1:start_threshold=-48dB,areverse,loudnorm=I=-16:TP=-1.5:LRA=11,apad=pad_dur=0.12" -ac 1 -ar 24000 -b:a 40k assets/voice/<file>
```

Then:

```sh
node tools/voice/lines.js --index [--fallback]   # rewrite assets/voice/index.js from the files that are there
npm run pwa                                      # refresh the offline list
```

`lines.js` finds lines in three ways: fixed text inside `say()`, `tell()` and `once()` calls in `js/ui/levels/`;
source lines marked `// @voice` (text kept in tables); and the Moon sites, kit and lessons in `js/core/lunar.js`.
Listen to a new clip before keeping it: a quotation mark in the text has made the model stop early once.
