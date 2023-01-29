import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

import { Colors, Typography } from '../../styles';

export default function Button(props: any) {
  const styles = StyleSheet.create({  
    touchableOpacity: {
      borderRadius: 3,
      borderColor: props?.style?.borderColor,
      borderStyle: 'solid',
      borderWidth: props?.style?.borderColor ? 1 : 0,
      backgroundColor: props?.style?.backgroundColor || Colors.actionBackground,
      height: 62,
      marginVertical: 8
    },  
    button: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonText: {
      ...Typography.textHighlight.x5,
      ...Typography.capitalization.uppercase,
      color: props?.style?.color || Colors.actionText
    }
  });
  
  return (
    <TouchableOpacity
      activeOpacity={0.5}
      style={styles.touchableOpacity}
      onPress={props.onPress}
      disabled={props.disabled}
    >
      <View style={styles.button}>
        <Text style={styles.buttonText}>
          {props.title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
