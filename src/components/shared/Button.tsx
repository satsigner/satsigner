import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

import { Colors, Typography } from '../../styles';

export default (props: any) => {
  const styles = StyleSheet.create({  
    touchableOpacity: {
      borderRadius: 3,
      backgroundColor: Colors.action,
      height: 62,
      marginVertical: 10
    },  
    button: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonText: {
      ...Typography.textHighlight.x5,
      ...Typography.capitalization.uppercase
    }
  });
  
  return (
    <TouchableOpacity
      activeOpacity={0.5}
      style={styles.touchableOpacity}
      onPress={props.onPress}
    >
      <View style={styles.button}>
        <Text style={styles.buttonText}>
          {props.title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
