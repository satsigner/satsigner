import React, { Component, PropsWithChildren } from 'react';
import { Text, StyleSheet } from 'react-native';

import { Typography } from '../../styles';

interface Props {
  numberOfLines: number;
}

export class AppText extends Component<PropsWithChildren<Props>> {
  render() {
    return (
      <Text numberOfLines={this.props.numberOfLines} style={[styles.text, this.props.style]}>{this.props.children}</Text>
    );
  }
}

const styles = StyleSheet.create({  
  text: {
    ...Typography.textHighlight.x5,
    ...Typography.fontFamily.sfProTextRegular,
    letterSpacing: 0.6
  },
});
