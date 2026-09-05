# AetherDepth sound glossary

AetherDepth turns the image and its movement into an optional ambient soundscape. The sound is intentionally slow and soft; it does not try to behave like a conventional song.

## Sound modes

### Aether Drone

A long, stable harmonic field built from an open fifth and octaves. It changes very slowly when the image changes and does not play a chord progression.

### Aether Pad

A more musical mode. It plays a sequence of related chords with long fades between them. The selected image colour determines the tonal centre; the selected journey determines how the chords move around it.

## Sound layers

### Low bed

The deep, surrounding layer. It is filtered and reverberated heavily, so it feels distant and spacious.

### Main pad

The central harmonic layer. This is where the selected instrument and chord progression are most noticeable.

### Shimmer

A higher, wider layer that follows the chord tones and adds brightness without introducing new notes.

### Air pad

The very high layer. It follows the same chord tones as the main pad, but stays centred instead of moving with the orbit. This gives the sound a stable point above the moving layers.

### Rhythmic layer

Optional soft accents tied to the visual orbit:

- **Still**: no rhythmic accents.
- **Orbit Pulse**: one low pulse per complete orbit.
- **Orbit Tides**: alternating low and high accents every half orbit.

## Sound character

- **Ethereal**: FM-based, spacious, and gently complex.
- **Warm**: a softer triangle-wave pad with slower movement.
- **Glass**: brighter FM tones with a more crystalline character.

## Musical journey

These names describe the feeling of the progression rather than requiring music knowledge:

- **Classic**: a familiar major-key cycle with a gentle return home.
- **Open**: wider, more spacious chord voicings.
- **Floating**: less obvious direction and more suspended movement.
- **Rise**: a longer progression that gradually creates forward motion.

## Image and movement mapping

- **Dominant colour** chooses the tonal centre and initial chord family.
- **Brightness** opens or closes the filters.
- **Orbit speed** controls how quickly the visual and rhythmic movement cycles.
- **Orbit position** controls stereo panning for the low and main layers.
- **Movement speed** changes chorus, shimmer width, and the brightness of the upper layers.
- **Air pad** remains centred and follows the current chord tones without orbit panning.

## DevTools playground

Enable the soundscape first, then open the browser DevTools console. The app exposes `window.aetherDepthAudio` as `aetherDepthAudio`.

Inspect the current state:

```js
aetherDepthAudio.state()
```

Change the main sound:

```js
aetherDepthAudio.instrument('glass')
aetherDepthAudio.progression('floating')
aetherDepthAudio.mode('pad')
aetherDepthAudio.rhythm('tides')
```

Adjust the atmosphere live:

```js
aetherDepthAudio.set({
  volume: -8,
  reverb: 0.9,
  chorus: 0.75,
  width: 1,
  filter: 2200,
  lowFilter: 320,
  shimmerFilter: 1500,
  airFilter: 2800,
  rhythmFilter: 1200
})
```

Adjust individual layer levels. These values are decibels; a less negative number is louder:

```js
aetherDepthAudio.set({
  lowLevel: -3,
  mainLevel: -5,
  shimmerLevel: -10,
  airLevel: -7,
  rhythmLevel: -8
})
```

Useful actions:

```js
aetherDepthAudio.retrigger() // regenerate the current image chord
aetherDepthAudio.release()   // release all active notes
```

## Parameter ranges

- `reverb`, `chorus`, and `width`: usually `0` to `1`.
- `filter`, `lowFilter`, `shimmerFilter`, `airFilter`, `rhythmFilter`: frequency in Hz.
- `volume` and layer levels: decibels, commonly between `-24` and `0`.
