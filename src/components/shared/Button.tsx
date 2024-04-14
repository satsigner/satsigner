import {
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

import { AppText } from '../shared/AppText';

import { Colors, Typography } from '../../styles';
import BackgroundGradient from './BackgroundGradient';

export default function Button(props: any) {
  const styles = StyleSheet.create({  
    touchableOpacity: {
      borderRadius: 3,
      borderColor: props?.style?.borderColor,
      borderStyle: 'solid',
      borderWidth: props?.style?.borderColor ? 1 : 0,
      backgroundColor: props?.style?.backgroundColor || Colors.actionBackground,
      height: 60,
      marginVertical: 9
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
      style={[styles.touchableOpacity, props.style]}
      onPress={props.onPress}
      disabled={props.disabled}
    >
      {props.gradientBackground ? (
        <BackgroundGradient
          style={{
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View style={styles.button}>
            <AppText style={styles.buttonText}>
              {props.title}
            </AppText>
          </View>
        </BackgroundGradient>
      ) : (
        <View style={styles.button}>
          <AppText style={styles.buttonText}>
            {props.title}
          </AppText>
        </View>
      )}
    </TouchableOpacity>
  );
}
