

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  View, 
  Text, 
  SafeAreaView, 
  TouchableOpacity, 
  TextInput, 
  Platform, 
  StyleSheet, 
  PanResponder, 
  LayoutChangeEvent, 
  ActivityIndicator, 
  Alert, 
  PermissionsAndroid,
  Dimensions,
  ScrollView,
} from 'react-native';
import Video, { OnLoadData, VideoRef } from 'react-native-video';
import Slider from '@react-native-community/slider';
import * as ImagePicker from 'react-native-image-picker';
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';
import RNFS from 'react-native-fs';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';

// -------- Types --------
interface NaturalSize { width: number; height: number; orientation?: 'portrait' | 'landscape' | 'square' | undefined }

// -------- Constants --------
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const fmt = (sec: number) => { 
  const s = Math.max(0, Math.floor(sec)); 
  const h = Math.floor(s / 3600); 
  const m = Math.floor((s % 3600) / 60); 
  const secOnly = s % 60; 
  return h > 0 ? `${h}:${pad(m)}:${pad(secOnly)}` : `${m}:${pad(secOnly)}` 
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const DEFAULT_MIN_LEN = 3; // seconds

// Color palette - Modern & Colorful
const COLORS = {
  primary: '#6366F1', // Indigo
  primaryDark: '#4F46E5',
  secondary: '#EC4899', // Pink
  accent: '#10B981', // Green
  warning: '#F59E0B', // Amber
  danger: '#EF4444', // Red
  success: '#22C55E', // Green
  background: '#0F172A', // Slate 900
  surface: '#1E293B', // Slate 800
  surfaceLight: '#334155', // Slate 700
  text: '#F8FAFC', // Slate 50
  textSecondary: '#CBD5E1', // Slate 300
  border: '#475569', // Slate 600
  overlay: 'rgba(15, 23, 42, 0.85)',
};

// Font families
const FONTS = {
  regular: 'Roboto-Regular',
  medium: 'Roboto-Medium',
  mediumItalic: 'Roboto-MediumItalic',
  bold: 'Roboto-Bold',
};

const getSystemFontPath = () => Platform.select({
  android: '/system/fonts/Roboto-Regular.ttf',
  ios: '/System/Library/Fonts/Supplemental/Arial.ttf',
  default: ''
});

// Escape text for FFmpeg drawtext
const escapeDrawtext = (t: string) => t
  .replace(/\\/g, '\\\\')
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
  const [fontAlign, setFontAlign] = useState<'left' | 'center' | 'right'>('center');

  // Draggable position in PREVIEW coords
  const [overlayX, setOverlayX] = useState(0);
  const [overlayY, setOverlayY] = useState(0);
  const [overlayW, setOverlayW] = useState(200);
  const [overlayH, setOverlayH] = useState(60);
  const previewLayout = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string>('');
  const [exportedFilePath, setExportedFilePath] = useState<string | null>(null); // Add state for exported file path

  // ✅ Custom font support
  const [customFontFile, setCustomFontFile] = useState<string>('');
  useEffect(() => {
    const prepareFont = async () => {
      try {
        const fontName = 'Roboto-Regular.ttf';
        const dest = `${RNFS.DocumentDirectoryPath}/${fontName}`;

        const exists = await RNFS.exists(dest);
        if (!exists) {
          if (Platform.OS === 'android') {
            await RNFS.copyFileAssets(`fonts/${fontName}`, dest);
          } else {
            await RNFS.copyFile(`${RNFS.MainBundlePath}/${fontName}`, dest);
          }
        }
        setCustomFontFile(dest);
        console.log('✅ Custom font ready at:', dest);
      } catch (err) {
        console.error('❌ Font preparation failed:', err);
      }
    };
    prepareFont();
  }, []);

  const fontFile = useMemo(() => customFontFile || getSystemFontPath() || '', [customFontFile]);

  const onLoad = (meta: OnLoadData) => {
    setVideoDuration(meta.duration);
    setTrimEnd(Math.max(DEFAULT_MIN_LEN, Math.floor(meta.duration)));
    const ns: NaturalSize = {
      width: meta.naturalSize.width || 0,
      height: meta.naturalSize.height || 0,
      orientation: (meta.naturalSize.orientation as any) || undefined,
    };
    setVideoNatural(ns);
  };

  const onProgress = (p: { currentTime: number }) => setPosition(p.currentTime);

  const seekRef = useRef<VideoRef>(null);
  const seekTo = (sec: number) => {
    seekRef.current?.seek(sec);
    setPosition(sec);
  };

  const pickFromLibrary = async () => {
    const res = await ImagePicker.launchImageLibrary({ mediaType: 'video', selectionLimit: 1, quality: 1 });
    if (res.didCancel) return;
    const asset = res.assets?.[0];
    if (asset?.uri) {
      setUri(asset.uri);
      setPaused(false);
      setPosition(0);
    }
  };

  const recordVideo = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: "Camera Permission",
            message: "App needs camera permission to record videos",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK"
          }
        );

        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission Denied', 'Camera permission is required to record videos', [{ text: 'OK' }]);
          return;
        }
      }

      const res = await ImagePicker.launchCamera({
        mediaType: 'video',
        videoQuality: 'high',
        durationLimit: 180,
        saveToPhotos: false,
        includeBase64: false,
      });

      if (res.didCancel) {
        console.log('User cancelled recording');
        return;
      }

      if (res.errorCode) {
        console.error('Camera error:', res.errorMessage);
        Alert.alert('Camera Error', `Unable to access camera: ${res.errorMessage}`);
        return;
      }

      const asset = res.assets?.[0];
      if (asset?.uri) {
        console.log('Video recorded:', asset.uri);
        setUri(asset.uri);
        setPaused(false);
        setPosition(0);
      } else {
        console.error('No video uri received');
        Alert.alert('Error', 'Failed to get video from camera');
      }
    } catch (error) {
      console.error('Record video error:', error);
      Alert.alert('Error', 'Failed to record video. Please check camera permissions.');
    }
  };

  const setStartSafe = (v: number) => {
    const maxStart = Math.max(0, (trimEnd - DEFAULT_MIN_LEN));
    setTrimStart(clamp(Math.floor(v), 0, maxStart));
  };
  const setEndSafe = (v: number) => {
    const minEnd = Math.min(videoDuration, (trimStart + DEFAULT_MIN_LEN));
    setTrimEnd(clamp(Math.floor(v), minEnd, Math.floor(videoDuration)));
  };

  const handlePreviewLayout = (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    previewLayout.current = { x, y, w: width, h: height };
    setOverlayX(width / 2 - overlayW / 2);
    setOverlayY(height / 2 - overlayH / 2);
  };

  const pan = useRef({ dx: 0, dy: 0 });
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { pan.current = { dx: 0, dy: 0 }; },
      onPanResponderMove: (_, g) => {
        const nx = clamp(overlayX + g.dx - pan.current.dx, 0, Math.max(0, previewLayout.current.w - overlayW));
        const ny = clamp(overlayY + g.dy - pan.current.dy, 0, Math.max(0, previewLayout.current.h - overlayH));
        setOverlayX(nx); setOverlayY(ny);
      },
      onPanResponderRelease: () => { }
    })
  ).current;

  const resizeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        const newW = clamp(overlayW + g.dx, 80, previewLayout.current.w - overlayX);
        const newH = clamp(overlayH + g.dy, 30, previewLayout.current.h - overlayY);
        setOverlayW(newW); setOverlayH(newH);
      },
      onPanResponderRelease: () => { }
    })
  ).current;

  const computeFFmpegXY = useCallback(() => {
    if (!videoNatural || previewLayout.current.w === 0 || previewLayout.current.h === 0) return { x: 20, y: 20 };
    const vw = videoNatural.width || 0;
    const vh = videoNatural.height || 0;
    if (vw === 0 || vh === 0) return { x: 20, y: 20 };

    const previewW = previewLayout.current.w;
    const previewH = previewLayout.current.h;
    const videoAR = vw / vh;
    const previewAR = previewW / previewH;
    let renderW = 0, renderH = 0, offsetX = 0, offsetY = 0;
    if (videoAR > previewAR) {
      renderW = previewW;
      renderH = previewW / videoAR;
      offsetY = (previewH - renderH) / 2;
    } else {
      renderH = previewH;
      renderW = previewH * videoAR;
      offsetX = (previewW - renderW) / 2;
    }

    const centerX = overlayX + overlayW / 2;
    const centerY = overlayY + overlayH / 2;
    const normX = clamp((centerX - offsetX) / renderW, 0, 1);
    const normY = clamp((centerY - offsetY) / renderH, 0, 1);

    const x = Math.floor(normX * vw);
    const y = Math.floor(normY * vh);
    return { x, y };
  }, [overlayX, overlayY, overlayW, overlayH, videoNatural]);

  // Reset all states to initial values
  const resetState = () => {
    setUri(null);
    setVideoNatural(null);
    setVideoDuration(0);
    setPaused(false);
    setPosition(0);
    setTrimStart(0);
    setTrimEnd(0);
    setLabel('Your text');
    setFontSize(24);
    setFontColor('#FFFFFF');
    setFontAlign('center');
    setOverlayX(previewLayout.current.w / 2 - 100); // Half of initial width
    setOverlayY(previewLayout.current.h / 2 - 30); // Half of initial height
    setOverlayW(200);
    setOverlayH(60);
    setExportedFilePath(null);
    setExportProgress('');
  };

  const exportVideo = async () => {
    if (!uri) return;

    try {
      if (!fontFile) {
        Alert.alert('Font missing', 'Font file not found');
        return;
      }

      const inputPath = uri.replace('file://', '');
      const outputPath = `${RNFS.CachesDirectoryPath}/edited_${Date.now()}.mp4`;

      const { x, y } = computeFFmpegXY();
      const ffColor = fontColor.startsWith('#') ? `0x${fontColor.slice(1)}` : fontColor;
      const textEscaped = escapeDrawtext(label);

      const filter = `drawtext=fontfile='${fontFile}':text='${textEscaped}':fontsize=${fontSize}:fontcolor=${ffColor}:x=${x}:y=${y}`;

      const cmd = `-y -ss ${trimStart} -i "${inputPath}" -t ${trimEnd - trimStart} -vf "${filter}" -c:v mpeg4 -c:a aac -movflags +faststart "${outputPath}"`;

      console.log('Running FFmpeg command:', cmd);

      setExporting(true);
      setExportedFilePath(null);
      const session = await FFmpegKit.execute(cmd);
      const rc = await session.getReturnCode();

      if (ReturnCode.isSuccess(rc)) {
        console.log('✅ Export complete at:', outputPath);
        
        // Save to camera roll
        try {
          await CameraRoll.save(`file://${outputPath}`, { type: 'video' });
          
          // Show success alert with file path only
          Alert.alert(
            '✅ Export Successful!',
            `File saved to:\n${outputPath}\n\nVideo also saved to your camera Files/Videos.`,
            [
              { 
                text: 'OK',
                onPress: () => {
                  // Reset the state after user acknowledges the success
                  resetState();
                }
              }
            ]
          );
        } catch (saveError) {
          console.warn('Failed to save to camera roll:', saveError);
          Alert.alert(
            '✅ Export Partially Successful',
            `File saved to:\n${outputPath}\n\nFailed to save to camera roll.`,
            [
              { 
                text: 'OK',
                onPress: () => {
                  // Reset the state even if camera roll save fails
                  resetState();
                }
              }
            ]
          );
        }
      } else {
        const fail = await session.getFailStackTrace();
        console.error('FFmpeg failed:', fail);
        Alert.alert('Export failed', fail || 'Unknown FFmpeg error');
      }
    } catch (err) {
      console.error('Export error:', err);
      Alert.alert('Error', String(err));
    } finally {
      setExporting(false);
    }
  };



  // Function to format file path for display (shorten if too long)
  const formatFilePath = (path: string) => {
    if (path.length > 60) {
      const parts = path.split('/');
      if (parts.length > 2) {
        return `.../${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
      }
      return `...${path.slice(-50)}`;
    }
    return path;
  };

  // Preset colors for quick selection
  const presetColors = ['#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#FF1493', '#32CD32'];

  return (
    <SafeAreaView style={styles.root}>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Video Editor</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={[styles.headerBtn, styles.importBtn]} 
            onPress={pickFromLibrary}
            activeOpacity={0.7}
          >
            <Text style={styles.headerBtnText}>📁 Import</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.headerBtn, styles.recordBtn]} 
            onPress={recordVideo}
            activeOpacity={0.7}
          >
            <Text style={styles.headerBtnText}>🎥 Record</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.headerBtn, styles.exportBtn, !uri && styles.disabledBtn]} 
            disabled={!uri || exporting}
            onPress={exportVideo}
            activeOpacity={0.7}
          >
            {exporting ? (
              <ActivityIndicator color={COLORS.text} size="small" />
            ) : (
              <Text style={styles.headerBtnText}>💾 Export</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {uri ? (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
     
          <View style={styles.previewContainer}>
            <View style={styles.preview} onLayout={handlePreviewLayout}>
              <Video
                ref={r => { seekRef.current = r }}
                source={{ uri }}
                paused={paused}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
                onLoad={onLoad}
                onProgress={onProgress}
              />

          
              <View 
                style={[styles.overlayBox, { left: overlayX, top: overlayY, width: overlayW, height: overlayH }]} 
                {...panResponder.panHandlers}
              >
                <View style={[StyleSheet.absoluteFill, { 
                  justifyContent: 'center', 
                  alignItems: fontAlign === 'left' ? 'flex-start' : fontAlign === 'right' ? 'flex-end' : 'center', 
                  paddingHorizontal: 8 
                }]}>
                  <Text style={{ 
                    color: fontColor, 
                    fontSize, 
                    fontFamily: FONTS.bold 
                  }} numberOfLines={2} adjustsFontSizeToFit>
                    {label}
                  </Text>
                </View>
                <View style={styles.resizeHandle} {...resizeResponder.panHandlers} />
              </View>
            </View>
          </View>


          <View style={styles.controlCard}>
            <Text style={styles.cardTitle}>🎬 Playback</Text>
            <View style={styles.playbackControls}>
              <TouchableOpacity 
                style={[styles.playBtn, paused ? styles.playBtnActive : styles.playBtnPaused]} 
                onPress={() => setPaused(p => !p)}
                activeOpacity={0.8}
              >
                <Text style={styles.playBtnText}>{paused ? '▶️ Play' : '⏸ Pause'}</Text>
              </TouchableOpacity>
              <View style={styles.sliderContainer}>
                <Slider
                  value={position}
                  minimumValue={0}
                  maximumValue={videoDuration || 1}
                  onSlidingComplete={seekTo}
                  minimumTrackTintColor={COLORS.primary}
                  maximumTrackTintColor={COLORS.surfaceLight}
                  thumbTintColor={COLORS.primary}
                  style={styles.slider}
                />
                <View style={styles.timeRow}>
                  <Text style={styles.timeText}>{fmt(position)}</Text>
                  <Text style={styles.timeText}>{fmt(videoDuration)}</Text>
                </View>
              </View>
            </View>
          </View>


          <View style={styles.controlCard}>
            <Text style={styles.cardTitle}>✂️ Trim Video</Text>
            <View style={styles.trimInfo}>
              <View style={styles.trimInfoItem}>
                <Text style={styles.trimLabel}>Start</Text>
                <Text style={styles.trimValue}>{fmt(trimStart)}</Text>
              </View>
              <View style={styles.trimInfoItem}>
                <Text style={styles.trimLabel}>End</Text>
                <Text style={styles.trimValue}>{fmt(trimEnd)}</Text>
              </View>
              <View style={styles.trimInfoItem}>
                <Text style={styles.trimLabel}>Duration</Text>
                <Text style={styles.trimValue}>{fmt(trimEnd - trimStart)}</Text>
              </View>
            </View>
            <View style={styles.trimSliders}>
              <View style={styles.trimSliderGroup}>
                <Text style={styles.trimSliderLabel}>Start Time</Text>
                <Slider
                  value={trimStart}
                  minimumValue={0}
                  maximumValue={videoDuration || 1}
                  onValueChange={setStartSafe}
                  minimumTrackTintColor={COLORS.accent}
                  maximumTrackTintColor={COLORS.surfaceLight}
                  thumbTintColor={COLORS.accent}
                />
              </View>
              <View style={styles.trimSliderGroup}>
                <Text style={styles.trimSliderLabel}>End Time</Text>
                <Slider
                  value={trimEnd}
                  minimumValue={0}
                  maximumValue={videoDuration || 1}
                  onValueChange={setEndSafe}
                  minimumTrackTintColor={COLORS.warning}
                  maximumTrackTintColor={COLORS.surfaceLight}
                  thumbTintColor={COLORS.warning}
                />
              </View>
            </View>
            <Text style={styles.hintText}>Minimum duration: {DEFAULT_MIN_LEN}s</Text>
          </View>

  
          <View style={styles.controlCard}>
            <Text style={styles.cardTitle}>✍️ Text Overlay</Text>
            
   
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Text Content</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter your text here..."
                placeholderTextColor={COLORS.textSecondary}
                value={label}
                onChangeText={setLabel}
              />
            </View>

    
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Font Size</Text>
                <Text style={styles.valueText}>{fontSize}px</Text>
              </View>
              <Slider
                value={fontSize}
                minimumValue={12}
                maximumValue={72}
                step={1}
                onValueChange={setFontSize}
                minimumTrackTintColor={COLORS.secondary}
                maximumTrackTintColor={COLORS.surfaceLight}
                thumbTintColor={COLORS.secondary}
              />
            </View>

     
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Text Color</Text>
              <View style={styles.colorPicker}>
                {presetColors.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: color },
                      fontColor === color && styles.colorSwatchActive
                    ]}
                    onPress={() => setFontColor(color)}
                  />
                ))}
              </View>
              <View style={styles.colorInputRow}>
                <TextInput
                  style={[styles.textInput, styles.colorInput]}
                  placeholder="#FFFFFF"
                  placeholderTextColor={COLORS.textSecondary}
                  value={fontColor}
                  onChangeText={setFontColor}
                />
                <View style={[styles.colorPreview, { backgroundColor: fontColor }]} />
              </View>
            </View>

     
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Alignment</Text>
              <View style={styles.alignmentButtons}>
                {(['left', 'center', 'right'] as const).map(a => (
                  <TouchableOpacity
                    key={a}
                    style={[styles.alignBtn, fontAlign === a && styles.alignBtnActive]}
                    onPress={() => setFontAlign(a)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.alignBtnText, fontAlign === a && styles.alignBtnTextActive]}>
                      {a === 'left' ? '⬅️ Left' : a === 'center' ? '⬆️ Center' : '➡️ Right'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={styles.hintText}>💡 Drag the text box to reposition, drag the corner to resize</Text>
          </View>

          {exporting && (
            <View style={styles.exportingCard}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.exportingText}>Exporting video... {exportProgress}</Text>
            </View>
          )}

  

        </ScrollView>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderIcon}>🎬</Text>
          <Text style={styles.placeholderTitle}>Welcome to Video Editor</Text>
          <Text style={styles.placeholderText}>Import a video from your library or record a new one to get started</Text>
          <View style={styles.placeholderButtons}>
            <TouchableOpacity 
              style={[styles.placeholderBtn, styles.placeholderBtnPrimary]} 
              onPress={pickFromLibrary}
              activeOpacity={0.8}
            >
              <Text style={styles.placeholderBtnText}>📁 Import Video</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.placeholderBtn, styles.placeholderBtnSecondary]} 
              onPress={recordVideo}
              activeOpacity={0.8}
            >
              <Text style={styles.placeholderBtnText}>🎥 Record Video</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export default EditorScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 12,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  headerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 100,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  importBtn: {
    backgroundColor: COLORS.primary,
  },
  recordBtn: {
    backgroundColor: COLORS.secondary,
  },
  exportBtn: {
    backgroundColor: COLORS.success,
  },
  disabledBtn: {
    backgroundColor: COLORS.surfaceLight,
    opacity: 0.5,
  },
  headerBtnText: {
    color: COLORS.text,
    fontFamily: FONTS.bold,
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  previewContainer: {
    backgroundColor: COLORS.surface,
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  preview: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 16,
  },
  playbackControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 100,
    alignItems: 'center',
  },
  playBtnActive: {
    backgroundColor: COLORS.accent,
  },
  playBtnPaused: {
    backgroundColor: COLORS.warning,
  },
  playBtnText: {
    color: COLORS.text,
    fontFamily: FONTS.bold,
    fontSize: 14,
  },
  sliderContainer: {
    flex: 1,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.medium,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  trimInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
  },
  trimInfoItem: {
    alignItems: 'center',
  },
  trimLabel: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.medium,
    fontSize: 12,
    marginBottom: 4,
  },
  trimValue: {
    color: COLORS.text,
    fontFamily: FONTS.bold,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  trimSliders: {
    gap: 16,
  },
  trimSliderGroup: {
    marginBottom: 8,
  },
  trimSliderLabel: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.medium,
    fontSize: 12,
    marginBottom: 8,
  },
  hintText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.regular,
    fontSize: 11,
    marginTop: 8,
    fontStyle: 'italic',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: COLORS.text,
    fontFamily: FONTS.medium,
    fontSize: 14,
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  valueText: {
    color: COLORS.primary,
    fontFamily: FONTS.bold,
    fontSize: 14,
  },
  textInput: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: COLORS.text,
    fontFamily: FONTS.regular,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: COLORS.text,
    transform: [{ scale: 1.1 }],
  },
  colorInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorInput: {
    flex: 1,
  },
  colorPreview: {
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  alignmentButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  alignBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 100,
  },
  alignBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryDark,
  },
  alignBtnText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
  alignBtnTextActive: {
    color: COLORS.text,
    fontFamily: FONTS.bold,
  },
  overlayBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  resizeHandle: {
    position: 'absolute',
    width: 20,
    height: 20,
    right: -10,
    bottom: -10,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: COLORS.text,
  },
  exportingCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
  },
  exportingText: {
    color: COLORS.text,
    fontFamily: FONTS.medium,
    fontSize: 14,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  placeholderIcon: {
    fontSize: 80,
    marginBottom: 24,
  },
  placeholderTitle: {
    fontSize: 28,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  placeholderButtons: {
    width: '100%',
    gap: 12,
  },
  placeholderBtn: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  placeholderBtnPrimary: {
    backgroundColor: COLORS.primary,
  },
  placeholderBtnSecondary: {
    backgroundColor: COLORS.secondary,
  },
  placeholderBtnText: {
    color: COLORS.text,
    fontFamily: FONTS.bold,
    fontSize: 16,
  },
  exportSuccessCard: {
    backgroundColor: COLORS.success,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  exportSuccessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  exportSuccessIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  exportSuccessTitle: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    flex: 1,
  },
  exportSuccessContent: {
    marginBottom: 16,
  },
  exportSuccessLabel: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.text,
    marginBottom: 8,
    opacity: 0.9,
  },
  filePathContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  filePathText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  exportSuccessHint: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    opacity: 0.8,
    fontStyle: 'italic',
  },
  exportSuccessActions: {
    flexDirection: 'row',
    gap: 12,
  },
  openButton: {
    flex: 1,
    backgroundColor: COLORS.text,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  openButtonText: {
    color: COLORS.success,
    fontFamily: FONTS.bold,
    fontSize: 16,
  },
  dismissButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.text,
  },
  dismissButtonText: {
    color: COLORS.text,
    fontFamily: FONTS.medium,
    fontSize: 14,
  },
});
