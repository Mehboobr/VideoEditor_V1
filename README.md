This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## System Requirements

- **Node.js**: v23.11.0
- **npm**: 10.9.2
- **Java**: OpenJDK 17.0.16 2025-07-15 LTS (Zulu17.60+17-CA)
- **Ruby**: 3.2.2 (2023-03-30 revision e51014f9c0) [arm64-darwin25]
- **CocoaPods**: 1.16.2

## Step 1: Install Dependencies

First, install the project dependencies:

```sh
npm install
```

## Step 2: Android Setup

### Required Files for Android Build

After running `npm install`, you need to manually replace some files for Android builds. Required files are available at:
- `add-lib-folder inside -ffmpeg-kit-react-native--android`

### Fixing Android Build Errors

While building the app for Android, you may encounter errors with two libraries:

#### 1. ffmpeg-kit-react-native

**Solution:**
Replace the `libs` folder and `build.gradle` file in `node_modules/ffmpeg-kit-react-native/android` with the files from:
- `add-lib-folder inside -ffmpeg-kit-react-native--android`

#### 2. react-native-deepar

**Solution:**
Replace the `libs` folder and `build.gradle` file in `node_modules/react-native-deepar/android` with the files from:
- `add-libs-folder-inside-react-native-deepar`

## Step 3: iOS Setup

If you encounter any issues in Xcode regarding pods not being installed correctly, follow these steps:

1. Delete `node_modules` folder:
```sh
rm -rf node_modules
```

2. Install the correct Bundler version:
```sh
sudo gem install bundler:2.4.22
```

3. Install Ruby gems:
```sh
bundle install
```

4. Install CocoaPods dependencies:
```sh
bundle exec pod install --project-directory=ios
```

## Step 4: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 5: Build and Run Your App

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android

# OR using npx
npx react-native run-android
```

### iOS

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios

# OR using npx
npx react-native run-ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Building Release Versions

### Android Release APK

To build a release APK for Android:

```sh
cd android
./gradlew assembleRelease
```

The APK will be located at: `android/app/build/outputs/apk/release/app-release.apk`

### Android Release AAB (App Bundle)

To build a release AAB for Android:

```sh
cd android
./gradlew bundleRelease
```

The AAB will be located at: `android/app/build/outputs/bundle/release/app-release.aab`

## Step 6: Modify Your App

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
