import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { Typography, Layout } from '../styles';
import Button from './shared/Button';

const BUTTON_TITLE = 'Account List';
interface Props {
  navigation: NavigationProp<any>;
}

export default function HomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.label}>Choose an action</Text>
      </View>
      <View style={styles.actions}>
        <Button
          title={BUTTON_TITLE}
          onPress={() => navigation.navigate('AccountList')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...Layout.container.base,
    ...Layout.container.topPadded,
    ...Layout.container.horizontalPadded,
  },
  actions: {
    justifyContent: 'space-evenly',
    marginVertical: 36,
  },
  label: {
    ...Typography.textHighlight.x6,
    alignSelf: 'center',
    marginBottom: 7,
  },
});
