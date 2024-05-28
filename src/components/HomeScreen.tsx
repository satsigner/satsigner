import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Typography, Layout } from '../styles';
import Button from './shared/Button';

export default function HomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.label}>Choose an action</Text>
      </View>
      <View style={styles.actions}>
        <Button
          title="Account List"
          onPress={() => navigation.navigate('AccountList')}
        />
        <Button
          title="Configure Blockchain"
          onPress={() => navigation.navigate('ConfigBlockchain')}
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
