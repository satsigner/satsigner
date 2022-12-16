import {
  Text,
  StyleSheet,
} from 'react-native';

import LinearGradient from 'react-native-linear-gradient';

import { COLORS } from '../../colors';
import GlobalStyles from '../../GlobalStyles';

export default (props) => {
  const styles = StyleSheet.create({  
    header: {
      height: 75,
      justifyContent: 'center',
      alignItems: 'center'
    },
    heading: {
      ...GlobalStyles.text,
      textTransform: 'uppercase'
    },
  });
  
  return (
    <LinearGradient
      style={styles.header}
      colors={[COLORS.gray1, COLORS.gray3]}
      start={{
        x: 0.94,
        y: 1.0
      }}
      end={{
        x: 0.86,
        y: -0.64
      }}
    >
      <Text style={styles.heading}>{props.heading}</Text>
    </LinearGradient>
  );
}
