import {
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

import LinearGradient from 'react-native-linear-gradient';

import { AppText } from '../shared/AppText';

import { Colors, Typography } from '../../styles';

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
        <LinearGradient
          style={{
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          colors={[Colors.grey24, Colors.grey34]}
          start={{
            x: 0.94,
            y: 1.0
          }}
          end={{
            x: 0.86,
            y: -0.64
          }}
        >
          <View style={styles.button}>
            <AppText style={styles.buttonText}>
              {props.title}
            </AppText>
          </View>
        </LinearGradient>
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
