import React, {FC} from 'react';

import {View, Pressable, Text, StyleSheet} from 'react-native';

type ButtonSectionProps = {
  q1Tapped: () => void;
  q2Tapped: () => void;
  q3Tapped: () => void;
  q4Tapped: () => void;
};

type QuarterButtonProps = {
  onPress: () => void;
  title: string;
};

const QuarterButton: FC<QuarterButtonProps> = ({onPress, title}) => {
  return (
    <Pressable onPress={onPress} style={styles.buttonContainer}>
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
};

const ButtonSection: FC<ButtonSectionProps> = ({
  q1Tapped,
  q2Tapped,
  q3Tapped,
  q4Tapped,
}) => {
  return (
    <View style={styles.container}>
      <QuarterButton onPress={q1Tapped} title={'Q1'} />
      <QuarterButton onPress={q2Tapped} title={'Q2'} />
      <QuarterButton onPress={q3Tapped} title={'Q3'} />
      <QuarterButton onPress={q4Tapped} title={'Q4'} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 20,
    marginTop: 5,
  },
  buttonContainer: {
    height: 25,
    width: 55,
    backgroundColor: '#6231ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  buttonText: {
    textAlign: 'center',
    color: 'white',
    fontWeight: 'bold',
  },
});

export default ButtonSection;
