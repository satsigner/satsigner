import {
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert
} from 'react-native';

import { InAppBrowser } from 'react-native-inappbrowser-reborn'

import { AppText } from '../shared/AppText';

import { Colors, Typography } from '../../styles';

export default function Link(props: any) {
  const { text, url } = props;

  const styles = StyleSheet.create({  
    text: {
      ...Typography.textHighlight.x6,
      color: Colors.linkText,
      textDecorationLine: 'underline',
      marginHorizontal: 4,
      marginBottom: -2.5
    }
  });
  
  return (
    <TouchableOpacity
      activeOpacity={0.5}
      style={props.style}
      onPress={async () => openLink(props.url)}
      disabled={props.disabled}
    >
      <AppText style={styles.text}>
        { text }
      </AppText>
    </TouchableOpacity>
  );
}

async function openLink(url: string) {
  try {
    if (await InAppBrowser.isAvailable()) {
      const result = await InAppBrowser.open(url, {
        // iOS Properties
        dismissButtonStyle: 'cancel',
        preferredBarTintColor: Colors.background,
        preferredControlTintColor: 'white',
        readerMode: false,
        animated: true,
        modalPresentationStyle: 'fullScreen',
        modalTransitionStyle: 'coverVertical',
        modalEnabled: true,
        enableBarCollapsing: false,
        // Android Properties
        showTitle: true,
        toolbarColor: Colors.background,
        secondaryToolbarColor: 'black',
        navigationBarColor: 'black',
        navigationBarDividerColor: 'white',
        enableUrlBarHiding: true,
        enableDefaultShare: true,
        forceCloseOnRedirection: false,
        // Specify full animation resource identifier(package:anim/name)
        // or only resource name(in case of animation bundled with app).
        animations: {
          startEnter: 'slide_in_right',
          startExit: 'slide_out_left',
          endEnter: 'slide_in_left',
          endExit: 'slide_out_right'
        }
      });
    }
    else Linking.openURL(url);
  } catch (error) {
    Alert.alert(error.message);
  }
}