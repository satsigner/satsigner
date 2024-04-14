import LinearGradient from "react-native-linear-gradient";
import { Colors } from "../../../styles";

export default function GradientSeparator() {
  return (
    <LinearGradient
      style={{width: '100%', height: 1}}
      colors={[Colors.grey61, Colors.grey38]}
      start={{x: 0, y: 0}}
      end={{x: 1.0, y: 0}}
    />
  );
}
