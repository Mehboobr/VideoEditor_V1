import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity, Modal, Alert, PermissionsAndroid, Platform, NativeModules, StatusBar, Dimensions, ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
} from "react-native-vision-camera";
import Icon from "react-native-vector-icons/MaterialIcons";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import Feather from "react-native-vector-icons/Feather";
import Entypo from "react-native-vector-icons/Entypo";
import DocumentPicker from '@react-native-documents/picker';
import "./global.css";
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import Video from "react-native-video";
// import Editbottomicons from './src/components/Editbottomicons';

const { FilePicker } = NativeModules;

export default function App() {
  const [cameraPosition, setCameraPosition] = useState("back");
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [selectedTimer, setSelectedTimer] = useState(180); // default 3m
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState(null);
  const [cameraActive, setCameraActive] = useState(true);
  const [fileUri, setFileUri] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const insets = useSafeAreaInsets();
  const videoRef = useRef(null);

  // const device = useCameraDevice(cameraPosition);
  const { hasPermission, requestPermission } = useCameraPermission();
  const { hasPermission: hasMicPermission, requestPermission: requestMicPermission } =
    useMicrophonePermission();

  const cameraRef = useRef(null);
  const countdownRef = useRef(null);

  useEffect(() => {
    if (!hasPermission) requestPermission();
    if (!hasMicPermission) requestMicPermission();
  }, []);

  // Auto-stop recording when countdown reaches 0
  useEffect(() => {
    if (isRecording && countdown === 0) {
      stopRecording();
    }
  }, [countdown]);

  const startRecording = async () => {
    if (!cameraRef.current || isRecording) return;

    try {
      setIsRecording(true);
      setCountdown(selectedTimer);

      countdownRef.current = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);

      await cameraRef.current.startRecording({
        onRecordingFinished: (video) => {
          setRecordedVideo(video);
          console.log(video);
        },
        onRecordingError: (e) => {
          console.log(e);
        },
      });
    } catch (e) {
      console.error("Start recording error:", e);
    }
  };

  const stopRecording = async () => {
    if (!cameraRef.current || !isRecording) return;

    try {
      await cameraRef.current.stopRecording();
      setIsRecording(false);
      clearInterval(countdownRef.current);
      setShowTimerModal(false);
    } catch (e) {
      console.log(e);
    }
  };

  const flipCamera = () => {
    setCameraPosition((prev) => (prev === "back" ? "front" : "back"));
  };

  const toggleFlash = () => setFlashEnabled((prev) => !prev);

  const handleClose = () => {
    if (isRecording) {
      stopRecording();
    }
    setCameraActive(false);
    Alert.alert("Camera Closed", "Camera preview stopped");
  };

  const requestStoragePermission = async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      if (Platform.Version >= 33) {
        // Android 13+
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
          {
            title: 'Storage Permission',
            message: 'App needs access to your files',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        // Android 12 and below
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'App needs access to your files',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (err) {
      console.warn(err);
      return false;
    }
  };

  const openFileManager = async () => {
    try {
      // Request permission first
      const hasPermission = await requestStoragePermission();

      if (!hasPermission) {
        Alert.alert(
          'Permission Denied',
          'Storage permission is required to select files. Please enable it in app settings.'
        );
        return;
      }

      // Use our custom native file picker
      const result = await FilePicker.pickFile();

      if (result && result.uri) {
        console.log('Selected file:', result);

        // Extract file name from URI
        const fileName = result.uri.split('/').pop() || 'Unknown';

        Alert.alert(
          'File Selected',
          `File: ${fileName}\nURI: ${result.uri}`,
          [{ text: 'OK' }]
        );
      }

    } catch (err) {
      if (err.code === 'CANCELLED') {
        console.log('User cancelled file picker');
      } else {
        console.error('Error opening file manager:', err);
        Alert.alert('Error', 'Failed to open file manager: ' + (err.message || 'Unknown error'));
      }
    }
  };

  const openFileManager_2 = async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.video],
        allowMultiSelection: false,
      });

      if (result && result.length > 0) {
        const selectedFile = result[0];
        console.log('Selected video file:', selectedFile);

        Alert.alert(
          'Video Selected',
          `File: ${selectedFile.name}\nSize: ${(selectedFile.size / 1024 / 1024).toFixed(2)} MB\nType: ${selectedFile.type}`,
          [{ text: 'OK' }]
        );
      }

    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        console.log('User cancelled file picker');
      } else {
        console.error('Error opening file manager:', err);
        Alert.alert('Error', 'Failed to open file manager: ' + (err.message || 'Unknown error'));
      }
    }
  };


  const getPickerOptions = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'mixed',
        selectionLimit: 1,
      });

      if (result.didCancel) {
        console.log('User cancelled image picker');
      } else if (result.errorCode) {
        console.error('ImagePicker Error:', result.errorMessage);
        Alert.alert('Error', 'Failed to pick media: ' + result.errorMessage);
      } else if (result.assets && result.assets.length > 0) {
        const selectedMedia = result.assets[0];
        console.log('Selected media:', selectedMedia);
        setFileUri(selectedMedia.uri);


        Alert.alert(
          'Media Selected',
          `File: ${selectedMedia.fileName}\nType: ${selectedMedia.type}\nSize: ${(selectedMedia.fileSize / 1024 / 1024).toFixed(2)} MB`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error opening gallery:', error);
      Alert.alert('Error', 'Failed to open gallery: ' + error.message);
    }
  };

  const formatTime = (sec) => {
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  const getTimerLabel = (sec) => {
    if (sec < 60) return `${sec}s`;
    return `${sec / 60}m`;
  };

  if (!hasPermission || !hasMicPermission) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <Text className="text-white text-lg">Requesting permissions...</Text>
      </View>
    );
  }

  // if (!device) {
  //   return (
  //     <View className="flex-1 bg-black items-center justify-center">
  //       <Text className="text-white text-lg">Camera not available</Text>
  //     </View>
  //   );
  // }

  return (
    <SafeAreaView style={StyleSheet.absoluteFill} className="bg-black">
      {/* Camera */}
      {/* <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={cameraActive}
        video={true}
        audio={true}
        torch={flashEnabled ? "on" : "off"}
      /> */}

      {/* {fileUri && (
        <Video
          source={{ uri: fileUri }}
          // style={StyleSheet.absoluteFill}
          // resizeMode="contain"
          style={{ width: '100%' , height:'100%',}}
          resizeMode='cover'
          repeat
        />
      )} */}

      {fileUri && (
        <Video
          ref={videoRef}
          source={{ uri: fileUri }}
          style={StyleSheet.absoluteFill}
          resizeMode='cover'
          paused={isPaused}
          repeat={false}
          onLoad={(data) => {
            const actualTrimEnd = Math.min(data.duration, selectedTimer);
            setVideoDuration(actualTrimEnd);
            setTrimStart(0);
            setTrimEnd(actualTrimEnd);
          }}
          onProgress={(data) => {
            setCurrentTime(data.currentTime);
            // Stop video when it reaches the trimEnd time
            if (data.currentTime >= trimEnd && trimEnd > 0) {
              videoRef.current?.seek(0);
              setCurrentTime(0);
            }
          }}
          onEnd={() => {
            // Loop back to trimStart when video ends
            videoRef.current?.seek(trimStart);
          }}
        />
      )}


      {/* TOP BAR */}
      {fileUri === null ?
        <View className="absolute top-0 left-0 right-0 flex-row items-center justify-between px-5 pb-2 bg-black/40" style={{ paddingTop: insets.top + 8 }}>
          <TouchableOpacity onPress={handleClose} className="p-2">
            <Icon name="close" size={32} color="white" />
          </TouchableOpacity>

          <Text className="text-white text-xl font-semibold">
            {formatTime(isRecording ? countdown : selectedTimer)}
          </Text>

          <View style={{ width: 40 }} />
        </View>
        :
        <View className="absolute top-0 left-0 right-0 flex-row items-center justify-between px-5 pb-2 bg-black/40" style={{ paddingTop: insets.top + 8 }}>
          <TouchableOpacity onPress={() => setFileUri(null)} className="p-1">
            <Ionicons name="arrow-back" size={28} color="white" />
          </TouchableOpacity>

          <TouchableOpacity className="px-8 py-2 rounded-lg bg-blue-300">
            <Text className="text-black text-center font-bold text-base">
              Next
            </Text>
          </TouchableOpacity>
        </View>
      }

      {/* VIDEO TIMELINE */}
      {fileUri && (
        <View className="absolute bottom-28 left-0 right-0 px-4">
          <View className="bg-black/70 rounded-lg px-3 py-1 mb-2 pb-3 pt-3 self-start">
            <Text className="text-white font-semibold text-sm px-2 ">
              {formatTime(Math.floor(currentTime))} / {formatTime(Math.floor(videoDuration))}
            </Text>
          </View>
          <View className=" rounded-lg p-3">
            {/* Frame thumbnails */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="h-16">
              <View className="flex-row gap-1">
                {Array.from({ length: Math.ceil(videoDuration) }).map((_, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => {
                      videoRef.current?.seek(index);
                      setCurrentTime(index);
                    }}
                    className={`w-14 h-14 bg-gray-600 rounded border-2 ${Math.floor(currentTime) === index
                      ? 'border-blue-400'
                      : index >= trimStart && index <= trimEnd
                        ? 'border-blue-300'
                        : 'border-gray-700'
                      } overflow-hidden`}
                  >
                    <Video
                      source={{ uri: fileUri }}
                      style={{ width: 56, height: 56 }}
                      resizeMode='cover'
                      paused={true}
                      currentTime={index}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      )}

      {/* RIGHT SIDE BUTTONS */}
      {fileUri === null &&
        <View className="absolute right-4 top-32 gap-4">
          <TouchableOpacity
            onPress={flipCamera}
            className="w-14 h-14 rounded-full border-2 border-white/80 items-center justify-center"
          >
            <Ionicons name="camera-reverse" size={24} color="white" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={toggleFlash}
            className={`w-14 h-14 rounded-full border-2 items-center justify-center ${flashEnabled ? "bg-yellow-400 border-yellow-400" : "border-white/80"
              }`}
          >
            <Ionicons name={flashEnabled ? "flash" : "flash-off"} size={24} color="white" />
          </TouchableOpacity>
        </View>}

      {/* BOTTOM SECTION */}


      {
        fileUri === null ?
          <View className="absolute bottom-0 left-0 right-0 px-2 pb-6">
            <View className="flex-row items-center justify-between">
              {/* LEFT SIDE */}
              <View className="gap-3">
                <TouchableOpacity
                  onPress={() => setShowTimerModal(true)}
                  className="bg-blue-300 px-8 py-3 rounded-xl"
                >
                  <Text className="text-black font-bold text-lg">Timer</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => Alert.alert("Drafts", "Show drafts")}
                  className="bg-blue-300 px-8 py-3 rounded-xl"
                >
                  <Text className="text-black font-bold text-lg">Drafts</Text>
                </TouchableOpacity>
              </View>

              {/* RECORD BUTTON */}
              <TouchableOpacity
                onPress={isRecording ? stopRecording : startRecording}
                className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 items-center justify-center"
              >
                <View className="w-12 h-12 rounded-full bg-red-500" />
              </TouchableOpacity>

              {/* RIGHT SIDE */}
              <View className="gap-3 flex-row items-center justify-center">
                <TouchableOpacity
                  onPress={getPickerOptions}
                  className="w-16 h-16 bg-blue-300 rounded-xl items-center justify-center"
                >
                  <MaterialIcons name="drive-folder-upload" size={32} color="black" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => Alert.alert("Gallery", "Open gallery")}
                  className="w-16 h-16 bg-blue-300 rounded-xl items-center justify-center"
                >
                  <MaterialCommunityIcons name="movie-open" size={32} color="black" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
          :
          <View className="absolute bottom-0 left-0 right-0 px-2 pb-6 flex-row items-center justify-center gap-8">
            <View className="items-center">
              <TouchableOpacity
                onPress={getPickerOptions}
                className="w-16 h-16 bg-blue-300 rounded-xl items-center justify-center mb-1"
              >
                <Feather name="crop" size={32} color="black" />
              </TouchableOpacity>
              <Text className="text-white text-xs font-medium">Crop</Text>
            </View>

            <View className="items-center">
              <TouchableOpacity
                onPress={getPickerOptions}
                className="w-16 h-16 bg-blue-300 rounded-xl items-center justify-center mb-1"
              >
                <Feather name="edit" size={32} color="black" />
              </TouchableOpacity>
              <Text className="text-white text-xs font-medium">Edit</Text>
            </View>

            <View className="items-center">
              <TouchableOpacity
                onPress={getPickerOptions}
                className="w-16 h-16 bg-blue-300 rounded-xl items-center justify-center mb-1"
              >
                <Ionicons name="text" size={32} color="black" />
              </TouchableOpacity>
              <Text className="text-white text-xs font-medium">Text</Text>
            </View>

            <View className="items-center">
              <TouchableOpacity
                onPress={getPickerOptions}
                className="w-16 h-16 bg-blue-300 rounded-xl items-center justify-center mb-1"
              >
                <MaterialIcons name="keyboard-voice" size={32} color="black" />
              </TouchableOpacity>
              <Text className="text-white text-xs font-medium">Voice Over</Text>
            </View>

           

            <View className="items-center">
              <TouchableOpacity
                onPress={getPickerOptions}
                className="w-16 h-16 bg-blue-300 rounded-xl items-center justify-center mb-1"
              >
                <Feather name="scissors" size={32} color="black" />
              </TouchableOpacity>
              <Text className="text-white text-xs font-medium">Trim</Text>
            </View>
             
          </View>

      }

  

      {/* TIMER POPUP */}
      <Modal visible={showTimerModal} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowTimerModal(false)}
          className="flex-1 bg-black/60"
        >
          <View className="absolute bottom-40 left-6">
            <View className="bg-white rounded-2xl p-4 w-72">
              <View className="flex-row flex-wrap gap-2">
                {[15, 30, 45, 60, 120, 180].map((sec) => (
                  <TouchableOpacity
                    key={sec}
                    onPress={() => {
                      setSelectedTimer(sec);
                      setShowTimerModal(false);
                    }}
                    className={`flex-1 min-w-[100px] py-4 rounded-xl ${selectedTimer === sec ? "bg-blue-300" : "bg-gray-100"
                      }`}
                  >
                    <Text
                      className={`text-center font-bold  ${selectedTimer === sec ? "text-black" : "text-gray-700"
                        }`}
                    >
                      {getTimerLabel(sec)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
