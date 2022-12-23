import React from 'react';
import {
  View,
  Text,
  StyleSheet
} from 'react-native';

import { Typography, Layout } from '../styles';

export default function PlaceholderScreen(props: any) {
  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.label}>
          Just a placeholder
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base,
    ...Layout.container.topPadded,
  },
  label: {
    ...Typography.textHighlight.x8,
    ...Typography.capitalization.capitalize,
    alignSelf: 'center',
    marginBottom: 7
  }
});  
