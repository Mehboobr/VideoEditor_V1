import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
// react-native-ffmpeg provides RNFFmpeg
import { RNFFmpeg } from 'react-native-ffmpeg';

export async function getOutputPath(fileName: string) {
  const dir = Platform.OS === 'android' ? RNFS.ExternalCachesDirectoryPath : RNFS.CachesDirectoryPath;
  return `${dir}/${fileName}`;
}

/**
 * Build and run an ffmpeg command to trim and overlay text.
 * - input: input file path
 * - start: number seconds
 * - end: number seconds
 * - text: overlay text
 * - textX, textY: position in pixels
 * - fontSize, fontColor
 */
export async function exportTrimmedWithText(options: {
  input: string;
  start: number;
  end: number;
  text: string;
  textX: number;
  textY: number;
  fontSize: number;
  fontColor: string;
  outputFileName?: string;
}) {
  const { input, start, end, text, textX, textY, fontSize, fontColor, outputFileName } = options;
  const fileName = outputFileName ?? `edited_${Date.now()}.mp4`;
  const output = await getOutputPath(fileName);

  // drawtext requires a fontfile in many environments; try system fonts on Android, leave fontfile empty on iOS
  const fontfile = Platform.OS === 'android' ? '/system/fonts/Roboto-Regular.ttf' : '';

  // Escape text single quotes
  const safeText = text.replace(/'/g, "\\'");

  const vfParts = [] as string[];
  vfParts.push(`drawtext=text='${safeText}':fontcolor=${fontColor}:fontsize=${fontSize}:x=${textX}:y=${textY}${fontfile ? `:fontfile=${fontfile}` : ''}`);
  const vf = vfParts.join(',');

  // Build command: trim with -ss and -to, apply video filter drawtext
  const cmd = `-y -i '${input}' -ss ${start} -to ${end} -vf "${vf}" -c:a copy '${output}'`;

  // Execute
  const rc = await RNFFmpeg.execute(cmd);
  if (rc.rc !== 0 && rc !== 0) {
    // RNFFmpeg v0.5 return shape may differ; throw if non-zero
    throw new Error(`FFmpeg failed with rc=${JSON.stringify(rc)}`);
  }

  return output;
}
