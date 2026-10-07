import React, { useRef } from 'react';
import {
  View,
  Text,
  PanResponder,
  StyleSheet,
  GestureResponderEvent,
  PanResponderGestureState,
  TouchableOpacity,
} from 'react-native';

type Props = {
  text: string;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  x: number;
  y: number;
  onChangePosition?: (x: number, y: number) => void;
  onChangeFontSize?: (fontSize: number) => void;
};

export default function DraggableText({
  text,
  color = 'white',
  fontSize = 32,
  fontFamily,
  x,
  y,
  onChangePosition,
  onChangeFontSize,
}: Props) {
  const pos = useRef({ x, y });
  const size = useRef(fontSize);

  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {},
    onPanResponderMove: (_evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
      pos.current = { x: x + gestureState.dx, y: y + gestureState.dy };
      onChangePosition?.(pos.current.x, pos.current.y);
    },
    onPanResponderRelease: () => {},
  });

  // A simple handle to enlarge/shrink text
  const onHandleDrag = (_e: GestureResponderEvent, gestureState: PanResponderGestureState) => {
    const delta = Math.max(1, Math.round(size.current + gestureState.dx / 8));
    size.current = delta;
    onChangeFontSize?.(size.current);
  };

  const handlePan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: onHandleDrag,
    onPanResponderRelease: () => {},
  });

  return (
    <View style={[styles.container, { left: x, top: y }]}
      {...pan.panHandlers}
    >
      <Text style={[{ color, fontSize: fontSize, fontFamily, textAlign: 'center' }]}>{text}</Text>
      <View style={styles.handle} {...handlePan.panHandlers}>
        <Text style={styles.handleText}>↔</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  handle: {
    width: 28,
    height: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    marginTop: 6,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleText: {
    color: 'white',
    fontSize: 12,
  },
});
