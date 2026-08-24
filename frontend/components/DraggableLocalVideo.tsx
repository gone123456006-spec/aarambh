import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';
import { WebRTCVideo } from '@/components/WebRTCVideo';

const PIP_WIDTH = 92;
const PIP_HEIGHT = 128;
const PIP_RADIUS = 20;
const EDGE = 12;

type Props = {
  streamURL: string;
};

export function DraggableLocalVideo({ streamURL }: Props) {
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const positionRef = useRef({ x: 0, y: 0 });
  const dragOrigin = useRef({ x: 0, y: 0 });
  const hasInitialPosition = useRef(false);

  const bounds = useMemo(() => {
    const maxX = Math.max(EDGE, stageSize.width - PIP_WIDTH - EDGE);
    const maxY = Math.max(EDGE, stageSize.height - PIP_HEIGHT - EDGE);
    return { maxX, maxY };
  }, [stageSize.height, stageSize.width]);

  const clamp = (x: number, y: number) => ({
    x: Math.min(bounds.maxX, Math.max(EDGE, x)),
    y: Math.min(bounds.maxY, Math.max(EDGE, y)),
  });

  const applyPosition = (next: { x: number; y: number }) => {
    positionRef.current = next;
    setPosition(next);
  };

  useEffect(() => {
    if (!stageSize.width || hasInitialPosition.current) return;
    applyPosition({
      x: stageSize.width - PIP_WIDTH - EDGE,
      y: stageSize.height - PIP_HEIGHT - EDGE - 8,
    });
    hasInitialPosition.current = true;
  }, [stageSize.height, stageSize.width]);

  useEffect(() => {
    if (!stageSize.width) return;
    applyPosition(clamp(positionRef.current.x, positionRef.current.y));
  }, [bounds.maxX, bounds.maxY, stageSize.width]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragOrigin.current = { ...positionRef.current };
        },
        onPanResponderMove: (_, gesture) => {
          applyPosition(
            clamp(dragOrigin.current.x + gesture.dx, dragOrigin.current.y + gesture.dy)
          );
        },
        onPanResponderRelease: () => {
          const prev = positionRef.current;
          const midX = stageSize.width / 2;
          const snapX = prev.x + PIP_WIDTH / 2 < midX ? EDGE : bounds.maxX;
          applyPosition({ x: snapX, y: prev.y });
        },
      }),
    [bounds.maxX, stageSize.width]
  );

  const onStageLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setStageSize({ width, height });
  };

  return (
    <View style={styles.overlay} pointerEvents="box-none" onLayout={onStageLayout}>
      {stageSize.width > 0 ? (
        <View
          {...panResponder.panHandlers}
          style={[
            styles.pip,
            {
              left: position.x,
              top: position.y,
              width: PIP_WIDTH,
              height: PIP_HEIGHT,
            },
          ]}
        >
          <WebRTCVideo streamURL={streamURL} style={styles.video} objectFit="cover" mirror />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
  },
  pip: {
    position: 'absolute',
    borderRadius: PIP_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  video: {
    width: '100%',
    height: '100%',
  },
});
