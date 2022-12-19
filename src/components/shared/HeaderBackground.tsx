import {
  Text,
  StyleSheet,
} from 'react-native';

import LinearGradient from 'react-native-linear-gradient';

import { Colors } from '../../Colors';
import GlobalStyles from '../../GlobalStyles';

export default (props) => {
  const styles = StyleSheet.create({  
    header: {
      height: 75,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
  
  return (
    <LinearGradient
      style={styles.header}
      colors={[Colors.gray1, Colors.gray3]}
      start={{
        x: 0.94,
        y: 1.0
      }}
      end={{
        x: 0.86,
        y: -0.64
      }}
    >
    </LinearGradient>
  );
}
