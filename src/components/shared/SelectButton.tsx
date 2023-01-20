import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

import DownArrow from '../../assets/images/down-arrow.svg';

import { Colors, Typography } from '../../styles';

export default function SelectButton(props: any) {
  const styles = StyleSheet.create({  
    touchableOpacity: {
      borderRadius: 3,
      backgroundColor: props?.style?.backgroundColor || Colors.inputBackground,
      height: 55,
      marginTop: 8,
      marginBottom: 12
    },  
    button: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonText: {
      ...Typography.textHighlight.x16,
      color: props?.style?.color || Colors.actionText,
      fontWeight: '300',
      letterSpacing: 0.6
    },
    downArrow: {
      position: 'absolute',
      right: 15,
      top: 27.5
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
        <DownArrow style={styles.downArrow} width={11.6} height={5}></DownArrow>
      </View>
    </TouchableOpacity>
  );
}
