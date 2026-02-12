# eb-mdt-ts-sqlite — Task Notes

## Task 1: nativeAudio Integration

### What Was Done
- Converted `notification.wav` and `panic_sound.wav` to mono 32kHz PCM (required by GTA V audio engine)
- Created AWC XML template: `audiodirectory/mdt_sounds.awc.xml`
- Created dat54 XML template: `audiodata/mdt_sounds.dat54.rel.xml`
- Placed converted WAVs in `audiodirectory/mdt_sounds/`
- Updated `src/client/dispatch.ts` with native 3D positional audio via `PlaySoundFromCoord` + NUI fallback
- Updated `scripts/build.js` to include `audiodirectory/*.awc` and `audiodata/*.rel` in files, and append `data_file` entries
- Audio bank is loaded at startup via `RequestScriptAudioBank('audiodirectory/mdt_sounds', false)`
- Audio bank is released on resource stop via `ReleaseScriptAudioBank()`
- SoundSet name: `mdt_soundset` — script names: `notification`, `panic_sound`

### Manual Step Required: Compile Audio Binaries with CodeWalker

The XML templates must be compiled into binary files using **CodeWalker** (Windows desktop app). This cannot be automated.

#### Steps:
1. Download CodeWalker from https://github.com/dexyfex/CodeWalker
2. Open CodeWalker's **RPF Explorer**
3. **Compile AWC:**
   - Right-click in any folder > Import XML > select `audiodirectory/mdt_sounds.awc.xml`
   - CodeWalker will read the WAV files referenced in the XML and produce `mdt_sounds.awc`
   - Place the compiled `mdt_sounds.awc` in `audiodirectory/` (same folder as the XML)
4. **Compile dat54.rel:**
   - Right-click > Import XML > select `audiodata/mdt_sounds.dat54.rel.xml`
   - CodeWalker will produce `mdt_sounds.dat54.rel`
   - Place the compiled `mdt_sounds.dat54.rel` in `audiodata/` (same folder as the XML)

#### File Structure After Compilation:
```
eb-mdt-ts-sqlite/
  audiodirectory/
    mdt_sounds.awc              <-- compiled binary (YOU MUST CREATE THIS)
    mdt_sounds.awc.xml          <-- XML template (source)
    mdt_sounds/
      notification.wav          <-- mono 32kHz PCM source
      panic_sound.wav           <-- mono 32kHz PCM source
  audiodata/
    mdt_sounds.dat54.rel        <-- compiled binary (YOU MUST CREATE THIS)
    mdt_sounds.dat54.rel.xml    <-- XML template (source)
```

### Fallback Behavior
Until the binary files are compiled and placed correctly:
- `RequestScriptAudioBank` will return false at startup
- `nativeAudioLoaded` stays false
- All sounds fall back to NUI (HTML5 Audio) — same behavior as before
- No errors will occur; everything degrades gracefully

### Once Compiled
- Native 3D positional audio will automatically activate
- Panic sounds play at the panicking officer's coordinates via `PlaySoundFromCoord`
- Ping notification sounds play at the pinging officer's coordinates
- Console will show: `[MDT Dispatch] Native audio bank loaded (mdt_soundset)`
