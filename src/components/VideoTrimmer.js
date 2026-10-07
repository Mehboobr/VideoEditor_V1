import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  PanResponder,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Video from 'react-native-video';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
// Video processing library - loaded dynamically when needed

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FRAME_WIDTH = 50;
const HANDLE_WIDTH = 30;
const TIMELINE_PADDING = 40; // Space for handles
const MAX_FRAMES = 30; // Limit frames to prevent memory issues
const MAX_VIDEO_DURATION = 300; // 5 minutes max recommended

const VideoTrimmer = ({ visible, onClose, videoUri, videoDuration, onTrimComplete }) => {
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(videoDuration);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isTrimming, setIsTrimming] = useState(false);
  const [videoError, setVideoError] = useState(false);
  
  const videoRef = useRef(null);
  const scrollViewRef = useRef(null);
  const startHandleX = useRef(0);
  const endHandleX = useRef((videoDuration / videoDuration) * (SCREEN_WIDTH - TIMELINE_PADDING * 2));

  // Calculate optimal frame count based on video duration
  const getFrameCount = () => {
    // For videos longer than MAX_FRAMES seconds, reduce frame count
    if (videoDuration > MAX_FRAMES) {
      return MAX_FRAMES; // Show MAX_FRAMES frames max
    }
    return Math.ceil(videoDuration);
  };

  // Calculate frame interval (how many seconds each frame represents)
  const getFrameInterval = () => {
    const frameCount = getFrameCount();
    return videoDuration / frameCount;
  };

  // Calculate position from time
  const timeToPosition = (time) => {
    const frameCount = getFrameCount();
    const totalWidth = frameCount * FRAME_WIDTH;
    return (time / videoDuration) * totalWidth;
  };

  // Calculate time from position
  const positionToTime = (position) => {
    const frameCount = getFrameCount();
    const totalWidth = frameCount * FRAME_WIDTH;
    const time = (position / totalWidth) * videoDuration;
    return Math.max(0, Math.min(videoDuration, time));
  };

  // Start handle pan responder
  const startHandlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsPaused(true);
      },
      onPanResponderMove: (_, gestureState) => {
        const newPosition = Math.max(0, startHandleX.current + gestureState.dx);
        const maxPosition = timeToPosition(trimEnd) - FRAME_WIDTH;
        
        if (newPosition <= maxPosition) {
          const newTime = positionToTime(newPosition);
          setTrimStart(newTime);
          videoRef.current?.seek(newTime);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        startHandleX.current = Math.max(0, startHandleX.current + gestureState.dx);
        const maxPosition = timeToPosition(trimEnd) - FRAME_WIDTH;
        if (startHandleX.current > maxPosition) {
          startHandleX.current = maxPosition;
        }
      },
    })
  ).current;

  // End handle pan responder
  const endHandlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsPaused(true);
      },
      onPanResponderMove: (_, gestureState) => {
        const totalWidth = Math.ceil(videoDuration) * FRAME_WIDTH;
        const newPosition = Math.min(totalWidth, endHandleX.current + gestureState.dx);
        const minPosition = timeToPosition(trimStart) + FRAME_WIDTH;
        
        if (newPosition >= minPosition) {
          const newTime = positionToTime(newPosition);
          setTrimEnd(newTime);
          videoRef.current?.seek(newTime);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const totalWidth = Math.ceil(videoDuration) * FRAME_WIDTH;
        endHandleX.current = Math.min(totalWidth, endHandleX.current + gestureState.dx);
        const minPosition = timeToPosition(trimStart) + FRAME_WIDTH;
        if (endHandleX.current < minPosition) {
          endHandleX.current = minPosition;
        }
      },
    })
  ).current;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${String(secs).padStart(2, '0')}.${ms}`;
  };

  const handleTrim = async () => {
    setIsTrimming(true);
    
    // Log trim data for debugging
    const trimData = {
      videoUri,
      startTime: trimStart,
      endTime: trimEnd,
      duration: trimEnd - trimStart,
    };
    
    console.log('Trim data:', trimData);
    
    // Show trim selection to user
    setTimeout(() => {
      setIsTrimming(false);
      
      Alert.alert(
        '✂️ Trim Range Selected',
        `Your video will be trimmed to:\n\n` +
        `▶️ Start: ${formatTime(trimStart)}\n` +
        `⏹️ End: ${formatTime(trimEnd)}\n` +
        `⏱️ Duration: ${formatTime(trimEnd - trimStart)}\n\n` +
        `To enable actual video processing:\n` +
        `1. Install a video processing library\n` +
        `2. See VIDEO_TRIMMING_SETUP.md for options\n\n` +
        `Popular choices:\n` +
        `• react-native-ffmpeg\n` +
        `• react-native-compressor\n` +
        `• Custom native module`,
        [
          { 
            text: 'Cancel', 
            style: 'cancel'
          },
          {
            text: 'Keep Editing',
            onPress: () => {},
          },
          {
            text: 'Got It',
            onPress: onClose,
            style: 'default',
          },
        ]
      );
    }, 500);
  };

  const togglePlayPause = () => {
    setIsPaused(!isPaused);
  };

  const handleReset = () => {
    setTrimStart(0);
    setTrimEnd(videoDuration);
    startHandleX.current = 0;
    endHandleX.current = timeToPosition(videoDuration);
    videoRef.current?.seek(0);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trim Video</Text>
          <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
            <Ionicons name="refresh" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Video Preview */}
        <View style={styles.videoContainer}>
          <Video
            ref={videoRef}
            source={{ uri: videoUri }}
            style={styles.video}
            resizeMode="contain"
            paused={isPaused}
            repeat={false}
            onLoad={(data) => {
              console.log('Video loaded in trimmer:', data.duration);
              setVideoError(false);
            }}
            onError={(error) => {
              console.error('Video load error:', error);
              setVideoError(true);
              Alert.alert(
                'Video Error',
                'Failed to load video. The file may be corrupted or too large.',
                [{ text: 'OK', onPress: onClose }]
              );
            }}
            onProgress={(data) => {
              setCurrentTime(data.currentTime);
              // Loop within trim range
              if (data.currentTime >= trimEnd) {
                videoRef.current?.seek(trimStart);
              }
              if (data.currentTime < trimStart) {
                videoRef.current?.seek(trimStart);
              }
            }}
          />

          {/* Play/Pause Button */}
          <TouchableOpacity
            style={styles.playButton}
            onPress={togglePlayPause}
          >
            <Ionicons
              name={isPaused ? 'play' : 'pause'}
              size={48}
              color="white"
            />
          </TouchableOpacity>
        </View>

        {/* Time Display */}
        <View style={styles.timeContainer}>
          <View style={styles.timeBox}>
            <Text style={styles.timeLabel}>Start</Text>
            <Text style={styles.timeValue}>{formatTime(trimStart)}</Text>
          </View>
          
          <View style={styles.timeBox}>
            <Text style={styles.timeLabel}>Current</Text>
            <Text style={styles.timeValue}>{formatTime(currentTime)}</Text>
          </View>
          
          <View style={styles.timeBox}>
            <Text style={styles.timeLabel}>End</Text>
            <Text style={styles.timeValue}>{formatTime(trimEnd)}</Text>
          </View>
          
          <View style={styles.timeBox}>
            <Text style={styles.timeLabel}>Duration</Text>
            <Text style={styles.timeValue}>{formatTime(trimEnd - trimStart)}</Text>
          </View>
        </View>

        {/* Timeline with Frames */}
        <View style={styles.timelineContainer}>
          {videoDuration > MAX_VIDEO_DURATION && (
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={16} color="#FFA500" />
              <Text style={styles.warningText}>
                Large video detected. Trimming recommended to improve performance.
              </Text>
            </View>
          )}
          <Text style={styles.timelineTitle}>
            {videoDuration > MAX_FRAMES 
              ? `Drag handles to trim (Showing ${MAX_FRAMES} frames)` 
              : 'Drag handles to trim'}
          </Text>
          
          <View style={styles.timelineWrapper}>
            <ScrollView
              ref={scrollViewRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.scrollView}
              contentContainerStyle={{ paddingHorizontal: TIMELINE_PADDING }}
            >
              {/* Frame Thumbnails */}
              <View style={styles.framesContainer}>
                {Array.from({ length: getFrameCount() }).map((_, index) => {
                  const frameInterval = getFrameInterval();
                  const frameTime = index * frameInterval;
                  const isInRange = frameTime >= trimStart && frameTime <= trimEnd;
                  const isCurrent = Math.abs(currentTime - frameTime) < frameInterval / 2;
                  
                  return (
                    <TouchableOpacity
                      key={index}
                      onPress={() => {
                        videoRef.current?.seek(frameTime);
                        setCurrentTime(frameTime);
                        setIsPaused(true);
                      }}
                      style={[
                        styles.frame,
                        isInRange ? styles.frameInRange : styles.frameOutRange,
                      ]}
                    >
                      {/* Simple colored box instead of Video thumbnail to save memory */}
                      <View style={styles.frameContent}>
                        <Text style={styles.frameText}>
                          {Math.floor(frameTime)}s
                        </Text>
                      </View>
                      {isCurrent && (
                        <View style={styles.currentFrameIndicator} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Trim Handles */}
              <View
                style={[
                  styles.trimOverlay,
                  {
                    left: timeToPosition(trimStart),
                    right: Math.ceil(videoDuration) * FRAME_WIDTH - timeToPosition(trimEnd),
                  },
                ]}
              >
                {/* Start Handle */}
                <View
                  {...startHandlePanResponder.panHandlers}
                  style={styles.startHandle}
                >
                  <View style={styles.handleBar}>
                    <Feather name="chevrons-right" size={20} color="white" />
                  </View>
                </View>

                {/* End Handle */}
                <View
                  {...endHandlePanResponder.panHandlers}
                  style={styles.endHandle}
                >
                  <View style={styles.handleBar}>
                    <Feather name="chevrons-left" size={20} color="white" />
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Trim Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.trimButton, isTrimming && styles.trimButtonDisabled]}
            onPress={handleTrim}
            disabled={isTrimming}
          >
            {isTrimming ? (
              <ActivityIndicator color="black" size="small" />
            ) : (
              <>
                <Feather name="scissors" size={24} color="black" />
                <Text style={styles.trimButtonText}>Trim Video</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  closeButton: {
    padding: 8,
  },
  resetButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  playButton: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  timeBox: {
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 10,
    color: '#888',
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  timelineContainer: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 16,
  },
  timelineTitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 12,
  },
  timelineWrapper: {
    height: 80,
    position: 'relative',
  },
  scrollView: {
    flex: 1,
  },
  framesContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  frame: {
    width: FRAME_WIDTH,
    height: 60,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 2,
    position: 'relative',
  },
  frameInRange: {
    borderColor: '#60A5FA',
  },
  frameOutRange: {
    borderColor: '#333',
    opacity: 0.5,
  },
  frameThumbnail: {
    width: FRAME_WIDTH,
    height: 60,
  },
  frameContent: {
    width: FRAME_WIDTH,
    height: 60,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  frameText: {
    color: '#888',
    fontSize: 10,
    fontWeight: 'bold',
  },
  currentFrameIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3,
    borderColor: '#FCD34D',
    borderRadius: 4,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    marginHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFA500',
    gap: 8,
  },
  warningText: {
    color: '#FFA500',
    fontSize: 12,
    flex: 1,
  },
  trimOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#60A5FA',
  },
  startHandle: {
    position: 'absolute',
    left: -HANDLE_WIDTH / 2,
    top: -10,
    bottom: -10,
    width: HANDLE_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  endHandle: {
    position: 'absolute',
    right: -HANDLE_WIDTH / 2,
    top: -10,
    bottom: -10,
    width: HANDLE_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  handleBar: {
    width: HANDLE_WIDTH,
    height: '100%',
    backgroundColor: '#60A5FA',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  footer: {
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  trimButton: {
    flexDirection: 'row',
    backgroundColor: '#93C5FD',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  trimButtonDisabled: {
    opacity: 0.6,
  },
  trimButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'black',
  },
});

export default VideoTrimmer;

