import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import { getWebRTC } from '@/utils/webrtcNative';

type Props = {
  streamURL: string;
  style?: StyleProp<ViewStyle>;
  objectFit?: 'contain' | 'cover';
  mirror?: boolean;
};

export function WebRTCVideo({ streamURL, style, objectFit = 'cover', mirror = false }: Props) {
  const webrtc = getWebRTC();
  if (!webrtc?.RTCView || !streamURL) {
    return <View style={style} />;
  }
  const { RTCView } = webrtc;
  return (
    <RTCView
      streamURL={streamURL}
      style={style}
      objectFit={objectFit}
      mirror={mirror}
      zOrder={mirror ? 1 : 0}
    />
  );
}
