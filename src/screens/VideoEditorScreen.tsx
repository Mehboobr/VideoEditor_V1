import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Video from 'react-native-video';
import { launchImageLibrary, launchCamera, Asset } from 'react-native-image-picker';
import Slider from '@react-native-community/slider';
import DraggableText from '../components/DraggableText';
import { exportTrimmedWithText } from '../utils/ffmpeg';

const { width: SCREEN_W } = Dimensions.get('window');

export default function VideoEditorScreen() {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [paused, setPaused] = useState(true);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);

  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  const [overlayText, setOverlayText] = useState('Hello');
  const [textX, setTextX] = useState(40);
  const [textY, setTextY] = useState(40);
  const [fontSize, setFontSize] = useState(32);
  const [fontColor, setFontColor] = useState('#FFFFFF');

  const [exporting, setExporting] = useState(false);

  const minClipLength = 3; // seconds

  const onPick = async () => {
    const res = await launchImageLibrary({ mediaType: 'video', selectionLimit: 1 });
    if (res.didCancel) return;
    if (res.assets && res.assets.length > 0) {
      const a = res.assets[0];
      setAsset(a);
      setTrimStart(0);
      setTrimEnd(a.duration ?? 0);
    }
  };

  const onRecord = async () => {
    const res = await launchCamera({ mediaType: 'video', saveToPhotos: true });
    if (res.didCancel) return;
    if (res.assets && res.assets.length > 0) {
      const a = res.assets[0];
      setAsset(a);
      setTrimStart(0);
      setTrimEnd(a.duration ?? 0);
    }
  };

  const onLoad = (meta: any) => {
    setDuration(meta.duration);
    if (!trimEnd || trimEnd === 0) setTrimEnd(meta.duration);
  };

  const onProgress = (p: any) => {
    setPosition(p.currentTime);
  };

  const seekTo = (t: number) => {
    videoRef.current?.seek(t);
    setPosition(t);
  };

  const videoRef = useRef<any>(null);

  const doExport = async () => {
    if (!asset?.uri) return Alert.alert('No video selected');

    const clipLen = trimEnd - trimStart;
    if (clipLen < minClipLength) {
      return Alert.alert('Minimum clip length is 3 seconds');
    }

    setExporting(true);
    try {
      const out = await exportTrimmedWithText({
        input: asset.uri.replace('file://', ''),
        start: trimStart,
        end: trimEnd,
        text: overlayText,
        textX,
        textY,
        fontSize,
        fontColor: fontColor.replace('#', '0x') ?? 'white',
      });
      Alert.alert('Exported', `Saved to ${out}`);
    } catch (e) {
      Alert.alert('Export failed', String(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.controlsRow}>
        <Button title="Pick Video" onPress={onPick} />
        <Button title="Record Video" onPress={onRecord} />
      </View>

      <View style={styles.previewArea}>
        {asset ? (
          <>
            <Video
              source={{ uri: asset.uri }}
              ref={videoRef}
              style={styles.video}
              paused={paused}
              onLoad={onLoad}
              onProgress={onProgress}
              resizeMode="contain"
            />
            <DraggableText
              text={overlayText}
              color={fontColor}
              fontSize={fontSize}
              x={textX}
              y={textY}
              onChangePosition={(nx, ny) => {
                setTextX(nx);
                setTextY(ny);
              }}
              onChangeFontSize={(fs) => setFontSize(fs)}
            />
          </>
        ) : (
          <View style={styles.placeholder}>
            <Text>No video selected</Text>
          </View>
        )}
      </View>

      {asset && (
        <>
          <View style={styles.rowCenter}>
            <TouchableOpacity onPress={() => setPaused((p) => !p)} style={styles.playBtn}>
              <Text>{paused ? 'Play' : 'Pause'}</Text>
            </TouchableOpacity>
            <Text>{new Date(position * 1000).toISOString().substr(11, 8)}</Text>
            <Text>/</Text>
            <Text>{new Date((duration ?? 0) * 1000).toISOString().substr(11, 8)}</Text>
          </View>

          <Slider
            style={{ width: SCREEN_W - 40, height: 40 }}
            minimumValue={0}
            maximumValue={duration}
            value={position}
            onValueChange={(v) => seekTo(v)}
          />

          <View style={styles.trimRow}>
            <Text>Trim Start: {trimStart.toFixed(2)}s</Text>
            <Slider
              style={{ flex: 1 }}
              minimumValue={0}
              maximumValue={duration}
              value={trimStart}
              onValueChange={(v) => {
                const maxStart = Math.max(0, trimEnd - minClipLength);
                const nv = Math.min(v, maxStart);
                setTrimStart(nv);
                if (position < nv) seekTo(nv);
              }}
            />
            <Text>{trimStart.toFixed(2)}s</Text>
          </View>

          <View style={styles.trimRow}>
            <Text>Trim End: {trimEnd.toFixed(2)}s</Text>
            <Slider
              style={{ flex: 1 }}
              minimumValue={0}
              maximumValue={duration}
              value={trimEnd}
              onValueChange={(v) => {
                const minEnd = Math.min(duration, trimStart + minClipLength);
                const nv = Math.max(v, minEnd);
                setTrimEnd(nv);
                if (position > nv) seekTo(nv);
              }}
            />
            <Text>{trimEnd.toFixed(2)}s</Text>
          </View>

          <View style={styles.textControls}>
            <TextInput
              value={overlayText}
              onChangeText={setOverlayText}
              style={styles.textInput}
              placeholder="Overlay text"
            />
            <View style={styles.smallRow}>
              <Text>Color:</Text>
              <TextInput value={fontColor} onChangeText={setFontColor} style={styles.smallInput} />
              <Text>Size:</Text>
              <Slider
                style={{ width: 120 }}
                minimumValue={12}
                maximumValue={120}
                value={fontSize}
                onValueChange={(v) => setFontSize(Math.round(v))}
              />
            </View>
          </View>

          <View style={{ marginTop: 8 }}>
            <Button title="Export" onPress={doExport} disabled={exporting} />
            {exporting && <ActivityIndicator />}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 12 },
  controlsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  previewArea: { height: 300, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  video: { width: '100%', height: '100%' },
  rowCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  playBtn: { padding: 8, backgroundColor: '#ddd', borderRadius: 6, marginRight: 12 },
  trimRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  textControls: { marginTop: 8 },
  textInput: { borderWidth: 1, borderColor: '#ccc', padding: 8, marginBottom: 8 },
  smallRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallInput: { width: 80, borderWidth: 1, borderColor: '#ccc', padding: 4, marginHorizontal: 8 },
});
