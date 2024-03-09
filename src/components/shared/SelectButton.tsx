import {
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

import DownArrow from '../../assets/images/down-arrow.svg';

import { AppText } from '../shared/AppText';

import { Colors, Typography } from '../../styles';

export default function SelectButton(props: any) {
  const styles = StyleSheet.create({  
    touchableOpacity: {
      borderRadius: 3,
      backgroundColor: props?.style?.backgroundColor || Colors.inputBackground,
      height: 55,
      marginTop: 3,
      marginBottom: 12
    },  
    button: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonText: {
      ...Typography.fontFamily.sfProTextLight,
      ...Typography.textHighlight.x18,
      color: props?.style?.color || Colors.actionText,
      letterSpacing: 0.6,
      ...props.buttonTextStyle
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
        <AppText style={styles.buttonText}>
          {props.title}
        </AppText>
        <DownArrow style={styles.downArrow} width={11.6} height={5}></DownArrow>
      </View>
    </TouchableOpacity>
  );
}
