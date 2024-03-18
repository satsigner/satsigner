import { StyleSheet } from 'react-native';

import BouncyCheckboxGroup, { ICheckboxButton } from 'react-native-bouncy-checkbox-group';

import { Typography, Colors } from '../../styles';
import { useState } from 'react';

const CheckIcon = require('../../assets/images/check.png');

export default function CheckboxGroup(props: any) {

  const [selectedId, setSelectedId] = useState(null);

  let i = 0;

  const data = props.values.map(value => (
    {
      id: i++,
      text: value,
      ...getDataProps(i-1, selectedId)
    }
  ));

  return (
    <BouncyCheckboxGroup
      data={data}
      style={{ flexDirection: "column" }}
      onChange={(selectedItem: ICheckboxButton) => {
        setSelectedId(selectedItem.id);
        console.log("SelectedItem: ", selectedItem.id);
      }}
    />
  );
}

function getDataProps(id: string, selectedId: string) {
  const innerIconStyleBorderColor = id === selectedId ?
    'rgba(255, 255, 255, 0.22)' :
    'rgba(0, 0, 0, 0)';

  return {
    style: {marginBottom: 10},
    textStyle: styles.text,
    iconStyle: {
      borderRadius: 4
    },
    iconImageStyle: {
      tintColor: Colors.grey191,
      width: 17,
      height: 17                
    },
    checkIconImageSource: CheckIcon,
    size: 32,
    innerIconStyle: {
      borderRadius: 4,
      borderWidth: 2,
      borderColor: innerIconStyleBorderColor
    },
    unfillColor: 'rgba(255, 255, 255, 0.17)',
    fillColor: 'rgba(255, 255, 255, 0.22)',
    bounceEffectIn: 1
  };
}

const styles = StyleSheet.create({  
  text: {
    ...Typography.textHighlight.x12,
    ...Typography.fontFamily.sfProTextRegular,
    letterSpacing: 0.6,
    textDecorationLine: 'none'
  }
});
