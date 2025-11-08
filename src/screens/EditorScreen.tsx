// RN Lightweight Video Editor – EditorScreen.tsx
// ------------------------------------------------------------
// This is a single-screen, lightweight video editor for React Native CLI
// that supports: import/record video, preview with seekbar, trim with
// dual-handle slider (min 3s), draggable text overlay (font/size/color/
// alignment), and export (trim + burned-in text) using FFmpeg.
//
// ✅ Dependencies to install:
//   npm i react-native-video ffmpeg-kit-react-native react-native-image-picker @react-native-community/slider react-native-gesture-handler react-native-fs @react-native-camera-roll/camera-roll
//   npx pod-install
//
// iOS setup:
// - Add NSPhotoLibraryUsageDescription, NSCameraUsageDescription, NSMicrophoneUsageDescription
//   to Info.plist.
// - (Optional) If you plan to save to Photos app, also add NSPhotoLibraryAddUsageDescription.
// - Ensure react-native-gesture-handler is properly initialized in index.js.
//
// Android setup:
// - Add CAMERA and RECORD_AUDIO permissions if recording. Android 13+ use
//   READ_MEDIA_VIDEO; older versions READ_EXTERNAL_STORAGE / WRITE_EXTERNAL_STORAGE.
// - ffmpeg-kit-react-native requires minSdkVersion >= 24 (Android 7.0).
//
// Font for drawtext:
// - We default to system fonts: Android -> "/system/fonts/Roboto-Regular.ttf"
//   iOS -> "/System/Library/Fonts/Supplemental/Arial.ttf".
// - To use a custom font, bundle TTF and set `customFontFile` below to an
//   absolute file path (e.g. from react-native-fs after copying to Documents).
//
// Notes:
// - This file is TypeScript (tsx). Adjust imports if you use JS.
// - Keep previews smooth; export runs FFmpeg which is CPU-heavy – show progress.
//
// ------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, TextInput, Platform, StyleSheet, PanResponder, LayoutChangeEvent, ActivityIndicator, Alert } from 'react-native';
import Video, { OnLoadData } from 'react-native-video';
import Slider from '@react-native-community/slider';
import * as ImagePicker from 'react-native-image-picker';
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';
import RNFS from 'react-native-fs';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';

// -------- Types --------
interface NaturalSize { width: number; height: number; orientation?: 'portrait'|'landscape'|'square'|undefined }

// -------- Helpers --------
const pad = (n:number)=> (n<10 ? `0${n}` : `${n}`);
const fmt = (sec:number)=>{ const s = Math.max(0, Math.floor(sec)); const h = Math.floor(s/3600); const m = Math.floor((s%3600)/60); const secOnly = s%60; return h>0 ? `${h}:${pad(m)}:${pad(secOnly)}` : `${m}:${pad(secOnly)}` };

const clamp = (v:number, min:number, max:number)=> Math.min(max, Math.max(min, v));

const DEFAULT_MIN_LEN = 3; // seconds

const getSystemFontPath = ()=> Platform.select({
  android: '/system/fonts/Roboto-Regular.ttf',
  ios: '/System/Library/Fonts/Supplemental/Arial.ttf',
  default: ''
});

// Escape text for FFmpeg drawtext
const escapeDrawtext = (t:string)=> t
  .replace(/\\/g, '\\\\') // backslashes first
  .replace(/:/g, '\\:')
  .replace(/'/g, "\\'")
  .replace(/\n/g, '\\n');

// -------- Component --------
const EditorScreen: React.FC = () => {
  const [uri, setUri] = useState<string | null>(null);
  const [videoNatural, setVideoNatural] = useState<NaturalSize | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [paused, setPaused] = useState(false);
  const [position, setPosition] = useState(0);

  // Trim range (seconds)
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  // Overlay text state
  const [label, setLabel] = useState('Your text');
  const [fontSize, setFontSize] = useState(24);
  const [fontColor, setFontColor] = useState('#FFFFFF');
  const [fontAlign, setFontAlign] = useState<'left'|'center'|'right'>('center');

  // Draggable position in PREVIEW coords
  const [overlayX, setOverlayX] = useState(0); // top-left x
  const [overlayY, setOverlayY] = useState(0); // top-left y
  const [overlayW, setOverlayW] = useState(200); // visual width of text box in preview
  const [overlayH, setOverlayH] = useState(60);
  const previewLayout = useRef({x:0,y:0,w:0,h:0});

  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string>('');

  // Optional: override with your bundled font path
  const customFontFile = '';

  const fontFile = useMemo(()=> customFontFile || getSystemFontPath() || '', [customFontFile]);

  const onLoad = (meta: OnLoadData)=>{
    setVideoDuration(meta.duration);
    setTrimEnd(Math.max(DEFAULT_MIN_LEN, Math.floor(meta.duration)));
    const ns: NaturalSize = {
      width: meta.naturalSize.width || 0,
      height: meta.naturalSize.height || 0,
      orientation: (meta.naturalSize.orientation as any) || undefined,
    };
    setVideoNatural(ns);
  };

  const onProgress = (p:{currentTime:number})=> setPosition(p.currentTime);

  const seekRef = useRef<any>(null);
  const seekTo = (sec:number)=>{
    seekRef.current?.seek(sec);
    setPosition(sec);
  };

  const pickFromLibrary = async ()=>{
    const res = await ImagePicker.launchImageLibrary({ mediaType:'video', selectionLimit:1, quality:1 });
    if (res.didCancel) return;
    const asset = res.assets?.[0];
    if (asset?.uri) {
      setUri(asset.uri);
      setPaused(false);
      setPosition(0);
    }
  };

  const recordVideo = async ()=>{
    const res = await ImagePicker.launchCamera({ mediaType:'video', videoQuality:'high', durationLimit:180 });
    if (res.didCancel) return;
    const asset = res.assets?.[0];
    if (asset?.uri) {
      setUri(asset.uri);
      setPaused(false);
      setPosition(0);
    }
  };

  // Enforce 3s min and bounds when adjusting trim
  const setStartSafe = (v:number)=>{
    const maxStart = Math.max(0, (trimEnd - DEFAULT_MIN_LEN));
    setTrimStart(clamp(Math.floor(v), 0, maxStart));
  };
  const setEndSafe = (v:number)=>{
    const minEnd = Math.min(videoDuration, (trimStart + DEFAULT_MIN_LEN));
    setTrimEnd(clamp(Math.floor(v), minEnd, Math.floor(videoDuration)));
  };

  // Dual-handle slider using two Sliders (simple + dependency-free)
  const handlePreviewLayout = (e:LayoutChangeEvent)=>{
    const {x,y,width,height} = e.nativeEvent.layout;
    previewLayout.current = {x, y, w: width, h: height};
    // Initialize overlay to center
    setOverlayX(width/2 - overlayW/2);
    setOverlayY(height/2 - overlayH/2);
  };

  // Drag logic
  const pan = useRef({dx:0, dy:0});
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: ()=> true,
      onPanResponderGrant: ()=>{ pan.current = {dx:0, dy:0}; },
      onPanResponderMove: (_,g)=>{
        const nx = clamp(overlayX + g.dx - pan.current.dx, 0, Math.max(0, previewLayout.current.w - overlayW));
        const ny = clamp(overlayY + g.dy - pan.current.dy, 0, Math.max(0, previewLayout.current.h - overlayH));
        setOverlayX(nx); setOverlayY(ny);
      },
      onPanResponderRelease: ()=>{}
    })
  ).current;

  // Simple resize handle at bottom-right corner
  const resizeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: ()=> true,
      onPanResponderMove: (_, g)=>{
        const newW = clamp(overlayW + g.dx, 80, previewLayout.current.w - overlayX);
        const newH = clamp(overlayH + g.dy, 30, previewLayout.current.h - overlayY);
        setOverlayW(newW); setOverlayH(newH);
      },
      onPanResponderRelease: ()=>{}
    })
  ).current;

  // Compute text draw position for FFmpeg in VIDEO pixel coords
  const computeFFmpegXY = useCallback(() => {
    if (!videoNatural || previewLayout.current.w === 0 || previewLayout.current.h === 0) return {x: 20, y: 20};
    // Handle orientation: use rendered video rect that fits inside preview
    const vw = videoNatural.width || 0;
    const vh = videoNatural.height || 0;
    if (vw === 0 || vh === 0) return {x: 20, y: 20};

    // Fit video into preview while preserving aspect ratio (contain)
    const previewW = previewLayout.current.w;
    const previewH = previewLayout.current.h;
    const videoAR = vw / vh;
    const previewAR = previewW / previewH;
    let renderW = 0, renderH = 0, offsetX = 0, offsetY = 0;
    if (videoAR > previewAR) {
      // video is wider
      renderW = previewW;
      renderH = previewW / videoAR;
      offsetY = (previewH - renderH) / 2;
    } else {
      renderH = previewH;
      renderW = previewH * videoAR;
      offsetX = (previewW - renderW) / 2;
    }

    // Normalize overlay center point to rendered video rect
    const centerX = overlayX + overlayW/2;
    const centerY = overlayY + overlayH/2;
    const normX = clamp((centerX - offsetX) / renderW, 0, 1);
    const normY = clamp((centerY - offsetY) / renderH, 0, 1);

    // Map to video pixels
    const x = Math.floor(normX * vw);
    const y = Math.floor(normY * vh);
    return { x, y };
  }, [overlayX, overlayY, overlayW, overlayH, videoNatural]);

  const exportVideo = async ()=>{
    if (!uri) return;
    if (!fontFile) {
      Alert.alert('Font missing', 'No font file path available for drawtext. Set a valid font path.');
      return;
    }

    // Ensure min 3s duration
    const start = Math.max(0, Math.min(trimStart, Math.max(0, videoDuration - DEFAULT_MIN_LEN)));
    const end = Math.max(start + DEFAULT_MIN_LEN, Math.min(trimEnd, videoDuration));
    const duration = Math.max(DEFAULT_MIN_LEN, Math.floor(end - start));

    // Build output path
    const outDir = RNFS.CachesDirectoryPath || RNFS.TemporaryDirectoryPath || RNFS.DocumentDirectoryPath;
    const outPath = `${outDir}/edited_${Date.now()}.mp4`;

    // Overlay XY in video pixels; alignment handled via drawtext anchor
    const { x, y } = computeFFmpegXY();

    // Map RN color like #RRGGBB to ffmpeg format: white, or 0xRRGGBB
    const ffColor = fontColor.startsWith('#') ? `0x${fontColor.substring(1)}` : fontColor;

    // Drawtext position by alignment: place the text box center at (x,y)
    // FFmpeg drawtext anchors at top-left by default; we shift by text_w/2 text_h/2 for center
    const alignExpr = fontAlign === 'center' ? "x:(x- text_w/2):y:(y- text_h/2)" :
                      fontAlign === 'left' ?  "x:(x):y:(y- text_h/2)" :
                      /* right */             "x:(x- text_w):y:(y- text_h/2)";

    const textEscaped = escapeDrawtext(label);

    // Build FFmpeg filter
    // Note: We calculate x,y via -vf expr with variables; pass via drawtext 'x=y=' expressions requiring evaluation
    // Use -ss before -i for faster trim start, re-encode because of drawtext

    const filter = `drawtext=fontfile='${fontFile}':text='${textEscaped}':fontsize=${Math.floor(fontSize)}:fontcolor=${ffColor}:${alignExpr}`
      .replace('x:', `x=${x};`) // inject our numeric variables
      .replace('y:', `y=${y};`);

    const cmd = `-ss ${start} -i "${uri}" -t ${duration} -vf "${filter}" -c:v libx264 -preset veryfast -crf 20 -c:a aac -movflags +faststart "${outPath}"`;

    try {
      setExporting(true); setExportProgress('Starting...');
      // Use execute() which returns a Promise<FFmpegSession>.
      // executeAsync's first callback is the completion callback, so passing a log
      // callback there would make `session` be null. Using execute() avoids that pitfall.
      const session = await FFmpegKit.execute(cmd);

      const rc = await session.getReturnCode();
      if (ReturnCode.isSuccess(rc)) {
        setExportProgress('Done');
        // Optionally save to Photos / Gallery
        try { await CameraRoll.save(outPath, { type:'video' }); } catch {}
        Alert.alert('Export complete', outPath);
      } else {
        const failStack = await session.getFailStackTrace();
        throw new Error(failStack || 'Export failed');
      }
    } catch (e:any) {
      Alert.alert('Export error', e?.message || String(e));
    } finally {
      setExporting(false); setExportProgress('');
    }
  };

  // UI
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.btn} onPress={pickFromLibrary}><Text style={styles.btnText}>Import</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={recordVideo}><Text style={styles.btnText}>Record</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btn, !uri && {opacity:0.4}]} disabled={!uri} onPress={exportVideo}>
          {exporting ? <ActivityIndicator/> : <Text style={styles.btnText}>Export</Text>}
        </TouchableOpacity>
      </View>

      {uri ? (
        <>
          <View style={styles.preview} onLayout={handlePreviewLayout}>
            <Video
              ref={(r) => { seekRef.current = r; }}
              source={{ uri }}
              paused={paused}
              style={StyleSheet.absoluteFill}
              resizeMode="contain"
              onLoad={onLoad}
              onProgress={onProgress}
            />

            {/* Draggable overlay container */}
            <View style={[styles.overlayBox, { left: overlayX, top: overlayY, width: overlayW, height: overlayH }]} {...panResponder.panHandlers}>
              <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: fontAlign === 'left' ? 'flex-start' : fontAlign === 'right' ? 'flex-end' : 'center', paddingHorizontal: 8 }]}>
                <Text style={{ color: fontColor, fontSize, fontWeight: '600' }} numberOfLines={2} adjustsFontSizeToFit>
                  {label}
                </Text>
              </View>
              <View style={styles.resizeHandle} {...resizeResponder.panHandlers} />
            </View>
          </View>

          {/* Play controls */}
          <View style={styles.controls}>
            <TouchableOpacity style={styles.playBtn} onPress={()=> setPaused(p=>!p)}>
              <Text style={styles.playText}>{paused ? 'Play' : 'Pause'}</Text>
            </TouchableOpacity>
            <View style={{ flex:1 }}>
              <Slider
                value={position}
                minimumValue={0}
                maximumValue={videoDuration || 0}
                onSlidingComplete={seekTo}
              />
              <View style={styles.timeRow}>
                <Text style={styles.timeText}>{fmt(position)}</Text>
                <Text style={styles.timeText}>{fmt(videoDuration)}</Text>
              </View>
            </View>
          </View>

          {/* Trim controls (dual sliders) */}
          <View style={styles.trimBlock}>
            <Text style={styles.sectionTitle}>Trim</Text>
            <View style={{ paddingHorizontal: 12 }}>
              <Text style={styles.timeText}>Start: {fmt(trimStart)}  End: {fmt(trimEnd)}  (≥ {DEFAULT_MIN_LEN}s)</Text>
              <Slider
                value={trimStart}
                minimumValue={0}
                maximumValue={videoDuration}
                onValueChange={setStartSafe}
              />
              <Slider
                value={trimEnd}
                minimumValue={0}
                maximumValue={videoDuration}
                onValueChange={setEndSafe}
              />
            </View>
          </View>

          {/* Text controls */}
          <View style={styles.textControls}>
            <Text style={styles.sectionTitle}>Text</Text>
            <View style={styles.row}>
              <TextInput
                style={styles.input}
                placeholder="Type text"
                value={label}
                onChangeText={setLabel}
              />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Size</Text>
              <Slider style={{ flex:1 }} value={fontSize} minimumValue={12} maximumValue={72} step={1} onValueChange={setFontSize} />
              <Text style={styles.value}>{fontSize}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Color</Text>
              <TextInput style={[styles.input, {flex:0.8}]} value={fontColor} onChangeText={setFontColor} placeholder="#FFFFFF" />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Align</Text>
              {(['left','center','right'] as const).map(a=> (
                <TouchableOpacity key={a} style={[styles.chip, fontAlign===a && styles.chipActive]} onPress={()=> setFontAlign(a)}>
                  <Text style={[styles.chipText, fontAlign===a && styles.chipTextActive]}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {exporting && (
              <View style={{flexDirection:'row', alignItems:'center', gap:8, marginTop:8}}>
                <ActivityIndicator/>
                <Text style={{color:'#888'}}>Exporting... {exportProgress}</Text>
              </View>
            )}
          </View>
        </>
      ) : (
        <View style={styles.placeholder}> 
          <Text style={{color:'#888'}}>Import or record a video to start</Text>
        </View>
      )}

    </SafeAreaView>
  );
};

export default EditorScreen;

// -------- Styles --------
const styles = StyleSheet.create({
  root: { flex:1, backgroundColor:'#0B0B0C' },
  topBar: { flexDirection:'row', gap:8, padding:12, justifyContent:'space-between' },
  btn: { backgroundColor:'#1F6FEB', paddingHorizontal:14, paddingVertical:10, borderRadius:10 },
  btnText: { color:'#fff', fontWeight:'600' },
  preview: { flex: 1, backgroundColor:'#000', justifyContent:'center', alignItems:'center' },
  controls: { flexDirection:'row', alignItems:'center', paddingHorizontal:12, paddingVertical:6, gap:12 },
  playBtn: { backgroundColor:'#26262B', paddingHorizontal:16, paddingVertical:8, borderRadius:10 },
  playText: { color:'#fff' },
  timeRow: { flexDirection:'row', justifyContent:'space-between' },
  timeText: { color:'#B0B0B5', fontVariant:['tabular-nums'] },
  trimBlock: { paddingVertical:8 },
  sectionTitle: { color:'#fff', fontSize:16, fontWeight:'700', marginBottom:8, paddingHorizontal:12 },
  textControls: { paddingVertical:8, paddingBottom:16 },
  row: { flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:12, marginBottom:8 },
  label: { color:'#B0B0B5', width:60 },
  input: { flex:1, backgroundColor:'#1C1C22', borderRadius:10, paddingHorizontal:12, paddingVertical:10, color:'#fff' },
  value: { color:'#fff', width:40, textAlign:'right' },
  chip: { backgroundColor:'#1C1C22', borderRadius:20, paddingHorizontal:12, paddingVertical:6, marginRight:8 },
  chipActive: { backgroundColor:'#3B82F6' },
  chipText: { color:'#B0B0B5' },
  chipTextActive: { color:'#fff', fontWeight:'700' },
  placeholder: { flex:1, alignItems:'center', justifyContent:'center' },
  overlayBox: { position:'absolute', borderWidth:1, borderColor:'rgba(255,255,255,0.25)', borderRadius:8 },
  resizeHandle: { position:'absolute', width:18, height:18, right:-9, bottom:-9, backgroundColor:'#3B82F6', borderRadius:9, borderWidth:2, borderColor:'#fff' },
});
